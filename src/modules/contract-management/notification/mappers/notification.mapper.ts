import { Notification } from '../entities/notification.entity';
import { NotificationResponseDto } from '../dtos/notification-response.dto';
import { notifications } from '@prisma/client';
import { ENotificationType } from '../enums/notification-type.enum';
import { ENotificationStatus } from '../enums/notification-status.enum';
import { ENotificationChannel } from '../enums/notification-channel.enum';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationMapper {
    toDomain(
        prismaNotification: notifications & { sellers?: { id: string; telefone: string } },
    ): Notification {
        return {
            id: prismaNotification.id,
            contract_id: prismaNotification.contract_id,
            seller_id: prismaNotification.seller_id,
            type: this.mapTypeToEnum(prismaNotification.type),
            channel: ENotificationChannel.WHATSAPP,
            content: prismaNotification.content,
            status: this.mapStatusToEnum(prismaNotification.status),
            attempt_number: prismaNotification.attempt_number,
            external_id: prismaNotification.external_id,
            sent_at: prismaNotification.sent_at,
            delivered_at: prismaNotification.delivered_at,
            created_at: prismaNotification.created_at,
            sellers: prismaNotification.sellers
                ? {
                      id: prismaNotification.sellers.id,
                      telefone: prismaNotification.sellers.telefone,
                  }
                : undefined,
        };
    }

    toResponseDto(prismaNotification: notifications): NotificationResponseDto {
        return {
            id: prismaNotification.id,
            contractId: prismaNotification.contract_id,
            sellerId: prismaNotification.seller_id,
            type: this.mapTypeToEnum(prismaNotification.type),
            channel: ENotificationChannel.WHATSAPP,
            content: prismaNotification.content,
            status: this.mapStatusToEnum(prismaNotification.status),
            attemptNumber: prismaNotification.attempt_number,
            externalId: prismaNotification.external_id,
            sentAt: prismaNotification.sent_at,
            deliveredAt: prismaNotification.delivered_at,
            createdAt: prismaNotification.created_at,
        };
    }

    private mapTypeToEnum(type: notifications['type']): ENotificationType {
        const typeMap: Record<notifications['type'], ENotificationType> = {
            SIGNATURE_REMINDER: ENotificationType.SIGNATURE_REMINDER,
            CONTRACT_EXPIRED: ENotificationType.CONTRACT_EXPIRED,
            CONTRACT_EXPIRING: ENotificationType.SIGNATURE_REMINDER,
            CONTRACT_SIGNED: ENotificationType.SIGNATURE_REMINDER,
        };
        return typeMap[type];
    }

    private mapStatusToEnum(status: notifications['status']): ENotificationStatus {
        const statusMap: Record<notifications['status'], ENotificationStatus> = {
            PENDING: ENotificationStatus.PENDING,
            SENT: ENotificationStatus.SENT,
            DELIVERED: ENotificationStatus.DELIVERED,
            FAILED: ENotificationStatus.FAILED,
        };
        return statusMap[status];
    }
}
