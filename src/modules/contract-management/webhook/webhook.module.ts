import { Module } from '@nestjs/common';
import { WebhookController } from './controllers/webhook.controller';
import { WebhookService } from './services/webhook.service';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { BrasilApiModule } from '../../integration/brasil-api/brasil-api.module';
import { ContractModule } from '../contract/contract.module';
import { ContractTemplateModule } from '../template/contract-template.module';
import { NotificationModule } from '../notification/notification.module';
import { SellerModule } from '../seller/seller.module';
import { CnpjIntegrationModule } from '../../integration/cnpj/cnpj-integration.module';

@Module({
    imports: [
        PrismaModule,
        BrasilApiModule,
        ContractModule,
        ContractTemplateModule,
        NotificationModule,
        SellerModule,
        CnpjIntegrationModule,
    ],
    controllers: [WebhookController],
    providers: [WebhookService],
    exports: [WebhookService],
})
export class WebhookModule {}
