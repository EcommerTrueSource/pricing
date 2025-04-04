import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from '../src/modules/integration/whatsapp/services/whatsapp.service';
import { PrismaService } from '../src/shared/services/prisma.service';
import { NotificationService } from '../src/modules/contract-management/notification/services/notification.service';
import { NotificationMapper } from '../src/modules/contract-management/notification/mappers/notification.mapper';
import { getQueueToken } from '@nestjs/bull';
import { ENotificationType } from '../src/modules/contract-management/notification/enums/notification-type.enum';
import { ENotificationChannel } from '../src/modules/contract-management/notification/enums/notification-channel.enum';
import { Notification } from '../src/modules/contract-management/notification/entities/notification.entity';
import { RateLimiterService } from '../src/shared/services/rate-limiter.service';
import { ValidationService } from '../src/shared/services/validation.service';

// Mock do ConfigService
const mockConfigService = {
    get: jest.fn((key: string) => {
        console.log(`ConfigService.get chamado com key: ${key}`);
        switch (key) {
            case 'ZAPI_BASE_URL':
                return 'https://api.z-api.io';
            case 'ZAPI_INSTANCE_ID':
                return '3D365DFC96CDF0F7BB9B528901F28C87';
            case 'ZAPI_TOKEN':
                return 'E25AF825BCF8660BB4FBEAA4';
            case 'ZAPI_CLIENT_TOKEN':
                return 'Ffed328a48d9c4f1baa98f717a0ea3c84S';
            case 'RATE_LIMIT_POINTS':
                return 5;
            case 'RATE_LIMIT_DURATION':
                return 86400;
            case 'ALLOWED_DOMAINS':
                return 'example.com';
            case 'MAX_MESSAGE_LENGTH':
                return 4096;
            default:
                console.log(`ConfigService.get: key não encontrada: ${key}`);
                return undefined;
        }
    }),
};

// Mock do PrismaService
const mockPrismaService = {
    notifications: {
        create: jest.fn().mockImplementation((data) => {
            console.log('PrismaService.notifications.create chamado com:', data);
            return Promise.resolve({
                id: '123e4567-e89b-12d3-a456-426614174002',
                ...data.data,
                status: 'PENDING',
                created_at: new Date(),
            });
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
            console.log('PrismaService.notifications.findUnique chamado com:', where);
            return Promise.resolve({
                id: where.id,
                contract_id: '123e4567-e89b-12d3-a456-426614174000',
                seller_id: '123e4567-e89b-12d3-a456-426614174001',
                type: 'SIGNATURE_REMINDER',
                channel: 'WHATSAPP',
                content: 'Teste de notificação via WhatsApp com mais de 10 caracteres',
                status: 'PENDING',
                attempt_number: 1,
                created_at: new Date(),
            });
        }),
    },
    contracts: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
            console.log('PrismaService.contracts.findUnique chamado com:', where);
            return Promise.resolve({
                id: where.id,
                status: 'PENDING_SIGNATURE',
                created_at: new Date(),
            });
        }),
    },
    sellers: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
            console.log('PrismaService.sellers.findUnique chamado com:', where);
            return Promise.resolve({
                id: where.id,
                telefone: '27992594304', // Seu número real
                created_at: new Date(),
            });
        }),
    },
};

describe('Z-API Integration', () => {
    let app: INestApplication;
    let whatsappService: WhatsAppService;
    let notificationService: NotificationService;

    beforeAll(async () => {
        console.log('Iniciando setup do módulo de teste...');
        const moduleFixture: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
                WhatsAppService,
                NotificationService,
                NotificationMapper,
                RateLimiterService,
                ValidationService,
                {
                    provide: 'MESSAGING_SERVICE',
                    useClass: WhatsAppService,
                },
                {
                    provide: getQueueToken('notifications'),
                    useValue: {
                        add: jest.fn(),
                    },
                },
            ],
        }).compile();

        console.log('Módulo compilado, criando aplicação...');
        app = moduleFixture.createNestApplication();
        await app.init();
        console.log('Aplicação inicializada');

        whatsappService = moduleFixture.get<WhatsAppService>(WhatsAppService);
        notificationService = moduleFixture.get<NotificationService>(NotificationService);
        console.log('Serviços obtidos do módulo');
    });

    afterAll(async () => {
        if (app) {
            console.log('Fechando aplicação...');
            await app.close();
            console.log('Aplicação fechada');
        }
    });

    beforeEach(() => {
        console.log('Limpando mocks...');
        jest.clearAllMocks();
    });

    describe('WhatsApp Service', () => {
        it('should send a message via Z-API successfully', async () => {
            console.log('Iniciando teste de envio de mensagem...');
            console.log('Configurações da Z-API:');
            console.log('Base URL:', mockConfigService.get('ZAPI_BASE_URL'));
            console.log('Instance ID:', mockConfigService.get('ZAPI_INSTANCE_ID'));
            console.log('Token:', mockConfigService.get('ZAPI_TOKEN'));
            console.log('Client Token:', mockConfigService.get('ZAPI_CLIENT_TOKEN'));

            // Arrange
            const notification = new Notification();
            notification.sellers = {
                id: '123e4567-e89b-12d3-a456-426614174001',
                telefone: '27992594304', // Seu número real
            };
            notification.content = 'Teste de integração Z-API - Mensagem real';

            // Act
            console.log('Enviando mensagem...');
            try {
                const result = await whatsappService.sendMessage(notification);
                console.log('Mensagem enviada:', result);

                // Assert
                expect(result).toBeDefined();
                expect(result.messageId).toBeDefined();
                console.log('Mensagem enviada com sucesso. ID:', result.messageId);
            } catch (error) {
                console.error('Erro ao enviar mensagem:', error.response?.data || error.message);
                throw error;
            }
        });
    });

    describe('Notification Service with WhatsApp', () => {
        it('should create and send a notification via WhatsApp', async () => {
            console.log('Iniciando teste de notificação...');
            // Arrange
            const createNotificationDto = {
                contractId: '123e4567-e89b-12d3-a456-426614174000',
                sellerId: '123e4567-e89b-12d3-a456-426614174001',
                type: ENotificationType.SIGNATURE_REMINDER,
                channel: ENotificationChannel.WHATSAPP,
                content: 'Teste de notificação via WhatsApp - Mensagem real',
                attemptNumber: 1,
            };

            // Act
            console.log('Criando notificação...');
            const notification = await notificationService.create(createNotificationDto);
            console.log('Notificação criada:', notification);

            // Assert
            expect(notification).toBeDefined();
            expect(notification.id).toBeDefined();
            expect(notification.status).toBe('PENDING');
            console.log('Notificação criada com sucesso. ID:', notification.id);
        });
    });
});
