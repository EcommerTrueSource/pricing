import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { RateLimiterService } from '../../../shared/services/rate-limiter.service';
import { ValidationService } from '../../../shared/services/validation.service';
import { IMessagingService } from '../../contract-management/notification/interfaces/messaging-service.interface';
import { Notification } from '../../contract-management/notification/entities/notification.entity';

interface ContractNotificationParams {
    razaoSocial: string;
    contractUrl: string;
    sellerId: string;
    notificationAttempts: number;
}

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
            this.logger.debug(`[sendContractNotification] Iniciando envio para ${phoneNumber}`);

            // Valida os parâmetros
            const validation = this.validationService.validateContractNotificationParams(params);
            if (!validation.isValid || !params.contractUrl) {
                throw new Error(
                    `Parâmetros inválidos para notificação de contrato: ${validation.error || 'URL do contrato ausente'}`,
                );
            }

            // Rate Limit
            const canSend = await this.rateLimiter.checkRateLimit(params.sellerId);
            if (!canSend) {
                throw new Error('Rate limit exceeded');
            }

            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            const contractUrl = params.contractUrl;

            // Monta a mensagem
            const messageText = `Olá ${params.razaoSocial},\n\nSeu contrato está pronto para assinatura.\nAcesse: ${contractUrl}`;

            // Payload para o Z-API
            const linkPayload = {
                phone: formattedPhone,
                message: messageText,
                image: 'https://via.placeholder.com/150/0000FF/808080?text=Contrato',
                linkUrl: contractUrl,
                title: 'Contrato Eletrônico',
                linkDescription: `Contrato para ${params.razaoSocial}`,
            };

            const endpoint = '/send-link';
            const response = await this.sendToZApi(endpoint, linkPayload);

            this.logger.debug(`[sendContractNotification] Resposta da API (${endpoint}):
                Status: ${response.status}
                Data: ${JSON.stringify(response.data, null, 2)}
            `);

            if (!response.data) {
                throw new Error('Resposta inválida da API Z-API');
            }

            const messageId = response.data?.id || response.data?.zaapId || null;
            if (!messageId) {
                throw new Error('API Z-API não retornou ID da mensagem');
            }

            return { success: true, messageId };
        } catch (error) {
            this.logger.error(
                `[sendContractNotification] Erro ao enviar notificação para ${phoneNumber}: ${error.message}`,
                error.stack,
            );
            throw error; // Propaga o erro para ser tratado pelo NotificationProcessor
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

            this.logger.debug(`Enviando requisição para Z-API:
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

            this.logger.debug(`Resposta da Z-API:
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
            this.logger.error(`${context} - Erro na API:
                Status: ${error.response.status}
                Data: ${JSON.stringify(error.response.data, null, 2)}
                Headers: ${JSON.stringify(error.response.headers, null, 2)}
            `);
        } else if (error.request) {
            this.logger.error(`${context} - Erro na Requisição (sem resposta):
                URL: ${error.config?.url}
                Method: ${error.config?.method}
                Headers: ${JSON.stringify(error.config?.headers, null, 2)}
                Data: ${JSON.stringify(error.config?.data, null, 2)}
            `);
        } else {
            this.logger.error(`${context} - Erro Geral: ${error.message}`, error.stack);
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
        const numbers = phone.replace(/\D/g, '');
        if (numbers.startsWith('55')) {
            return numbers;
        }
        if (numbers.length === 11) {
            return `55${numbers}`;
        }
        throw new Error(`Número de telefone inválido: ${phone}. Formato esperado: DDD + 9 dígitos`);
    }
}
