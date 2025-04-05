import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppService } from './services/whatsapp.service';
import { RateLimiterModule } from '../../../shared/modules/rate-limiter.module';
import { ValidationModule } from '../../../shared/modules/validation.module';

@Module({
    imports: [ConfigModule, RateLimiterModule, ValidationModule],
    providers: [WhatsAppService],
    exports: [WhatsAppService],
})
export class WhatsAppModule {}
