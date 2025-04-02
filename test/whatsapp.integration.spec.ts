import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppService } from '../src/modules/integration/services/whatsapp.service';
import { RateLimiterService } from '../src/shared/services/rate-limiter.service';
import { ValidationService } from '../src/shared/services/validation.service';

describe('WhatsApp Integration Tests', () => {
    let whatsappService: WhatsAppService;
    let rateLimiterService: RateLimiterService;
    let validationService: ValidationService;

    beforeAll(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.local',
                }),
            ],
            providers: [WhatsAppService, RateLimiterService, ValidationService],
        }).compile();

        whatsappService = module.get<WhatsAppService>(WhatsAppService);
        rateLimiterService = module.get<RateLimiterService>(RateLimiterService);
        validationService = module.get<ValidationService>(ValidationService);
    });

    it('should send a test message', async () => {
        const phoneNumber = '27992594304';
        const message = 'Teste de integração com WhatsApp';

        console.log('Iniciando teste de envio de mensagem...');
        console.log('Número:', phoneNumber);
        console.log('Mensagem:', message);

        const result = await whatsappService.sendMessage(phoneNumber, message);

        console.log('Resultado do envio:', result);

        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();

        if (result.success) {
            const status = await whatsappService.checkMessageStatus(result.messageId);
            console.log('Status da mensagem:', status);
            expect(status).toBeDefined();
        }
    });

    it('should send a contract notification', async () => {
        const phoneNumber = '27992594304';
        const params = {
            sellerId: 'test-seller-id',
            razaoSocial: 'Empresa Teste LTDA',
            contractUrl: 'https://autentique.com.br/contrato/123',
        };

        console.log('Iniciando teste de notificação de contrato...');
        console.log('Número:', phoneNumber);
        console.log('Parâmetros:', params);

        const result = await whatsappService.sendContractNotification(phoneNumber, {
            ...params,
            notificationAttempts: 1,
        });

        console.log('Resultado da notificação:', result);

        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();

        if (result.success) {
            const status = await whatsappService.checkMessageStatus(result.messageId);
            console.log('Status da mensagem:', status);
            expect(status).toBeDefined();
        }
    });

    it('should handle rate limiting', async () => {
        const phoneNumber = '27992594304';
        const params = {
            sellerId: 'test-seller-id',
            razaoSocial: 'Empresa Teste LTDA',
            contractUrl: 'https://autentique.com.br/contrato/123',
        };

        // Enviar múltiplas mensagens para testar o rate limit
        const results = await Promise.all(
            Array(6)
                .fill(null)
                .map(() =>
                    whatsappService.sendContractNotification(phoneNumber, {
                        ...params,
                        notificationAttempts: 1,
                    }),
                ),
        );

        // Verificar se a última mensagem foi bloqueada pelo rate limit
        const lastResult = results[results.length - 1];
        expect(lastResult.success).toBe(false);
        expect(lastResult.error).toContain('Rate limit exceeded');

        // Resetar o rate limit para testes futuros
        await rateLimiterService.resetRateLimit('test-seller-id');
    });

    it('should validate contract notification parameters', async () => {
        const params = {
            sellerId: 'test-seller-id',
            razaoSocial: 'Empresa Teste LTDA',
            contractUrl: 'https://malicious-site.com/contrato/123',
        };

        const validation = await validationService.validateContractNotificationParams(params);
        expect(validation.isValid).toBe(false);
        expect(validation.params).toBeUndefined();

        const validParams = {
            sellerId: 'test-seller-id',
            razaoSocial: 'Empresa Teste LTDA',
            contractUrl: 'https://autentique.com.br/contrato/123',
        };

        const validValidation =
            await validationService.validateContractNotificationParams(validParams);
        expect(validValidation.isValid).toBe(true);
        expect(validValidation.params).toBeDefined();
    });
});
