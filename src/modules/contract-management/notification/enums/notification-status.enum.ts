import { notification_status } from '@prisma/client';

export enum ENotificationStatus {
    PENDING = 'PENDING',
    SENT = 'SENT',
    DELIVERED = 'DELIVERED',
    FAILED = 'FAILED',
}

export const mapNotificationStatusToPrisma = (status: ENotificationStatus): notification_status => {
    return status as notification_status;
};
