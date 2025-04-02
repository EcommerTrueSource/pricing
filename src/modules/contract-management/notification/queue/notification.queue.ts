import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { ENotificationStatus } from '../enums/notification-status.enum';

interface QueueItem {
    notificationId: string;
    retryCount: number;
    nextRetryAt: Date;
}

@Injectable()
export class NotificationQueue {
    private readonly logger = new Logger(NotificationQueue.name);
    private queue: QueueItem[] = [];
    private processing = false;
    private readonly MAX_RETRIES = 5;
    private readonly RETRY_DELAY = 5000; // 5 segundos

    constructor(private readonly notificationService: NotificationService) {
        this.startProcessing();
    }

    async add(notificationId: string): Promise<void> {
        this.logger.log(`Adicionando notificação ${notificationId} à fila`);

        const queueItem: QueueItem = {
            notificationId,
            retryCount: 0,
            nextRetryAt: new Date(),
        };

        this.queue.push(queueItem);
        this.logger.log(`Notificação ${notificationId} adicionada à fila com sucesso`);
    }

    private async startProcessing(): Promise<void> {
        if (this.processing) {
            return;
        }

        this.processing = true;
        this.logger.log('Iniciando processamento da fila de notificações');

        while (this.processing) {
            if (this.queue.length === 0) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                continue;
            }

            const now = new Date();
            const item = this.queue[0];

            if (item.nextRetryAt > now) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                continue;
            }

            try {
                this.logger.log(`Processando notificação ${item.notificationId}`);

                const notification = await this.notificationService.findOne(item.notificationId);

                if (notification.status === ENotificationStatus.DELIVERED) {
                    this.queue.shift();
                    continue;
                }

                if (
                    notification.status === ENotificationStatus.FAILED &&
                    item.retryCount >= this.MAX_RETRIES
                ) {
                    this.logger.error(
                        `Número máximo de tentativas excedido para notificação ${item.notificationId}`,
                    );
                    this.queue.shift();
                    continue;
                }

                await this.notificationService.sendWhatsAppNotification(notification);

                if (notification.status === ENotificationStatus.SENT) {
                    this.queue.shift();
                } else {
                    item.retryCount++;
                    item.nextRetryAt = new Date(Date.now() + this.RETRY_DELAY);
                }
            } catch (error) {
                this.logger.error(
                    `Erro ao processar notificação ${item.notificationId}: ${error.message}`,
                    error.stack,
                );

                item.retryCount++;
                item.nextRetryAt = new Date(Date.now() + this.RETRY_DELAY);
            }
        }
    }

    stopProcessing(): void {
        this.processing = false;
        this.logger.log('Parando processamento da fila de notificações');
    }

    getQueueLength(): number {
        return this.queue.length;
    }

    getQueueStatus(): QueueItem[] {
        return [...this.queue];
    }
}
