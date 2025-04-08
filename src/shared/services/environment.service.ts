import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Serviço responsável por ajustar automaticamente variáveis de ambiente
 * dependendo do ambiente em que a aplicação está rodando (local, Cloud Run, etc.)
 */
@Injectable()
export class EnvironmentService implements OnModuleInit {
    private readonly logger = new Logger(EnvironmentService.name);
    private isCloudRun: boolean;
    private serviceUrl: string;

    constructor(private readonly configService: ConfigService) {
        // Detecta se estamos em ambiente Cloud Run
        this.isCloudRun = !!process.env.K_SERVICE;

        // Define a URL base do serviço
        if (this.isCloudRun) {
            // Em Cloud Run, usa a URL do serviço ou constrói com base no nome do serviço
            this.serviceUrl =
                process.env.K_SERVICE_URL ||
                `https://pricing-460815276546.southamerica-east1.run.app`;
        } else {
            // Em ambiente local, usa o endereço padrão
            this.serviceUrl = 'http://localhost:3000';
        }
    }

    /**
     * Inicializa o serviço, fazendo os ajustes necessários nas variáveis de ambiente
     */
    async onModuleInit() {
        if (this.isCloudRun) {
            this.logger.log('Detectado ambiente Cloud Run - ajustando variáveis de ambiente');
            this.adjustEnvironmentVariables();
        } else {
            this.logger.log('Ambiente de desenvolvimento local detectado');
        }
    }

    /**
     * Ajusta todas as variáveis de ambiente que precisam ser modificadas no Cloud Run
     */
    private adjustEnvironmentVariables() {
        // Ajusta a URL de callback do Google
        this.adjustGoogleCallbackUrl();

        // Ajusta a URL do frontend
        this.adjustFrontendUrl();

        // Ajusta o JWT Secret se for um valor padrão/inseguro
        this.ensureSecureJwtSecret();

        // Outros ajustes conforme necessário
        this.logger.log('Variáveis de ambiente ajustadas para ambiente Cloud Run');
    }

    /**
     * Ajusta a URL de callback do Google para usar a URL do Cloud Run
     */
    private adjustGoogleCallbackUrl() {
        const currentUrl = process.env.GOOGLE_CALLBACK_URL;

        if (currentUrl?.includes('localhost') || !currentUrl) {
            // Importante: incluir o prefixo /api/ no caminho conforme configurado no main.ts
            const newUrl = `${this.serviceUrl}/api/auth/google/callback`;
            process.env.GOOGLE_CALLBACK_URL = newUrl;
            this.logger.log(`GOOGLE_CALLBACK_URL ajustada para ${this.maskUrl(newUrl)}`);

            // Registra a URL para depuração
            this.logger.log(
                `IMPORTANTE: Certifique-se de que esta URL está autorizada no console do Google Cloud: ${this.maskUrl(newUrl)}`,
            );
        }
    }

    /**
     * Ajusta a URL do frontend para não usar localhost em ambiente de produção
     */
    private adjustFrontendUrl() {
        const currentUrl = process.env.FRONTEND_URL;

        if (currentUrl?.includes('localhost')) {
            // Supondo que o frontend também esteja em produção
            // Idealmente, isso seria configurado adequadamente no secret
            const newUrl = this.serviceUrl.replace('pricing-', 'pricing-frontend-');
            process.env.FRONTEND_URL = newUrl;
            this.logger.log(
                `FRONTEND_URL ajustada de ${this.maskUrl(currentUrl)} para ${this.maskUrl(newUrl)}`,
            );
        }
    }

    /**
     * Garante que o JWT_SECRET não seja um valor padrão inseguro
     */
    private ensureSecureJwtSecret() {
        const currentSecret = process.env.JWT_SECRET;

        if (currentSecret === 'your-secret-key' || !currentSecret) {
            // Gera um secret aleatório baseado no timestamp e valores aleatórios
            const newSecret = `production-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            process.env.JWT_SECRET = newSecret;
            this.logger.log('JWT_SECRET inseguro substituído por um valor gerado aleatoriamente');
        }
    }

    /**
     * Mascara parte de uma URL para exibição segura em logs
     */
    private maskUrl(url: string): string {
        if (!url) return 'undefined';

        try {
            // Tenta criar um objeto URL para manipular
            const urlObj = new URL(url);
            // Retorna apenas o hostname e o pathname, sem query params que podem conter dados sensíveis
            return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
        } catch (e) {
            return 'url inválida';
        }
    }
}
