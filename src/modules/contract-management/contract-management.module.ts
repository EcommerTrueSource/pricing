import { Module } from '@nestjs/common';
import { SellerModule } from './seller/seller.module';
import { ContractModule } from './contract/contract.module';
import { TemplateModule } from './template/template.module';
import { NotificationModule } from './notification/notification.module';
import { PrismaModule } from '../../shared/modules/prisma.module';
import { SecurityModule } from '../security/security.module';
import { IntegrationModule } from '../integration/integration.module';
import { UpdateSellersCommand } from './commands/update-sellers.command';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    SellerModule,
    ContractModule,
    TemplateModule,
    NotificationModule,
    IntegrationModule,
  ],
  providers: [UpdateSellersCommand],
})
export class ContractManagementModule {}
