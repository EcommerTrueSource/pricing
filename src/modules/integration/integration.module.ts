import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AutentiqueModule } from './autentique/autentique.module';
import { BrasilApiModule } from './brasil-api/brasil-api.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { RedisModule } from './redis/redis.module';
import { RateLimiterModule } from '../../shared/modules/rate-limiter.module';
import { ValidationModule } from '../../shared/modules/validation.module';
import { CnpjwsModule } from './cnpjws/cnpjws.module';
import { CnpjIntegrationModule } from './cnpj/cnpj-integration.module';

@Module({
    imports: [
        ConfigModule,
        forwardRef(() => AutentiqueModule),
        BrasilApiModule,
        CnpjwsModule,
        CnpjIntegrationModule,
        WhatsAppModule,
        RedisModule,
        RateLimiterModule,
        ValidationModule,
    ],
    exports: [
        forwardRef(() => AutentiqueModule),
        BrasilApiModule,
        CnpjwsModule,
        CnpjIntegrationModule,
        WhatsAppModule,
        RedisModule,
    ],
})
export class IntegrationModule {}
