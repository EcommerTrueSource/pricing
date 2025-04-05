import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { RateLimiterService } from '../../../../shared/services/rate-limiter.service';
import { ValidationService } from '../../../../shared/services/validation.service';
import {
    IMessagingService,
    ContractNotificationParams,
} from '../../../contract-management/notification/interfaces/messaging-service.interface';
import { Notification } from '../../../contract-management/notification/entities/notification.entity';
import { CONTRACT_NOTIFICATION_TEMPLATES } from '../templates/contract-notification.templates';

/**
 * Serviço responsável por enviar mensagens via WhatsApp
 * Implementa a interface IMessagingService para integração com o sistema de notificações
 */
@Injectable()
export class WhatsAppService implements IMessagingService {
    private readonly logger = new Logger(WhatsAppService.name);
    private readonly instanceApi: string;
    private readonly clientToken: string;

    /**
     * Construtor do serviço de WhatsApp
     * @param configService Serviço de configuração para obter variáveis de ambiente
     * @param rateLimiter Serviço de controle de rate limit
     * @param validationService Serviço de validação de dados
     */
    constructor(
        private readonly configService: ConfigService,
        private readonly rateLimiter: RateLimiterService,
        private readonly validationService: ValidationService,
    ) {
        const baseUrl = this.configService.get<string>('ZAPI_BASE_URL');
        const instanceId = this.configService.get<string>('ZAPI_INSTANCE_ID');
        const instanceToken = this.configService.get<string>('ZAPI_TOKEN');
        const clientToken = this.configService.get<string>('ZAPI_CLIENT_TOKEN');

        if (!baseUrl || !instanceId || !instanceToken || !clientToken) {
            throw new Error('Configurações da Z-API não encontradas');
        }

        this.instanceApi = `${baseUrl}/instances/${instanceId}/token/${instanceToken}`;
        this.clientToken = clientToken;

        this.logger.log(`Configurações carregadas:
            instanceApi: ${this.instanceApi}
            clientToken: ***
        `);
    }

    /**
     * Retorna o nome do serviço de mensageria
     * @returns Nome do serviço (WHATSAPP)
     */
    getServiceName(): string {
        return 'WHATSAPP';
    }

    /**
     * Envia uma mensagem de TEXTO SIMPLES via WhatsApp
     * @param notification Objeto de notificação contendo os dados do destinatário e mensagem
     * @returns Objeto com o ID da mensagem enviada (ou null)
     * @throws Error em caso de falha no envio
     */
    async sendMessage(notification: Notification): Promise<{ messageId: string | null }> {
        // Este método agora é APENAS para texto simples, usando /send-text
        try {
            this.logger.debug(
                `[sendMessage] Iniciando envio de texto simples para ${notification.sellers?.telefone}`,
            );

            const canSend = await this.rateLimiter.checkRateLimit(notification.sellers?.id);
            if (!canSend) throw new Error('Rate limit exceeded');

            const sanitizedContent = this.validationService.sanitizeContent(notification.content);
            const formattedPhone = this.formatPhoneNumber(notification.sellers?.telefone);

            const body = { phone: formattedPhone, message: sanitizedContent };
            const endpoint = '/send-text';

            const response = await this.sendToZApi(endpoint, body);

            this.logger.debug(`[sendMessage] Resposta da API (${endpoint}):
                Status: ${response.status}
                Data: ${JSON.stringify(response.data, null, 2)}
            `);

            const messageId = response.data?.id || response.data?.zaapId || null;
            if (!messageId) {
                this.logger.warn(
                    `[sendMessage] API Z-API (${endpoint}) não retornou ID conhecido.`,
                );
            }
            return { messageId: typeof messageId === 'string' ? messageId : null };
        } catch (error) {
            this.handleApiError('[sendMessage]', error);
            throw error;
        }
    }

