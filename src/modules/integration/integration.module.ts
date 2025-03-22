import { Module } from '@nestjs/common';
import { BrasilApiService } from './services/brasil-api.service';
import { WhatsAppService } from './services/whatsapp.service';
import { EmailService } from './services/email.service';
import { SMSService } from './services/sms.service';

@Module({
  providers: [BrasilApiService, WhatsAppService, EmailService, SMSService],
  exports: [BrasilApiService, WhatsAppService, EmailService, SMSService],
})
export class IntegrationModule {}
