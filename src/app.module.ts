import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from './shared/modules/prisma.module';
import { ContractManagementModule } from './modules/contract-management/contract-management.module';
import { BrasilApiModule } from './modules/integration/brasil-api/brasil-api.module';
import { SecurityModule } from './modules/security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
    }),
    PrismaModule,
    HttpModule,
    SecurityModule,
    ContractManagementModule,
    BrasilApiModule,
  ],
})
export class AppModule {}