    /**
     * Envia uma notificação de CONTRATO (com link) via WhatsApp
     * Usa o endpoint /send-link com a estrutura correta.
     */
    async sendContractNotification(
        phoneNumber: string,
        params: ContractNotificationParams,
    ): Promise<{ success: boolean; messageId?: string | null; error?: string }> {
        try {
            // INSPEÇÃO DETALHADA: Vamos verificar exatamente o que estamos recebendo
            this.logger.log(
                `[Z-API] INSPEÇÃO COMPLETA DOS PARÂMETROS RECEBIDOS:
                Phone: ${phoneNumber}
                RazaoSocial: "${params.razaoSocial}"
                ContractUrl: ${params.contractUrl}
                MessageContent presente? ${params.messageContent ? 'SIM' : 'NÃO'}
                MessageContent (truncado): "${params.messageContent?.substring(0, 200)}..."
                Tamanho do MessageContent: ${params.messageContent?.length || 0} caracteres
                Tentativa: ${params.notificationAttempts || 'Não informado'}`,
            );

            this.logger.log(
                `[Z-API] Iniciando envio para ${phoneNumber} - Contrato: ${params.contractUrl}`,
            );
            this.logger.log(
                `[Z-API] Configuração: BaseURL=${this.instanceApi.split('/instances')[0]}, InstanceID=***`,
            );
            this.logger.debug(
                `[Z-API] Parâmetros detalhados: ${JSON.stringify({
                    ...params,
                    contractUrl: params.contractUrl.substring(0, 30) + '...', // Truncar URL longa
                })}`,
            );

            // Valida os parâmetros
            const validation = this.validationService.validateContractNotificationParams(params);
            if (!validation.isValid || !params.contractUrl) {
                const error = `Parâmetros inválidos para notificação de contrato: ${validation.error || 'URL do contrato ausente'}`;
                this.logger.error(`[Z-API] ${error}`);
                return { success: false, error };
            }

            // Substitui os parâmetros pelos validados, mas mantém o messageContent original
            const validatedParams = {
                ...validation.params,
                messageContent: params.messageContent, // Garante que o conteúdo original da mensagem seja mantido
            };

            // Rate Limit
            const canSend = await this.rateLimiter.checkRateLimit(params.sellerId);
            if (!canSend) {
                const error = 'Rate limit exceeded';
                this.logger.error(`[Z-API] ${error}`);
                return { success: false, error };
            }

            // Formatação do telefone - ponto crítico de falha
            let formattedPhone;
            try {
                formattedPhone = this.formatPhoneNumber(phoneNumber);
                this.logger.log(
                    `[Z-API] Telefone original: ${phoneNumber} -> Formatado: ${formattedPhone}`,
                );
            } catch (phoneError) {
                this.logger.error(`[Z-API] Falha ao formatar telefone: ${phoneError.message}`);
                return {
                    success: false,
                    error: `Formato de telefone inválido: ${phoneError.message}`,
                };
            }

            // Usa a mensagem fornecida pelo parâmetro messageContent, se disponível, ou cria uma mensagem padrão
            // Log do conteúdo da mensagem para debug
            this.logger.log(
                `[Z-API] messageContent disponível: ${validatedParams.messageContent ? 'SIM' : 'NÃO'}`,
            );
            if (validatedParams.messageContent) {
                this.logger.log(
                    `[Z-API] Primeiros 50 caracteres da mensagem personalizada: ${validatedParams.messageContent.substring(0, 50)}...`,
                );
            }

            // Determina o template da mensagem baseado no número da tentativa
            const attemptNumber = params.notificationAttempts || 1;
            let messageTemplate: string;

            switch (attemptNumber) {
                case 1:
                    messageTemplate = CONTRACT_NOTIFICATION_TEMPLATES.FIRST_ATTEMPT(
                        validatedParams.razaoSocial,
                        validatedParams.contractUrl,
                    );
                    break;

                case 2:
                    messageTemplate = CONTRACT_NOTIFICATION_TEMPLATES.SECOND_ATTEMPT(
                        validatedParams.razaoSocial,
                        validatedParams.contractUrl,
                    );
                    break;

                case 3:
                    messageTemplate = CONTRACT_NOTIFICATION_TEMPLATES.THIRD_ATTEMPT(
                        validatedParams.razaoSocial,
                        validatedParams.contractUrl,
                    );
                    break;

                default:
                    throw new Error(`Tentativa inválida: ${attemptNumber}. Deve ser entre 1 e 3.`);
            }

            // Usa a mensagem personalizada se disponível, caso contrário usa o template
            const finalMessage = validatedParams.messageContent || messageTemplate;

            // SOLUÇÃO: Abandonamos o endpoint /send-link e usamos SEMPRE /send-text
            // A API Z-API ignora nossa mensagem personalizada quando usamos /send-link
            this.logger.log(
                `[Z-API] Usando endpoint /send-text para preservar formatação personalizada da mensagem`,
            );

            // Configuração para texto simples
            const textPayload = {
                phone: formattedPhone,
                message: finalMessage, // Mensagem completa (com link incluído)
            };

            this.logger.debug(
                `[Z-API] Payload montado para a requisição:
                    ${JSON.stringify(
                        {
                            ...textPayload,
                            message: textPayload.message.substring(0, 100) + '...', // Truncar para o log
                        },
                        null,
                        2,
                    )}`,
            );

            // Enviamos usando o endpoint de texto simples para preservar nossa formatação
            const response = await this.sendToZApi('/send-text', textPayload);

            this.logger.log(`[Z-API] Resposta recebida - Status: ${response.status}`);
            this.logger.debug(`[Z-API] Resposta completa: ${JSON.stringify(response.data)}`);

            if (!response.data) {
                const error = 'Resposta inválida da API Z-API';
                this.logger.error(`[Z-API] ${error}`);
                return { success: false, error };
            }

            try {
                // Verificamos se a URL do contrato já está incluída na mensagem personalizada
                const urlIncludedInMessage =
                    validatedParams.messageContent &&
                    validatedParams.messageContent.includes(validatedParams.contractUrl);

                this.logger.log(
                    `[Z-API] Link incluído na mensagem: ${urlIncludedInMessage ? 'SIM' : 'NÃO'}`,
                );

                // Se temos uma mensagem personalizada, usamos ela como base
                const messageContent =
                    validatedParams.messageContent ||
                    `Olá ${validatedParams.razaoSocial},\n\nSeu contrato está pronto para assinatura.`;

                // Para envio com link, garantimos que o link esteja no final da mensagem
                // Se não estiver, adicionamos automaticamente
                const finalMessage = urlIncludedInMessage
                    ? messageContent
                    : `${messageContent}\n\nAcesse: ${validatedParams.contractUrl}`;

                // SOLUÇÃO: Abandonamos o endpoint /send-link e usamos SEMPRE /send-text
                // A API Z-API ignora nossa mensagem personalizada quando usamos /send-link
                this.logger.log(
                    `[Z-API] Usando endpoint /send-text para preservar formatação personalizada da mensagem`,
                );

                // Configuração para texto simples
                const textPayload = {
                    phone: formattedPhone,
                    message: finalMessage, // Mensagem completa (com link incluído)
                };

                this.logger.debug(
                    `[Z-API] Payload montado para a requisição:
                        ${JSON.stringify(
                            {
                                ...textPayload,
                                message: textPayload.message.substring(0, 100) + '...', // Truncar para o log
                            },
                            null,
                            2,
                        )}`,
                );

                // Enviamos usando o endpoint de texto simples para preservar nossa formatação
                const response = await this.sendToZApi('/send-text', textPayload);

                this.logger.log(`[Z-API] Resposta recebida - Status: ${response.status}`);
                this.logger.debug(`[Z-API] Resposta completa: ${JSON.stringify(response.data)}`);

                if (!response.data) {
                    const error = 'Resposta inválida da API Z-API';
                    this.logger.error(`[Z-API] ${error}`);
                    return { success: false, error };
                }

                const messageId = response.data?.id || response.data?.zaapId || null;
                if (!messageId) {
                    const error = 'API Z-API não retornou ID da mensagem';
                    this.logger.error(`[Z-API] ${error}`);
                    return { success: false, error };
                }

                this.logger.log(`[Z-API] ✅ Mensagem enviada com sucesso. ID: ${messageId}`);
                return { success: true, messageId };
            } catch (apiError) {
                this.logger.error(`[Z-API] ❌ Erro na API Z-API: ${apiError.message}`);
                // Extrair detalhes específicos da API se disponíveis
                let errorDetail = apiError.message;
                if (apiError.response?.data) {
                    errorDetail = JSON.stringify(apiError.response.data);
                    this.logger.error(`[Z-API] Detalhes do erro: ${errorDetail}`);
                }
                return { success: false, error: `Erro na API Z-API: ${errorDetail}` };
            }
        } catch (error) {
            this.logger.error(`[Z-API] ❌ Erro geral no envio: ${error.message}`, error.stack);
            return { success: false, error: error.message };
        }
    }

