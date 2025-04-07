import { Module } from '@nestjs/common';
import { BrasilApiModule } from '../brasil-api/brasil-api.module';
import { CnpjwsModule } from '../cnpjws/cnpjws.module';
import { CnpjIntegrationService } from './services/cnpj-integration.service';

@Module({
    imports: [CnpjwsModule, BrasilApiModule],
    providers: [CnpjIntegrationService],
    exports: [CnpjIntegrationService],
})
export class CnpjIntegrationModule {}
