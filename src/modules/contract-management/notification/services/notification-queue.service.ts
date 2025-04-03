import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../integration/redis/services/redis.service';
import { INotificationQueue } from '../interfaces/notification-queue.interface';
import { NotificationJobData } from '../dtos/notification-job-data.dto';
import { Logger } from '@nestjs/common';

@Injectable()
export class NotificationQueueService implements INotificationQueue {
    private readonly logger = new Logger(NotificationQueueService.name);
    private readonly QUEUE_KEY = 'notification:queue';

    constructor(private readonly redisService: RedisService) {}

    async addToQueue(data: NotificationJobData): Promise<void> {
        try {
            await this.redisService.lpush(this.QUEUE_KEY, JSON.stringify(data));
            this.logger.log(`Notification added to queue: ${data.notificationId}`);
        } catch (error) {
            this.logger.error(`Failed to add notification to queue: ${error.message}`, error.stack);
            throw error;
        }
    }

    async processQueue(): Promise<void> {
        try {
            const data = await this.redisService.rpop(this.QUEUE_KEY);
            if (data) {
                const notificationData = JSON.parse(data) as NotificationJobData;
                this.logger.log(`Processing notification: ${notificationData.notificationId}`);
                // Aqui será implementada a lógica de processamento da notificação
            }
        } catch (error) {
            this.logger.error(
                `Failed to process notification queue: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    async getQueueLength(): Promise<number> {
        try {
            return await this.redisService.llen(this.QUEUE_KEY);
        } catch (error) {
            this.logger.error(`Failed to get queue length: ${error.message}`, error.stack);
            throw error;
        }
    }
}
