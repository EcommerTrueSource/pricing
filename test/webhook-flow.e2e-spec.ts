import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/services/prisma.service';
import { EContractStatus } from '../src/modules/contract-management/contract/enums/contract-status.enum';
import { ENotificationStatus } from '../src/modules/contract-management/notification/enums/notification-status.enum';
import { ConfigModule } from '@nestjs/config';
import { RateLimiterModule } from '../src/shared/modules/rate-limiter.module';
import { ValidationModule } from '../src/shared/modules/validation.module';
import { IntegrationModule } from '../src/modules/integration/integration.module';
import { NotificationModule } from '../src/modules/contract-management/notification/notification.module';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

describe('WebhookFlow (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    // Dados recebidos do webhook
    const webhookData = {
        cnpj: '38308523000172', // CNPJ válido da VIVO
        email: 'gabrielnfc@gmail.com',
        telefone: '27992594304',
    };

    beforeAll(async () => {
        console.log('🔄 Iniciando configuração dos testes...');

        // Carrega as variáveis de ambiente
        const envModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.local',
                }),
            ],
        }).compile();

        const tempConfigService = envModule.get<ConfigService>(ConfigService);

        // Verifica se as variáveis necessárias estão presentes
        const requiredEnvVars = [
            'ZAPI_BASE_URL',
            'ZAPI_INSTANCE_ID',
            'ZAPI_TOKEN',
            'ZAPI_CLIENT_TOKEN',
            'REDIS_HOST',
            'REDIS_PORT',
            'REDIS_PASSWORD',
        ];

        const missingVars = requiredEnvVars.filter((varName) => !tempConfigService.get(varName));
        if (missingVars.length > 0) {
            throw new Error(
                `Variáveis de ambiente necessárias não encontradas: ${missingVars.join(', ')}`,
            );
        }

        console.log('Configurações da Z-API:');
        console.log('ZAPI_BASE_URL:', tempConfigService.get('ZAPI_BASE_URL'));
        console.log('ZAPI_INSTANCE_ID:', tempConfigService.get('ZAPI_INSTANCE_ID'));
        console.log('ZAPI_TOKEN:', tempConfigService.get('ZAPI_TOKEN'));
        console.log('ZAPI_CLIENT_TOKEN:', tempConfigService.get('ZAPI_CLIENT_TOKEN'));

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                AppModule,
                RateLimiterModule,
                ValidationModule,
                IntegrationModule,
                NotificationModule,
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.local',
                }),
                BullModule.forRoot({
                    redis: {
                        host: tempConfigService.get('REDIS_HOST'),
                        port: parseInt(tempConfigService.get('REDIS_PORT')),
                        password: tempConfigService.get('REDIS_PASSWORD'),
                        tls: tempConfigService.get('REDIS_TLS') === 'true' ? {} : undefined,
                    },
                }),
                BullModule.registerQueue({
                    name: 'notifications',
                    defaultJobOptions: {
                        attempts: 5,
                        backoff: {
                            type: 'exponential',
                            delay: 5000,
                        },
                        removeOnComplete: true,
                        removeOnFail: false,
                    },
                    redis: {
                        host: tempConfigService.get('REDIS_HOST'),
                        port: parseInt(tempConfigService.get('REDIS_PORT')),
                        password: tempConfigService.get('REDIS_PASSWORD'),
                        tls: tempConfigService.get('REDIS_TLS') === 'true' ? {} : undefined,
                    },
                }),
            ],
            providers: [],
        }).compile();

        app = moduleFixture.createNestApplication();
        prisma = moduleFixture.get<PrismaService>(PrismaService);

        await app.init();
        console.log('✅ Configuração dos testes concluída');
    });

    afterAll(async () => {
        console.log('🧹 Finalizando testes...');
        if (app) {
            // Apenas fecha a conexão com a aplicação
            // NÃO limpa o banco de dados
            await app.close();
        }
        console.log('✅ Testes finalizados - Banco de dados mantido intacto');
    });

    describe('Fluxo completo do webhook', () => {
        // Aumenta o timeout para 120 segundos
        jest.setTimeout(120000);

        it('deve processar o webhook e criar o fluxo completo', async () => {
            console.log('📤 Enviando webhook com dados:', webhookData);
            // 1. Envia o webhook com os dados básicos
            const webhookResponse = await request(app.getHttpServer())
                .post('/webhook/contract')
                .send(webhookData)
                .expect(201);

            console.log('📥 Resposta do webhook:', webhookResponse.body);

            expect(webhookResponse.body).toEqual({
                success: true,
                message: 'Contrato criado e enviado para assinatura com sucesso',
                data: {
                    contractId: expect.any(String),
                    sellerId: expect.any(String),
                    signingUrl: expect.any(String),
                },
            });

            const { contractId, sellerId } = webhookResponse.body.data;
            console.log('📝 IDs gerados:', { contractId, sellerId });

            // 2. Verifica se o vendedor foi criado/atualizado
            console.log('🔍 Verificando dados do vendedor...');
            const seller = await prisma.sellers.findUnique({
                where: { id: sellerId },
            });

            console.log('📊 Dados do vendedor:', seller);

            expect(seller).toBeDefined();
            expect(seller.email).toBe(webhookData.email);
            expect(seller.telefone).toBe(webhookData.telefone);

            // 3. Verifica se o contrato foi criado
            console.log('🔍 Verificando dados do contrato...');
            const contract = await prisma.contracts.findUnique({
                where: { id: contractId },
            });

            console.log('📊 Dados do contrato:', contract);

            expect(contract).toBeDefined();
            expect(contract.status).toBe(EContractStatus.PENDING_SIGNATURE);
            expect(contract.signing_url).toBeDefined();

            // 4. Verifica se a notificação foi criada
            console.log('🔍 Verificando dados da notificação...');
            const notification = await prisma.notifications.findFirst({
                where: { contract_id: contractId },
                include: { sellers: true },
            });

            console.log('📊 Dados da notificação:', notification);

            expect(notification).toBeDefined();
            expect(notification.status).toBe(ENotificationStatus.PENDING);
            expect(notification.attempt_number).toBe(1);

            // 5. Processa a notificação
            console.log('📱 Processando notificação...');
            try {
                // O NotificationService já adicionou a notificação na fila do Bull
                // Aguardamos o processamento com um loop de verificação
                console.log('⏳ Aguardando processamento da fila...');

                let attempts = 0;
                let updatedNotification;
                const maxAttempts = 30; // 30 tentativas de 2 segundos = 60 segundos no total

                while (attempts < maxAttempts) {
                    updatedNotification = await prisma.notifications.findFirst({
                        where: { id: notification.id },
                    });

                    if (updatedNotification.status === ENotificationStatus.SENT) {
                        console.log('✅ Notificação processada com sucesso');
                        break;
                    }

                    if (updatedNotification.status === ENotificationStatus.FAILED) {
                        console.error('❌ Notificação falhou:', updatedNotification);
                        throw new Error('Notificação falhou ao ser processada');
                    }

                    console.log(
                        `⏳ Aguardando processamento... Tentativa ${attempts + 1}/${maxAttempts}`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                    attempts++;
                }

                if (attempts >= maxAttempts) {
                    throw new Error('Timeout ao aguardar processamento da notificação');
                }

                console.log('📊 Status da notificação após processamento:', updatedNotification);
                expect(updatedNotification.status).toBe(ENotificationStatus.SENT);
            } catch (error) {
                console.error('❌ Erro ao processar notificação:', error);
                throw error;
            }

            // 6. Verifica o histórico de status
            console.log('🔍 Verificando histórico de status...');
            const statusHistory = await prisma.status_history.findMany({
                where: { contract_id: contractId },
            });

            console.log('📊 Histórico de status:', statusHistory);

            expect(statusHistory).toHaveLength(2); // DRAFT -> PENDING_SIGNATURE
        });
    });
});
