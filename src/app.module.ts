import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from './shared/modules/prisma.module';
import { ContractManagementModule } from './modules/contract-management/contract-management.module';
import { BrasilApiModule } from './modules/integration/brasil-api/brasil-api.module';
import { SecurityModule } from './modules/security/security.module';
import { AutentiqueModule } from './modules/integration/autentique/autentique.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
      cache: false,
      expandVariables: true,
    }),
    PrismaModule,
    HttpModule,
    SecurityModule,
    ContractManagementModule,
    BrasilApiModule,
    AutentiqueModule,
  ],
})
export class AppModule {}
