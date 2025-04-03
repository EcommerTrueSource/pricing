import { Notification } from '../entities/notification.entity';
import { UpdateNotificationDto } from '../dtos/update-notification.dto';
import { NotificationResponseDto } from '../dtos/notification-response.dto';

export interface INotificationService {
    findOne(id: string): Promise<Notification>;
    findAll(): Promise<NotificationResponseDto[]>;
    findByContractId(contractId: string): Promise<NotificationResponseDto[]>;
    findBySellerId(sellerId: string): Promise<NotificationResponseDto[]>;
    findByStatus(status: string): Promise<NotificationResponseDto[]>;
    findPending(): Promise<NotificationResponseDto[]>;
    markAsSent(id: string): Promise<NotificationResponseDto>;
    markAsDelivered(id: string): Promise<NotificationResponseDto>;
    markAsFailed(id: string): Promise<NotificationResponseDto>;
    update(id: string, updateDto: UpdateNotificationDto): Promise<NotificationResponseDto>;
    remove(id: string): Promise<void>;
}
