import { Module } from '@nestjs/common';
import { ContractController } from './controllers/contract.controller';
import { ContractService } from './services/contract.service';
import { SellerModule } from '../seller/seller.module';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { SecurityModule } from '../../security/security.module';
import { TemplateModule } from '../template/template.module';
import { AutentiqueModule } from '../../integration/autentique/autentique.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [
        PrismaModule,
        SellerModule,
        SecurityModule,
        TemplateModule,
        AutentiqueModule,
        NotificationModule,
    ],
    controllers: [ContractController],
    providers: [ContractService],
    exports: [ContractService],
})
export class ContractModule {}
