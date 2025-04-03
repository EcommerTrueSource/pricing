import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from './shared/modules/prisma.module';
import { ContractManagementModule } from './modules/contract-management/contract-management.module';
import { BrasilApiModule } from './modules/integration/brasil-api/brasil-api.module';
import { SecurityModule } from './modules/security/security.module';
import { AutentiqueModule } from './modules/integration/autentique/autentique.module';
import { IntegrationModule } from './modules/integration/integration.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env.local',
            cache: false,
            expandVariables: true,
        }),
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                redis: {
                    host: configService.get('REDIS_HOST'),
                    port: parseInt(configService.get('REDIS_PORT')),
                    password: configService.get('REDIS_PASSWORD'),
                    tls: configService.get('REDIS_TLS') === 'true' ? {} : undefined,
                },
            }),
            inject: [ConfigService],
        }),
        PrismaModule,
        HttpModule,
        SecurityModule,
        ContractManagementModule,
        BrasilApiModule,
        AutentiqueModule,
        IntegrationModule,
    ],
})
export class AppModule {}
