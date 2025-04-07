import { Module } from '@nestjs/common';
import { NotificationService } from './services/notification.service';
import { NotificationController } from './controllers/notification.controller';
import { PrismaService } from '../../../shared/services/prisma.service';
import { WhatsAppService } from '../../integration/whatsapp/services/whatsapp.service';
import { NotificationMapper } from './mappers/notification.mapper';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { RateLimiterModule } from '../../../shared/modules/rate-limiter.module';
import { ValidationModule } from '../../../shared/modules/validation.module';
import { SecurityModule } from '../../../modules/security/security.module';
import { NotificationProcessor } from './processors/notification.processor';
import { NotificationSettingsController } from './controllers/notification-settings.controller';
import { SystemSettingsModule } from '../../../shared/modules/system-settings.module';

@Module({
    imports: [
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
        ConfigModule,
        RateLimiterModule,
        ValidationModule,
        SecurityModule,
        SystemSettingsModule,
    ],
    controllers: [NotificationController, NotificationSettingsController],
    providers: [
        NotificationService,
        PrismaService,
        WhatsAppService,
        NotificationMapper,
        NotificationProcessor,
        {
            provide: 'MESSAGING_SERVICE',
            useClass: WhatsAppService,
        },
    ],
    exports: [NotificationService],
})
export class NotificationModule {}
