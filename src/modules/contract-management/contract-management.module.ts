import { Module } from '@nestjs/common';
import { SellerModule } from './seller/seller.module';
import { ContractModule } from './contract/contract.module';
import { ContractTemplateModule } from './template/contract-template.module';
import { NotificationModule } from './notification/notification.module';
import { PrismaModule } from '../../shared/modules/prisma.module';
import { SecurityModule } from '../security/security.module';
import { IntegrationModule } from '../integration/integration.module';
import { UpdateSellersCommand } from './commands/update-sellers.command';
import { AutentiqueModule } from '../integration/autentique/autentique.module';
import { UpdateAllContractsCommand } from './commands/update-all-contracts.command';
import { BrasilApiModule } from '../integration/brasil-api/brasil-api.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
    imports: [
        PrismaModule,
        SecurityModule,
        SellerModule,
        ContractModule,
        ContractTemplateModule,
        NotificationModule,
        IntegrationModule,
        AutentiqueModule,
        BrasilApiModule,
        WebhookModule,
    ],
    providers: [UpdateSellersCommand, UpdateAllContractsCommand],
    exports: [
        SellerModule,
        ContractModule,
        ContractTemplateModule,
        NotificationModule,
        IntegrationModule,
        AutentiqueModule,
        BrasilApiModule,
        WebhookModule,
    ],
})
export class ContractManagementModule {}
