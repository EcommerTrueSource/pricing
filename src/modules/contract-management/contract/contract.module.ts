import { Module } from '@nestjs/common';
import { ContractController } from './controllers/contract.controller';
import { ContractService } from './services/contract.service';
import { SellerModule } from '../seller/seller.module';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { SecurityModule } from '../../security/security.module';

@Module({
  imports: [PrismaModule, SellerModule, SecurityModule],
  controllers: [ContractController],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
