import { Module } from '@nestjs/common';
import { AutentiqueModule } from './autentique/autentique.module';
import { BrasilApiModule } from './brasil-api/brasil-api.module';
import { WhatsAppService } from './services/whatsapp.service';
import { RateLimiterModule } from '../../shared/modules/rate-limiter.module';
import { ValidationModule } from '../../shared/modules/validation.module';
import { RedisModule } from './redis/redis.module';

@Module({
    imports: [AutentiqueModule, BrasilApiModule, RateLimiterModule, ValidationModule, RedisModule],
    providers: [WhatsAppService],
    exports: [WhatsAppService, BrasilApiModule, AutentiqueModule, RedisModule],
})
export class IntegrationModule {}
