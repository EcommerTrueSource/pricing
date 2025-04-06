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
import { EventEmitterModule } from '@nestjs/event-emitter';

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
                    connectTimeout: 10000,
                },
            }),
            inject: [ConfigService],
        }),
        EventEmitterModule.forRoot({
            // Configuração global para garantir que eventos sejam processados
            // mesmo se os handlers gerarem erros
            wildcard: false,
            // Aumenta o número máximo de listeners para evitar warnings
            maxListeners: 20,
            // Verbosidade para debug
            verboseMemoryLeak: true,
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
