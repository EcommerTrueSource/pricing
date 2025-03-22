import { Injectable, BadRequestException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../../notification/services/notification.service';
import { WhatsAppService } from '../../../integration/services/whatsapp.service';
import { EmailService } from '../../../integration/services/email.service';
import { SMSService } from '../../../integration/services/sms.service';
import { ENotificationChannel } from '../../notification/enums/notification-channel.enum';
import {
  NotificationSentEvent,
  NotificationDeliveredEvent,
  NotificationFailedEvent,
  NotificationRetryEvent,
} from '../notification.events';

@Injectable()
export class NotificationEventHandler {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly whatsappService: WhatsAppService,
    private readonly emailService: EmailService,
    private readonly smsService: SMSService,
  ) {}

  @OnEvent('notification.sent')
  async handleNotificationSentEvent(event: NotificationSentEvent) {
    await this.notificationService.markAsSent(event.notificationId, event.externalId);
  }

  @OnEvent('notification.delivered')
  async handleNotificationDeliveredEvent(event: NotificationDeliveredEvent) {
    await this.notificationService.markAsDelivered(event.notificationId);
  }

  @OnEvent('notification.failed')
  async handleNotificationFailedEvent(event: NotificationFailedEvent) {
    await this.notificationService.markAsFailed(event.notificationId);
  }

  @OnEvent('notification.retry')
  async handleNotificationRetryEvent(event: NotificationRetryEvent) {
    const notification = await this.notificationService.findOne(event.notificationId);
    if (!notification.seller) {
      throw new BadRequestException('Vendedor não encontrado para esta notificação');
    }

    try {
      switch (notification.channel) {
        case ENotificationChannel.WHATSAPP:
          if (!notification.seller.telefone) {
            throw new BadRequestException('Telefone do vendedor não encontrado');
          }
          await this.whatsappService.sendMessage(
            notification.seller.telefone,
            notification.content,
          );
          break;
        case ENotificationChannel.EMAIL:
          if (!notification.seller.email) {
            throw new BadRequestException('Email do vendedor não encontrado');
          }
          await this.emailService.sendEmail(
            notification.seller.email,
            'Notificação de Contrato',
            notification.content,
          );
          break;
        case ENotificationChannel.SMS:
          if (!notification.seller.telefone) {
            throw new BadRequestException('Telefone do vendedor não encontrado');
          }
          await this.smsService.sendSMS(notification.seller.telefone, notification.content);
          break;
        default:
          throw new Error(`Canal de notificação não suportado: ${notification.channel}`);
      }
      await this.notificationService.markAsSent(event.notificationId, '');
    } catch (error) {
      await this.notificationService.markAsFailed(event.notificationId);
      throw error;
    }
  }
}
