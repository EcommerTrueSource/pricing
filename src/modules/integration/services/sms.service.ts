import { Injectable } from '@nestjs/common';

@Injectable()
export class SMSService {
  async sendSMS(phoneNumber: string, message: string): Promise<void> {
    // TODO: Implementar integração com serviço de SMS
    console.log(`Enviando SMS para ${phoneNumber}: ${message}`);
  }
}
