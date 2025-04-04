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
import { BullModule, getQueueToken } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { ContractReminderScheduler } from '../src/modules/contract-management/scheduler/services/contract-reminder.scheduler';
import { Queue } from 'bull';

describe('WebhookFlow (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let scheduler: ContractReminderScheduler;

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
                            type: 'fixed',
                            delay: 60000,
                        },
                        removeOnComplete: true,
                        removeOnFail: true,
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
        scheduler = moduleFixture.get<ContractReminderScheduler>(ContractReminderScheduler);

        await app.init();
        console.log('✅ Configuração dos testes concluída');
    });

    afterAll(async () => {
        console.log('🧹 Finalizando testes...');
        if (app) {
            try {
                // Fechar a fila Bull antes de fechar o app
                const queue = app.get<Queue>(getQueueToken('notifications'));
                await queue.close();
                console.log('   - Fila Bull fechada');
            } catch (error) {
                console.error('   - Erro ao fechar fila Bull:', error.message);
            }
            // Apenas fecha a conexão com a aplicação
            await app.close();
            console.log('   - Aplicação Nest fechada');
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

            // LOG ADICIONAL: Verificar notificações logo após criação
            const initialNotifications = await prisma.notifications.findMany({
                where: { contract_id: contractId },
                orderBy: { created_at: 'asc' },
            });
            console.log(
                `[TEST LOG - ${new Date().toISOString()}] 🔍 Notificações encontradas IMEDIATAMENTE após webhook para contrato ${contractId}: ${initialNotifications.length}`,
            );
            initialNotifications.forEach((n, index) => {
                console.log(
                    `   - Notificação #${index + 1}: ID=${n.id}, Status=${n.status}, CreatedAt=${n.created_at?.toISOString()}`,
                );
            });

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

            // 5. Verifica se a mensagem inicial contém os elementos corretos
            expect(notification.content).toContain(`Olá *${seller.razao_social}*! 👋`);
            expect(notification.content).toContain('True Source');
            expect(notification.content).toContain('política de preço mínimo autorizado');
            expect(notification.content).toContain(contract.signing_url);
            expect(notification.content).toContain('15 dias');
            expect(notification.content).toContain('forms.gle');

            // 6. Processa a notificação
            console.log('📱 Processando notificação...');
            try {
                // O NotificationService já adicionou a notificação na fila do Bull
                // Aguardamos o processamento com um loop de verificação
                console.log('⏳ Aguardando processamento da fila...');

                let attempts = 0;
                let updatedNotification;
                const maxAttempts = 30; // 30 tentativas de 2 segundos = 60 segundos no total

                while (attempts < maxAttempts) {
                    const currentNotifications = await prisma.notifications.findMany({
                        where: { contract_id: contractId },
                        select: {
                            id: true,
                            status: true,
                            attempt_number: true,
                            created_at: true,
                            content: true,
                        },
                        orderBy: { created_at: 'asc' },
                    });
                    console.log(
                        `[TEST LOG - ${new Date().toISOString()}] Loop ${attempts + 1}/${maxAttempts}: Encontradas ${currentNotifications.length} notificações.`,
                    );
                    currentNotifications.forEach((n, index) => {
                        console.log(
                            `    -> Notif #${index + 1}: ID=${n.id}, Status=${n.status}, Tentativa=${n.attempt_number}, Created=${n.created_at?.toISOString()}, Content(50)=${n.content?.substring(0, 50)}...`,
                        );
                    });

                    updatedNotification =
                        currentNotifications.find(
                            (n) =>
                                n.status === ENotificationStatus.SENT ||
                                n.status === ENotificationStatus.FAILED,
                        ) || currentNotifications[0];

                    console.log(
                        `[TEST LOG - ${new Date().toISOString()}] Loop ${attempts + 1}/${maxAttempts}: Verificando Notificação ID: ${updatedNotification?.id}. Status Atual: ${updatedNotification?.status}.`,
                    );

                    if (updatedNotification?.status === ENotificationStatus.SENT) {
                        console.log(
                            '✅ Notificação processada com sucesso (Status SENT encontrado)',
                        );
                        break;
                    }

                    if (updatedNotification.status === ENotificationStatus.FAILED) {
                        console.error(
                            `❌ Notificação marcada como FAILED na tentativa ${attempts + 1}. Interrompendo verificação.`,
                            JSON.stringify(updatedNotification, null, 2),
                        );
                        // Opcional: Lançar erro aqui para falhar o teste imediatamente
                        // throw new Error(`Notificação ${notification.id} falhou ao ser processada (status FAILED)`);
                        break; // Sai do loop se falhou
                    }

                    console.log(
                        `⏳ Status ainda não é SENT (${updatedNotification.status}). Aguardando 2s...`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, 2000));
                    attempts++;
                }

                if (attempts >= maxAttempts) {
                    console.error(
                        `❌ Timeout: Status da notificação ${notification.id} não chegou a SENT após ${maxAttempts} tentativas. Último status: ${updatedNotification?.status}`,
                    );
                    throw new Error('Timeout ao aguardar processamento da notificação');
                }

                // Adiciona log final se saiu por FAILED
                if (updatedNotification?.status === ENotificationStatus.FAILED) {
                    console.error(
                        `❌ Teste falhou porque a notificação ${notification.id} foi marcada como FAILED.`,
                    );
                    // A asserção abaixo provavelmente falhará, o que é o esperado neste caso.
                }

                console.log(
                    '📊 Status final da notificação verificado pelo teste:',
                    updatedNotification?.status,
                );
                expect(updatedNotification.status).toBe(ENotificationStatus.SENT);
            } catch (error) {
                console.error('❌ Erro durante o processamento/verificação da notificação:', error);
                throw error;
            }

            // 7. Verifica o histórico de status
            console.log('🔍 Verificando histórico de status...');
            const statusHistory = await prisma.status_history.findMany({
                where: { contract_id: contractId },
            });

            console.log('📊 Histórico de status:', statusHistory);

            expect(statusHistory).toHaveLength(2); // DRAFT -> PENDING_SIGNATURE
        });

        it('deve verificar as configurações de lembretes do scheduler', () => {
            // Confirma que o scheduler está configurado corretamente
            expect(scheduler['DIAS_SEGUNDA_NOTIFICACAO']).toBe(3);
            expect(scheduler['DIAS_TERCEIRA_NOTIFICACAO']).toBe(7);
            expect(scheduler['MAX_NOTIFICACOES']).toBe(3);
        });

        it('deve simular o envio de uma segunda notificação para o contrato', async () => {
            // Busca o contrato mais recente criado no teste anterior
            const latestContract = await prisma.contracts.findFirst({
                where: { status: EContractStatus.PENDING_SIGNATURE },
                orderBy: { created_at: 'desc' },
                include: { sellers: true },
            });

            expect(latestContract).toBeDefined();
            console.log('📝 Usando contrato:', latestContract.id);

            // Obtém token de autenticação para acessar endpoints protegidos
            const loginResponse = await request(app.getHttpServer())
                .post('/auth/login')
                .send({
                    email: 'admin@truesource.com.br',
                    password: 'admin123',
                })
                .expect(201);

            const token = loginResponse.body.access_token;
            expect(token).toBeDefined();

            // Simula o envio da segunda notificação usando o endpoint do scheduler
            const reminderResponse = await request(app.getHttpServer())
                .post(`/scheduler/reminder/${latestContract.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            console.log('📥 Resposta do lembrete manual:', reminderResponse.body);

            expect(reminderResponse.body).toEqual({
                success: true,
                message: `Lembrete enviado com sucesso para o contrato ${latestContract.id}`,
            });

            // Aguarda a criação da notificação
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Verifica se a segunda notificação foi criada
            const notifications = await prisma.notifications.findMany({
                where: { contract_id: latestContract.id },
                orderBy: { created_at: 'desc' },
            });

            console.log('📊 Notificações encontradas:', notifications.length);
            expect(notifications.length).toBeGreaterThanOrEqual(2);

            // Verifica a notificação mais recente
            const latestNotification = notifications[0];
            expect(latestNotification.attempt_number).toBe(2);

            // Verifica o conteúdo da segunda notificação
            expect(latestNotification.content).toContain(
                `Olá *${latestContract.sellers.razao_social}*! 👋`,
            );
            expect(latestNotification.content).toContain('dias');
            expect(latestNotification.content).toContain(latestContract.signing_url);
        });

        it('deve simular o envio da terceira notificação para o contrato', async () => {
            // Busca o contrato mais recente usado no teste anterior
            const latestContract = await prisma.contracts.findFirst({
                where: { status: EContractStatus.PENDING_SIGNATURE },
                orderBy: { created_at: 'desc' },
                include: { sellers: true },
            });

            expect(latestContract).toBeDefined();
            console.log('📝 Usando contrato:', latestContract.id);

            // Obtém token de autenticação para acessar endpoints protegidos
            const loginResponse = await request(app.getHttpServer())
                .post('/auth/login')
                .send({
                    email: 'admin@truesource.com.br',
                    password: 'admin123',
                })
                .expect(201);

            const token = loginResponse.body.access_token;
            expect(token).toBeDefined();

            // Simula o envio da terceira notificação usando o endpoint do scheduler
            const reminderResponse = await request(app.getHttpServer())
                .post(`/scheduler/reminder/${latestContract.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            console.log('📥 Resposta do lembrete manual:', reminderResponse.body);

            expect(reminderResponse.body).toEqual({
                success: true,
                message: `Lembrete enviado com sucesso para o contrato ${latestContract.id}`,
            });

            // Aguarda a criação da notificação
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Verifica se a terceira notificação foi criada
            const notifications = await prisma.notifications.findMany({
                where: { contract_id: latestContract.id },
                orderBy: { created_at: 'desc' },
            });

            console.log('📊 Notificações encontradas:', notifications.length);
            expect(notifications.length).toBeGreaterThanOrEqual(3);

            // Verifica a notificação mais recente
            const latestNotification = notifications[0];
            expect(latestNotification.attempt_number).toBe(3);

            // Verifica o conteúdo da terceira notificação
            expect(latestNotification.content).toContain(
                `Olá *${latestContract.sellers.razao_social}*! 👋`,
            );
            expect(latestNotification.content).toContain('ÚLTIMA');
            expect(latestNotification.content).toContain(latestContract.signing_url);
        });

        it('não deve enviar mais notificações após atingir o limite de 3', async () => {
            // Busca o contrato mais recente usado no teste anterior
            const latestContract = await prisma.contracts.findFirst({
                where: { status: EContractStatus.PENDING_SIGNATURE },
                orderBy: { created_at: 'desc' },
            });

            expect(latestContract).toBeDefined();
            console.log('📝 Usando contrato:', latestContract.id);

            // Obtém token de autenticação para acessar endpoints protegidos
            const loginResponse = await request(app.getHttpServer())
                .post('/auth/login')
                .send({
                    email: 'admin@truesource.com.br',
                    password: 'admin123',
                })
                .expect(201);

            const token = loginResponse.body.access_token;
            expect(token).toBeDefined();

            // Tenta enviar uma quarta notificação
            const reminderResponse = await request(app.getHttpServer())
                .post(`/scheduler/reminder/${latestContract.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(400); // Deve retornar erro

            console.log('📥 Resposta do lembrete manual (esperado falhar):', reminderResponse.body);

            // Verifica a quantidade de notificações (deve manter 3)
            const notifications = await prisma.notifications.findMany({
                where: { contract_id: latestContract.id },
            });

            expect(notifications.length).toBe(3);
        });
    });
});
