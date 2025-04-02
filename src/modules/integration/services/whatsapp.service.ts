import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { RateLimiterService } from '../../../shared/services/rate-limiter.service';
import { ValidationService } from '../../../shared/services/validation.service';

interface ZApiResponse {
    zaapId: string;
    messageId: string;
    id: string;
}

interface ContractNotificationParams {
    razaoSocial: string;
    contractUrl: string;
    sellerId: string;
    notificationAttempts: number;
}

@Injectable()
export class WhatsAppService {
    private readonly logger = new Logger(WhatsAppService.name);
    private readonly baseUrl: string;
    private readonly instanceId: string;
    private readonly instanceToken: string;
    private readonly clientToken: string;
    private readonly MAX_RETRIES = 3;
    private readonly INITIAL_DELAY = 1000;

    constructor(
        private readonly configService: ConfigService,
        private readonly rateLimiter: RateLimiterService,
        private readonly validationService: ValidationService,
    ) {
        this.baseUrl = this.configService.get<string>('ZAPI_BASE_URL');
        this.instanceId = this.configService.get<string>('ZAPI_INSTANCE_ID');
        this.instanceToken = this.configService.get<string>('ZAPI_TOKEN');
        this.clientToken = this.configService.get<string>('ZAPI_CLIENT_TOKEN');
    }

    async sendContractNotification(
        phoneNumber: string,
        params: ContractNotificationParams,
    ): Promise<{ success: boolean; messageId?: string; error?: string }> {
        // Validação de segurança
        if (!this.validatePhoneNumber(phoneNumber)) {
            this.logger.error(`Número de telefone inválido: ${phoneNumber}`);
            return { success: false, error: 'Número de telefone inválido' };
        }

        // Verifica rate limit
        const canSend = await this.rateLimiter.checkRateLimit(params.sellerId);
        if (!canSend) {
            this.logger.warn(`Rate limit excedido para o vendedor ${params.sellerId}`);
            return { success: false, error: 'Limite de mensagens excedido' };
        }

        // Valida e sanitiza parâmetros
        const validationResult = this.validationService.validateContractNotificationParams({
            razaoSocial: params.razaoSocial,
            contractUrl: params.contractUrl,
        });

        if (!validationResult.isValid) {
            this.logger.error('Parâmetros da notificação inválidos:', validationResult.error);
            return { success: false, error: validationResult.error };
        }

        try {
            const message = this.getCachedMessage(phoneNumber, {
                ...validationResult.params,
                sellerId: params.sellerId,
                notificationAttempts: params.notificationAttempts,
            });
            return await this.retryWithBackoff(
                () => this.sendMessage(phoneNumber, message),
                this.MAX_RETRIES,
                this.INITIAL_DELAY,
            );
        } catch (error) {
            this.logger.error('Erro ao enviar notificação:', error);
            return { success: false, error: error.message };
        }
    }

