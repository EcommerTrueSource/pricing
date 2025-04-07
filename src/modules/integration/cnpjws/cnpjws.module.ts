import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CnpjwsService } from './services/cnpjws.service';

@Module({
    imports: [HttpModule],
    providers: [CnpjwsService],
    exports: [CnpjwsService],
})
export class CnpjwsModule {}
