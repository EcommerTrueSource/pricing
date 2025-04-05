import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/services/prisma.service';
import { ENotificationStatus } from '../src/modules/contract-management/notification/enums/notification-status.enum';
import { ENotificationType } from '../src/modules/contract-management/notification/enums/notification-type.enum';
import { ENotificationChannel } from '../src/modules/contract-management/notification/enums/notification-channel.enum';
import { RedisTestModule } from '../src/shared/modules/redis-test.module';
import { BullModule } from '@nestjs/bull';
import { RateLimiterModule } from '../src/shared/modules/rate-limiter.module';
import { ValidationModule } from '../src/shared/modules/validation.module';
import { ConfigModule } from '@nestjs/config';
import { SecurityModule } from '../src/modules/security/security.module';
import { Queue } from 'bull';

describe('Fluxo completo do webhook', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let notificationQueue: Queue;

    const webhookData = {
        cnpj: '38308523000172',
        email: 'teste@teste.com',
        telefone: '27992594304',
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                AppModule,
                RedisTestModule,
                BullModule.registerQueue({
                    name: 'notifications',
                    defaultJobOptions: {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 1000,
                        },
                        removeOnComplete: true,
                    },
                }),
                RateLimiterModule,
                ValidationModule,
                SecurityModule,
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.local',
                }),
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        prisma = app.get<PrismaService>(PrismaService);
        notificationQueue = app.get<Queue>('BullQueue_notifications');

        await app.init();
    });

    afterAll(async () => {
        if (prisma) {
            await prisma.status_history.deleteMany();
            await prisma.notifications.deleteMany();
            await prisma.contracts.deleteMany();
            await prisma.sellers.deleteMany();
        }

        if (notificationQueue) {
            await notificationQueue.close();
        }

        if (app) {
            await app.close();
        }
    });

    it('deve processar o webhook e enviar a primeira notificação', async () => {
        console.log('🔄 Iniciando fluxo completo de webhook...');
        console.log('📤 Enviando webhook com dados:', webhookData);

        const response = await request(app.getHttpServer())
            .post('/webhook/contract')
            .send(webhookData)
            .expect(201);

        const notification = await prisma.notifications.findFirst({
            where: { contract_id: response.body.id },
        });

        expect(notification).toBeDefined();
        expect(notification.status).toBe(ENotificationStatus.SENT);
        expect(notification.type).toBe(ENotificationType.SIGNATURE_REMINDER);
        expect(notification.channel).toBe(ENotificationChannel.WHATSAPP);
        expect(notification.attempt_number).toBe(1);

        const seller = await prisma.sellers.findUnique({
            where: { id: response.body.seller_id },
        });

        expect(seller).toBeDefined();
        expect(seller.email).toBe(webhookData.email);
        expect(seller.telefone).toBe(webhookData.telefone);

        expect(notification.content).toContain(`Olá ${seller.razao_social}`);
        expect(notification.content).toContain('seu contrato está pronto para assinatura');
        expect(notification.content).toContain('Acesse o link:');
    });
});