    async sendMessage(
        phoneNumber: string,
        message: string,
    ): Promise<{ success: boolean; messageId?: string }> {
        try {
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            this.logger.debug(`Enviando mensagem para ${formattedPhone}`);

            const response = await axios.post<ZApiResponse>(
                `${this.baseUrl}/instances/${this.instanceId}/token/${this.clientToken}/send-text`,
                {
                    phone: formattedPhone,
                    message: message,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            );

            this.logger.debug(`Resposta da API: ${JSON.stringify(response.data)}`);

            if (response.data?.messageId) {
                this.logger.log(`Mensagem enviada com sucesso. ID: ${response.data.messageId}`);
                return { success: true, messageId: response.data.messageId };
            }

            this.logger.error('Resposta da API não contém messageId');
            return { success: false };
        } catch (error) {
            if (error instanceof AxiosError) {
                this.handleApiError(error);
            } else {
                this.logger.error(`Erro ao enviar mensagem: ${error.message}`);
            }
            return { success: false };
        }
    }

    async checkMessageStatus(messageId: string): Promise<{
        status: string;
        details?: any;
    }> {
        try {
            const response = await axios.get(
                `${this.baseUrl}/instances/${this.instanceId}/token/${this.clientToken}/message-status/${messageId}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            );

            this.logger.debug(`Status da mensagem: ${JSON.stringify(response.data)}`);
            return { status: response.data?.status || 'UNKNOWN', details: response.data };
        } catch (error) {
            if (error instanceof AxiosError) {
                this.handleApiError(error);
            } else {
                this.logger.error(`Erro ao verificar status: ${error.message}`);
            }
            return { status: 'ERROR' };
        }
    }

    private formatContractMessage(params: ContractNotificationParams): string {
        return `Olá *${params.razaoSocial}* 👋

Somos da *True Source* e precisamos da sua atenção para uma atualização importante em nossa política de preço mínimo autorizado.

📄 *Contrato para Assinatura*
${params.contractUrl}

⏰ *Prazo para Assinatura:* 15 dias

Além disso, precisamos que você nos informe onde vende nossos produtos. Por favor, preencha o formulário abaixo:
🔗 https://forms.gle/A7y4JjwpA71tjoko7

Em caso de dúvidas, estamos à disposição para ajudar! 🙏

Agradecemos sua parceria! 🤝

Atenciosamente,
Equipe True Source`;
    }

    private formatPhoneNumber(phone: string): string {
        const numbers = phone.replace(/\D/g, '');
        if (numbers.length === 11) {
            return `55${numbers}`;
        }
        return numbers;
    }

    private validatePhoneNumber(phone: string): boolean {
        const numbers = phone.replace(/\D/g, '');
        return numbers.length >= 10 && numbers.length <= 11;
    }

    private async retryWithBackoff<T>(
        operation: () => Promise<T>,
        maxRetries: number = this.MAX_RETRIES,
        initialDelay: number = this.INITIAL_DELAY,
    ): Promise<T> {
        let lastError: Error;
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                const delay = initialDelay * Math.pow(2, i);
                this.logger.warn(
                    `Tentativa ${i + 1} falhou. Aguardando ${delay}ms antes da próxima tentativa.`,
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        throw lastError;
    }

    private handleApiError(error: AxiosError): void {
        if (error.response) {
            switch (error.response.status) {
                case 401:
                    this.logger.error('Erro de autenticação com a API do Z-API');
                    break;
                case 403:
                    this.logger.error('Acesso negado à API do Z-API');
                    break;
                case 404:
                    this.logger.error('Recurso não encontrado na API do Z-API');
                    break;
                case 429:
                    this.logger.error('Rate limit excedido na API do Z-API');
                    break;
                case 500:
                    this.logger.error('Erro interno do servidor Z-API');
                    break;
                default:
                    this.logger.error(
                        `Erro na API do Z-API: ${error.response.status} - ${error.response.data}`,
                    );
            }
        } else if (error.request) {
            this.logger.error('Nenhuma resposta recebida da API do Z-API');
        } else {
            this.logger.error(`Erro ao fazer requisição para Z-API: ${error.message}`);
        }
    }

    private readonly messageCache = new Map<string, string>();

    private getCachedMessage(phoneNumber: string, params: ContractNotificationParams): string {
        const cacheKey = `${phoneNumber}:${params.sellerId}`;
        const cachedMessage = this.messageCache.get(cacheKey);

        if (cachedMessage) {
            return cachedMessage;
        }

        const message = `Olá ${params.razaoSocial}!

Você tem um contrato pendente de assinatura.
${params.contractUrl}

${params.notificationAttempts > 1 ? `Esta é a ${params.notificationAttempts}ª tentativa de contato.` : ''}

Por favor, assine o contrato o mais breve possível.
Em caso de dúvidas, entre em contato com nosso suporte.`;

        this.messageCache.set(cacheKey, message);
        return message;
    }
}
