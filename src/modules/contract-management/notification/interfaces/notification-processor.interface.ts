import { Job } from 'bull';

export interface INotificationProcessor {
    handleNotification(job: Job<NotificationJobData>): Promise<void>;
    onActive(job: Job): void;
    onCompleted(job: Job): void;
    onFailed(job: Job, error: Error): void;
}

export interface NotificationJobData {
    notificationId: string;
    attemptNumber: number;
    metadata?: Record<string, unknown>;
}
