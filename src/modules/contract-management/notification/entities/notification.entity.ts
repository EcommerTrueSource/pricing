import { notification_status, notification_type, notification_channel } from '@prisma/client';

export class Notification {
    id: string;
    contract_id: string;
    seller_id: string;
    type: notification_type;
    channel: notification_channel;
    content: string;
    status: notification_status;
    attempt_number: number;
    external_id?: string;
    sent_at?: Date;
    delivered_at?: Date;
    created_at: Date;
    sellers?: {
        id: string;
        telefone: string;
    };
}
