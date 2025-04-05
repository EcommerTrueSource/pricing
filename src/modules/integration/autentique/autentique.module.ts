import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AutentiqueController } from './controllers/autentique.controller';
import { WebhookController } from './controllers/webhook.controller';
import { AutentiqueService } from './services/autentique.service';
import { WebhookService } from './services/webhook.service';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { NotificationModule } from '../../contract-management/notification/notification.module';
import { RateLimiterModule } from '../../../shared/modules/rate-limiter.module';
import { ValidationModule } from '../../../shared/modules/validation.module';
import { IntegrationModule } from '../../integration/integration.module';
import { WebhookRateLimiterGuard } from './guards/webhook-rate-limiter.guard';
import { AutentiqueWebhookRateLimitInterceptor } from './interceptors/rate-limit.interceptor';

@Module({
    imports: [
        ConfigModule,
        forwardRef(() => NotificationModule),
        PrismaModule,
        RateLimiterModule,
        ValidationModule,
        IntegrationModule,
        BullModule.registerQueue({
            name: 'notifications',
            defaultJobOptions: {
                attempts: 5,
                backoff: {
                    type: 'exponential',
                    delay: 60000,
                },
                removeOnComplete: false,
                removeOnFail: false,
            },
        }),
    ],
    controllers: [AutentiqueController, WebhookController],
    providers: [
        AutentiqueService,
        WebhookService,
        AutentiqueWebhookRateLimitInterceptor,
        WebhookRateLimiterGuard,
    ],
    exports: [AutentiqueService],
})
export class AutentiqueModule {}
