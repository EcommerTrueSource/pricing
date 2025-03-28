import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BrasilApiService } from './services/brasil-api.service';

@Module({
    imports: [HttpModule],
    providers: [BrasilApiService],
    exports: [BrasilApiService],
})
export class BrasilApiModule {}