    /**
     * Método centralizado para enviar requisições à Z-API
     * @param endpoint Ex: '/send-text' ou '/send-link'
     * @param body Objeto do corpo da requisição
     */
    private async sendToZApi(endpoint: string, payload: any) {
        try {
            const url = `${this.instanceApi}${endpoint}`;

            // INSPEÇÃO DETALHADA - Verificar exatamente o que está sendo enviado
            if (endpoint === '/send-text') {
                this.logger.log(
                    `[sendToZApi] INSPEÇÃO COMPLETA do payload para /send-text:
                    Phone: ${payload.phone}
                    Message (primeiros 500 caracteres):
                    "${payload.message.substring(0, 500)}"
                    Tamanho total da mensagem: ${payload.message.length} caracteres
                    `,
                );
            }

            this.logger.log(`[sendToZApi] Iniciando requisição para Z-API:
                URL: ${url}
                Method: POST
                Headers: { 'Client-Token': '***', 'Content-Type': 'application/json' }
                Body: ${JSON.stringify(payload, null, 2)}
            `);

            const response = await axios.post(url, payload, {
                headers: {
                    'Client-Token': this.clientToken,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
                validateStatus: (status) => status >= 200 && status < 300,
            });

            this.logger.log(`[sendToZApi] Resposta da Z-API:
                Status: ${response.status}
                Data: ${JSON.stringify(response.data, null, 2)}
            `);

            return response;
        } catch (error) {
            this.handleApiError('sendToZApi', error);
            throw error;
        }
    }

    /**
     * Método centralizado para tratar e logar erros da API
     */
    private handleApiError(context: string, error: any) {
        if (error.response) {
            this.logger.error(`[${context}] Erro na API:
                Status: ${error.response.status}
                Data: ${JSON.stringify(error.response.data, null, 2)}
                Headers: ${JSON.stringify(error.response.headers, null, 2)}
            `);
        } else if (error.request) {
            this.logger.error(`[${context}] Erro na Requisição (sem resposta):
                URL: ${error.config?.url}
                Method: ${error.config?.method}
                Headers: ${JSON.stringify(error.config?.headers, null, 2)}
                Data: ${JSON.stringify(error.config?.data, null, 2)}
            `);
        } else {
            this.logger.error(`[${context}] Erro Geral: ${error.message}`, error.stack);
        }
    }

    /**
     * Verifica o status de uma mensagem enviada
     * @param messageId ID da mensagem a ser verificada
     * @returns Status da mensagem e detalhes adicionais
     */
    async checkMessageStatus(messageId: string): Promise<{
        status: string;
        details?: any;
    }> {
        const endpoint = `/message-status/${messageId}`;
        try {
            const url = `${this.instanceApi}${endpoint}`;
            this.logger.debug(`[checkMessageStatus] Verificando status:
                URL: ${url}
                MessageId: ${messageId}
            `);
            const response = await axios.get(url, {
                headers: {
                    'Client-Token': this.configService.get<string>('ZAPI_CLIENT_TOKEN'),
                },
                timeout: 10000,
            });

            this.logger.debug(`[checkMessageStatus] Resposta do status:
                Status: ${response.status}
                Data: ${JSON.stringify(response.data, null, 2)}
            `);
            return { status: response.data?.status || 'UNKNOWN', details: response.data };
        } catch (error) {
            this.handleApiError(
                `[checkMessageStatus] Erro ao verificar status para ${messageId}`,
                error,
            );
            return { status: 'ERROR' };
        }
    }

    /**
     * Formata o número de telefone para o padrão internacional
     * @param phone Número de telefone a ser formatado
     * @returns Número formatado com código do país
     */
    private formatPhoneNumber(phone: string): string {
        if (!phone) {
            throw new Error('Número de telefone não fornecido');
        }

        // Remove todos os caracteres não numéricos
        const numbers = phone.replace(/\D/g, '');

        // Log detalhado para diagnóstico
        this.logger.debug(
            `[formatPhoneNumber] Número original: "${phone}", após limpeza: "${numbers}"`,
        );

        // Verifica comprimento válido
        if (numbers.length < 10 || numbers.length > 13) {
            throw new Error(
                `Número de telefone "${phone}" inválido. ` +
                    `Após limpeza: "${numbers}" (${numbers.length} dígitos). ` +
                    `Esperado: DDD + número (com 9 dígitos), total de 10-11 dígitos sem código do país`,
            );
        }

        // Se já tem código do país (55 para Brasil)
        if (numbers.startsWith('55') && numbers.length >= 12) {
            return numbers;
        }

        // Se tem o formato brasileiro padrão (com 9 na frente para celular)
        if (numbers.length === 11 || numbers.length === 10) {
            return `55${numbers}`;
        }

        // Outros formatos podem precisar de tratamento específico
        throw new Error(
            `Formato de telefone "${phone}" (limpo: "${numbers}") não reconhecido. ` +
                `Formato esperado: DDD + número (10-11 dígitos) ou +55 + DDD + número`,
        );
    }
}
