import { Module } from '@nestjs/common';
import { ContractController } from './controllers/contract.controller';
import { ContractService } from './services/contract.service';
import { SellerModule } from '../seller/seller.module';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { SecurityModule } from '../../security/security.module';
import { TemplateModule } from '../template/template.module';
import { ContractTemplateService } from '../template/services/contract-template.service';

@Module({
  imports: [PrismaModule, SellerModule, SecurityModule, TemplateModule],
  controllers: [ContractController],
  providers: [ContractService, ContractTemplateService],
  exports: [ContractService],
})
export class ContractModule {}
