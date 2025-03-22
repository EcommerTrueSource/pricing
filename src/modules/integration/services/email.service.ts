import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  async sendEmail(to: string, subject: string, content: string): Promise<void> {
    // TODO: Implementar integração com serviço de email
    console.log(`Enviando email para ${to}: ${subject}\nConteúdo: ${content}`);
  }
}
