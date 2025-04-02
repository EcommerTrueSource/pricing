import { Module } from '@nestjs/common';
import { AutentiqueModule } from './autentique/autentique.module';
import { BrasilApiModule } from './brasil-api/brasil-api.module';
import { WhatsAppService } from './services/whatsapp.service';
import { RateLimiterModule } from '../../shared/modules/rate-limiter.module';
import { ValidationModule } from '../../shared/modules/validation.module';

@Module({
    imports: [AutentiqueModule, BrasilApiModule, RateLimiterModule, ValidationModule],
    providers: [WhatsAppService],
    exports: [WhatsAppService],
})
export class IntegrationModule {}
