import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../../notification/services/notification.service';
import { WhatsAppService } from '../../../integration/whatsapp/services/whatsapp.service';
import { ENotificationStatus } from '../../notification/enums/notification-status.enum';
import { UpdateNotificationDto } from '../../notification/dtos/update-notification.dto';
import {
    NotificationSentEvent,
    NotificationDeliveredEvent,
    NotificationFailedEvent,
    NotificationRetryEvent,
} from '../notification.events';
import { ENotificationType } from '../../notification/enums/notification-type.enum';
import { ENotificationChannel } from '../../notification/enums/notification-channel.enum';
import { Logger } from '@nestjs/common';

@Injectable()
export class NotificationEventHandler {
    private readonly logger = new Logger(NotificationEventHandler.name);

    constructor(
        private readonly notificationService: NotificationService,
        private readonly whatsappService: WhatsAppService,
    ) {}

    @OnEvent('notification.retry')
    async handleNotificationRetryEvent(event: NotificationRetryEvent): Promise<void> {
        try {
            const notification = await this.notificationService.findOne(event.notificationId);
            if (!notification) {
                this.logger.error(`Notificação não encontrada: ${event.notificationId}`);
                return;
            }

            await this.whatsappService.sendMessage(notification);
            await this.notificationService.markAsSent(notification.id);
        } catch (error) {
            this.logger.error(`Erro ao processar retry: ${error.message}`);
            await this.notificationService.markAsFailed(event.notificationId);
        }
    }

    @OnEvent('notification.sent')
    async handleNotificationSent(event: NotificationSentEvent): Promise<void> {
        await this.notificationService.markAsSent(event.notificationId);
    }

    @OnEvent('notification.delivered')
    async handleNotificationDeliveredEvent(event: NotificationDeliveredEvent): Promise<void> {
        const notification = await this.notificationService.findOne(event.notificationId);
        const updateDto: UpdateNotificationDto = {
            contractId: notification.contract_id,
            sellerId: notification.seller_id,
            type: notification.type as ENotificationType,
            channel: notification.channel as ENotificationChannel,
            content: notification.content,
            attemptNumber: notification.attempt_number,
            status: ENotificationStatus.DELIVERED,
            deliveredAt: new Date(),
        };
        await this.notificationService.update(event.notificationId, updateDto);
    }

    @OnEvent('notification.failed')
    async handleNotificationFailedEvent(event: NotificationFailedEvent): Promise<void> {
        const notification = await this.notificationService.findOne(event.notificationId);
        const updateDto: UpdateNotificationDto = {
            contractId: notification.contract_id,
            sellerId: notification.seller_id,
            type: notification.type as ENotificationType,
            channel: notification.channel as ENotificationChannel,
            content: notification.content,
            attemptNumber: notification.attempt_number,
            status: ENotificationStatus.FAILED,
        };
        await this.notificationService.update(event.notificationId, updateDto);
    }
}
