import { Injectable, BadRequestException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../../notification/services/notification.service';
import { WhatsAppService } from '../../../integration/services/whatsapp.service';
import { ENotificationStatus } from '../../notification/enums/notification-status.enum';
import { UpdateNotificationDto } from '../../notification/dtos/update-notification.dto';
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
    ) {}

    @OnEvent('notification.retry')
    async handleNotificationRetryEvent(event: NotificationRetryEvent) {
        const notification = await this.notificationService.findOne(event.notificationId);
        if (!notification.seller) {
            throw new BadRequestException('Vendedor não encontrado para esta notificação');
        }

        try {
            if (!notification.seller.telefone) {
                throw new BadRequestException('Telefone do vendedor não encontrado');
            }

            const result = await this.whatsappService.sendMessage(
                notification.seller.telefone,
                notification.content,
            );

            if (result.success && result.messageId) {
                await this.notificationService.markAsSent(event.notificationId, result.messageId);
            } else {
                await this.notificationService.markAsFailed(event.notificationId);
            }
        } catch (error) {
            await this.notificationService.markAsFailed(event.notificationId);
            throw error;
        }
    }

    @OnEvent('notification.sent')
    async handleNotificationSentEvent(event: NotificationSentEvent) {
        const notification = await this.notificationService.findOne(event.notificationId);
        const updateDto: UpdateNotificationDto = {
            contractId: notification.contractId,
            sellerId: notification.sellerId,
            type: notification.type,
            channel: notification.channel,
            content: notification.content,
            attemptNumber: notification.attemptNumber,
            status: ENotificationStatus.SENT,
            sentAt: event.sentAt,
            externalId: event.externalId,
        };
        await this.notificationService.update(event.notificationId, updateDto);
    }

    @OnEvent('notification.delivered')
    async handleNotificationDeliveredEvent(event: NotificationDeliveredEvent) {
        const notification = await this.notificationService.findOne(event.notificationId);
        const updateDto: UpdateNotificationDto = {
            contractId: notification.contractId,
            sellerId: notification.sellerId,
            type: notification.type,
            channel: notification.channel,
            content: notification.content,
            attemptNumber: notification.attemptNumber,
            status: ENotificationStatus.DELIVERED,
            deliveredAt: new Date(),
        };
        await this.notificationService.update(event.notificationId, updateDto);
    }

    @OnEvent('notification.failed')
    async handleNotificationFailedEvent(event: NotificationFailedEvent) {
        const notification = await this.notificationService.findOne(event.notificationId);
        const updateDto: UpdateNotificationDto = {
            contractId: notification.contractId,
            sellerId: notification.sellerId,
            type: notification.type,
            channel: notification.channel,
            content: notification.content,
            attemptNumber: notification.attemptNumber,
            status: ENotificationStatus.FAILED,
        };
        await this.notificationService.update(event.notificationId, updateDto);
    }
}
