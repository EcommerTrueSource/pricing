import { NotificationJobData } from '../dtos/notification-job-data.dto';

export interface INotificationQueue {
    addToQueue(data: NotificationJobData): Promise<void>;
    processQueue(): Promise<void>;
    getQueueLength(): Promise<number>;
}
