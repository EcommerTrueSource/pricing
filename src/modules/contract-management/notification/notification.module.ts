import { Module } from '@nestjs/common';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';
import { IntegrationModule } from '../../integration/integration.module';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { SecurityModule } from '../../security/security.module';
import { PrismaService } from '../../../shared/services/prisma.service';
import { WhatsAppService } from '../../integration/services/whatsapp.service';
import { NotificationQueue } from './queue/notification.queue';

@Module({
    imports: [IntegrationModule, PrismaModule, SecurityModule],
    controllers: [NotificationController],
    providers: [NotificationService, PrismaService, WhatsAppService, NotificationQueue],
    exports: [NotificationService, NotificationQueue],
})
export class NotificationModule {}
