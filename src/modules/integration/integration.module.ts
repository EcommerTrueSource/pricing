import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppService } from './services/whatsapp.service';
import { RateLimiterService } from '../../shared/services/rate-limiter.service';
import { ValidationService } from '../../shared/services/validation.service';

@Module({
    imports: [ConfigModule],
    providers: [WhatsAppService, RateLimiterService, ValidationService],
    exports: [WhatsAppService],
})
export class IntegrationModule {}
