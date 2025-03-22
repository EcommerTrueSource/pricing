import { Injectable } from '@nestjs/common';

@Injectable()
export class WhatsAppService {
  async sendMessage(phoneNumber: string, message: string): Promise<void> {
    // TODO: Implementar integração com WhatsApp
    console.log(`Enviando mensagem WhatsApp para ${phoneNumber}: ${message}`);
  }
}
