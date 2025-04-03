import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SellerController } from './controllers/seller.controller';
import { SellerService } from './services/seller.service';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { BrasilApiModule } from '../../integration/brasil-api/brasil-api.module';

@Module({
    imports: [PrismaModule, HttpModule, BrasilApiModule],
    controllers: [SellerController],
    providers: [SellerService],
    exports: [SellerService],
})
export class SellerModule {}
