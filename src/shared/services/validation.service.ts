import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ContractNotificationParams {
    razaoSocial: string;
    contractUrl: string;
}

interface ValidationResult {
    isValid: boolean;
    params?: ContractNotificationParams;
    error?: string;
}

@Injectable()
export class ValidationService {
    private readonly logger = new Logger(ValidationService.name);
    private readonly allowedDomains: string[];

    constructor(private readonly configService: ConfigService) {
        this.allowedDomains = this.configService.get<string>('ALLOWED_DOMAINS', '').split(',');
    }

    /**
     * Valida se uma URL é segura e pertence aos domínios permitidos
     * @param url URL a ser validada
     * @returns boolean indicando se a URL é válida
     */
    validateUrl(url: string): boolean {
        try {
            const parsedUrl = new URL(url);

            // Verifica se o domínio está na lista de permitidos
            if (
                this.allowedDomains.length > 0 &&
                !this.allowedDomains.includes(parsedUrl.hostname)
            ) {
                this.logger.warn(`URL com domínio não permitido: ${parsedUrl.hostname}`);
                return false;
            }

            // Verifica se é HTTPS
            if (parsedUrl.protocol !== 'https:') {
                this.logger.warn(`URL não usa HTTPS: ${url}`);
                return false;
            }

            return true;
        } catch (error) {
            this.logger.error(`URL inválida: ${url}`);
            return false;
        }
    }

    /**
     * Sanitiza o conteúdo de uma mensagem
     * @param content Conteúdo a ser sanitizado
     * @returns Conteúdo sanitizado
     */
    sanitizeContent(content: string): string {
        // Remove caracteres especiais perigosos
        let sanitized = content
            .replace(/[<>]/g, '') // Remove tags HTML
            .replace(/javascript:/gi, '') // Remove protocolos JavaScript
            .replace(/data:/gi, '') // Remove protocolos Data
            .replace(/vbscript:/gi, '') // Remove protocolos VBScript
            .replace(/on\w+=/gi, '') // Remove eventos inline
            .replace(/on\w+="[^"]*"/gi, '') // Remove eventos inline com aspas
            .replace(/on\w+='[^']*'/gi, ''); // Remove eventos inline com aspas simples

        // Limita o tamanho da mensagem
        const maxLength = this.configService.get<number>('MAX_MESSAGE_LENGTH', 4096);
        if (sanitized.length > maxLength) {
            this.logger.warn(`Mensagem truncada: ${sanitized.length} > ${maxLength} caracteres`);
            sanitized = sanitized.substring(0, maxLength) + '...';
        }

        return sanitized;
    }

    /**
     * Valida e sanitiza os parâmetros de uma notificação de contrato
     * @param params Parâmetros da notificação
     * @returns Parâmetros validados e sanitizados
     */
    validateContractNotificationParams(params: ContractNotificationParams): ValidationResult {
        if (!params.razaoSocial || params.razaoSocial.trim().length === 0) {
            return {
                isValid: false,
                error: 'Razão social é obrigatória',
            };
        }

        if (!params.contractUrl || params.contractUrl.trim().length === 0) {
            return {
                isValid: false,
                error: 'URL do contrato é obrigatória',
            };
        }

        try {
            new URL(params.contractUrl);
        } catch (error) {
            return {
                isValid: false,
                error: 'URL do contrato inválida',
            };
        }

        return {
            isValid: true,
            params,
        };
    }
}
