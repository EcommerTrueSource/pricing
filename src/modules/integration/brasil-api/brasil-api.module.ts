import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BrasilApiService } from './services/brasil-api.service';

@Module({
  imports: [ConfigModule],
  providers: [BrasilApiService],
  exports: [BrasilApiService],
})
export class BrasilApiModule {}
