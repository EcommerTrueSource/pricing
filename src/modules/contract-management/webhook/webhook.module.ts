import { Module } from '@nestjs/common';
import { WebhookController } from './controllers/webhook.controller';
import { WebhookService } from './services/webhook.service';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { BrasilApiModule } from '../../integration/brasil-api/brasil-api.module';
import { ContractModule } from '../contract/contract.module';
import { ContractTemplateModule } from '../template/contract-template.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [
        PrismaModule,
        BrasilApiModule,
        ContractModule,
        ContractTemplateModule,
        NotificationModule,
    ],
    controllers: [WebhookController],
    providers: [WebhookService],
    exports: [WebhookService],
})
export class WebhookModule {}
