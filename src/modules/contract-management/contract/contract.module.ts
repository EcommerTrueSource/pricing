import { Module } from '@nestjs/common';
import { ContractController } from './controllers/contract.controller';
import { ContractService } from './services/contract.service';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { ContractTemplateModule } from '../template/contract-template.module';
import { AutentiqueModule } from '../../integration/autentique/autentique.module';
import { NotificationModule } from '../notification/notification.module';
import { SellerModule } from '../seller/seller.module';
import { SecurityModule } from '../../security/security.module';

@Module({
    imports: [
        PrismaModule,
        SellerModule,
        ContractTemplateModule,
        AutentiqueModule,
        NotificationModule,
        SecurityModule,
    ],
    controllers: [ContractController],
    providers: [ContractService],
    exports: [ContractService],
})
export class ContractModule {}
