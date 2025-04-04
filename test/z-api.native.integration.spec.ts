import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from '../src/modules/integration/whatsapp/services/whatsapp.service';
import { RateLimiterService } from '../src/shared/services/rate-limiter.service';
import { ValidationService } from '../src/shared/services/validation.service';
import { Notification } from '../src/modules/contract-management/notification/entities/notification.entity';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carrega as variáveis de ambiente do .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

describe('Z-API Native Integration', () => {
    let app: INestApplication;
    let whatsappService: WhatsAppService;

    beforeAll(async () => {
        console.log('Iniciando setup do módulo de teste...');

        // Verifica se as variáveis necessárias estão presentes
        const requiredEnvVars = [
            'ZAPI_BASE_URL',
            'ZAPI_INSTANCE_ID',
            'ZAPI_TOKEN',
            'ZAPI_CLIENT_TOKEN',
        ];

        const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
        if (missingVars.length > 0) {
            throw new Error(
                `Variáveis de ambiente necessárias não encontradas: ${missingVars.join(', ')}`,
            );
        }

        console.log('Variáveis de ambiente carregadas:');
        console.log('ZAPI_BASE_URL:', process.env.ZAPI_BASE_URL);
        console.log('ZAPI_INSTANCE_ID:', process.env.ZAPI_INSTANCE_ID);
        console.log('ZAPI_TOKEN:', process.env.ZAPI_TOKEN);
        console.log('ZAPI_CLIENT_TOKEN:', process.env.ZAPI_CLIENT_TOKEN);

        const moduleFixture: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: ConfigService,
                    useValue: {
                        get: (key: string) => {
                            console.log(`ConfigService.get chamado com key: ${key}`);
                            const value = process.env[key];
                            console.log(`Valor retornado para ${key}: ${value}`);
                            return value;
                        },
                    },
                },
                WhatsAppService,
                RateLimiterService,
                ValidationService,
            ],
        }).compile();

        console.log('Módulo compilado, criando aplicação...');
        app = moduleFixture.createNestApplication();
        await app.init();
        console.log('Aplicação inicializada');

        whatsappService = moduleFixture.get<WhatsAppService>(WhatsAppService);
        console.log('Serviços obtidos do módulo');
    });

    afterAll(async () => {
        if (app) {
            console.log('Fechando aplicação...');
            await app.close();
            console.log('Aplicação fechada');
        }
    });

    it('should send a message via Z-API natively', async () => {
        console.log('Iniciando teste de envio de mensagem nativa...');

        // Arrange
        const notification = new Notification();
        notification.sellers = {
            id: '123e4567-e89b-12d3-a456-426614174001',
            telefone: '27981090984', // Seu número real
        };
        notification.content = 'Teste de integração Z-API - Mensagem nativa';

        // Act
        console.log('Enviando mensagem...');
        try {
            const result = await whatsappService.sendMessage(notification);
            console.log('Mensagem enviada:', result);

            // Assert
            expect(result).toBeDefined();
            expect(result.messageId).toBeDefined();
            console.log('Mensagem enviada com sucesso. ID:', result.messageId);

            // // Verificar status da mensagem após 5 segundos (REMOVIDO - Endpoint inválido na Z-API)
            // await new Promise((resolve) => setTimeout(resolve, 5000));
            // const status = await whatsappService.checkMessageStatus(result.messageId);
            // console.log('Status da mensagem:', status);
            // expect(status.status).toBeDefined();
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error.response?.data || error.message);
            throw error;
        }
    });
});
