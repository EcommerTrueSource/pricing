import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SellerController } from './controllers/seller.controller';
import { SellerService } from './services/seller.service';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { CnpjIntegrationModule } from '../../integration/cnpj/cnpj-integration.module';

@Module({
    imports: [PrismaModule, HttpModule, CnpjIntegrationModule],
    controllers: [SellerController],
    providers: [SellerService],
    exports: [SellerService],
})
export class SellerModule {}
