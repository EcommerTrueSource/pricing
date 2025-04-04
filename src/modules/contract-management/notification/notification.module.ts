import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';
import { IntegrationModule } from '../../integration/integration.module';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { SecurityModule } from '../../security/security.module';
import { PrismaService } from '../../../shared/services/prisma.service';
import { NotificationProcessor } from './processors/notification.processor';
import { RedisModule } from '../../integration/redis/redis.module';
import { NotificationQueueService } from './services/notification-queue.service';
import { NotificationMapper } from './mappers/notification.mapper';
import { WhatsAppService } from '../../integration/whatsapp/services/whatsapp.service';
import { RateLimiterModule } from '../../../shared/modules/rate-limiter.module';
import { ValidationModule } from '../../../shared/modules/validation.module';

// Fornecendo o serviço diretamente
const messagingServiceProvider = {
    provide: 'MESSAGING_SERVICE',
    useClass: WhatsAppService,
};

@Module({
    imports: [
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
        }),
        IntegrationModule,
        PrismaModule,
        SecurityModule,
        RedisModule,
        RateLimiterModule,
        ValidationModule,
    ],
    controllers: [NotificationController],
    providers: [
        NotificationService,
        NotificationProcessor,
        PrismaService,
        messagingServiceProvider,
        NotificationQueueService,
        NotificationMapper,
    ],
    exports: [NotificationService, NotificationQueueService, 'MESSAGING_SERVICE'],
})
export class NotificationModule {}
