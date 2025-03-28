import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { CreateNotificationDto } from '../dtos/create-notification.dto';
import { UpdateNotificationDto } from '../dtos/update-notification.dto';
import { NotificationResponseDto } from '../dtos/notification-response.dto';
import { ENotificationStatus } from '../enums/notification-status.enum';
import { ENotificationType } from '../enums/notification-type.enum';
import { ENotificationChannel } from '../enums/notification-channel.enum';

interface NotificationMetrics {
    totalSent: number;
    totalFailed: number;
    averageDeliveryTime: number;
    successRate: number;
    lastUpdate: Date;
}

@Injectable()
export class NotificationService {
    [x: string]: any;
    private readonly logger = new Logger(NotificationService.name);
    private readonly MAX_ATTEMPTS = 5;
    private readonly metrics: NotificationMetrics = {
        totalSent: 0,
        totalFailed: 0,
        averageDeliveryTime: 0,
        successRate: 0,
        lastUpdate: new Date(),
    };

    constructor(private readonly prisma: PrismaService) {}
    private mapToResponseDto(notification: any): NotificationResponseDto {
        return {
            id: notification.id,
            contractId: notification.contract_id,
            sellerId: notification.seller_id,
            type: notification.type as ENotificationType,
            createdAt: notification.created_at,
            channel: notification.channel as ENotificationChannel,
            content: notification.content,
            status: notification.status as ENotificationStatus,
            attemptNumber: notification.attempt_number,
            externalId: notification.external_id,
            sentAt: notification.sent_at,
            deliveredAt: notification.delivered_at,
        };
    }

    async create(createNotificationDto: CreateNotificationDto): Promise<NotificationResponseDto> {
        this.logger.debug(`Criando nova notificação: ${JSON.stringify(createNotificationDto)}`);

        const notification = await this.prisma.notifications.create({
            data: {
                contract_id: createNotificationDto.contractId,
                seller_id: createNotificationDto.sellerId,
                type: createNotificationDto.type as any,
                channel: createNotificationDto.channel as any,
                content: createNotificationDto.content,
                status: ENotificationStatus.PENDING,
                attempt_number: 1,
            },
        });

        this.logger.log(`Notificação criada com sucesso: ${notification.id}`);
        return this.mapToResponseDto(notification);
    }

    async findAll(): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany();
        return notifications.map((notification) => this.mapToResponseDto(notification));
    }

    async findOne(id: string): Promise<NotificationResponseDto> {
        const notification = await this.prisma.notifications.findUnique({
            where: { id },
            include: {
                sellers: true,
            },
        });

        if (!notification) {
            this.logger.warn(`Notificação ${id} não encontrada`);
            return null;
        }

        return this.mapToResponseDto(notification);
    }

    async update(
        id: string,
        updateNotificationDto: UpdateNotificationDto,
    ): Promise<NotificationResponseDto> {
        try {
            const notification = await this.prisma.notifications.update({
                where: { id },
                data: {
                    type: updateNotificationDto.type as any,
                    channel: updateNotificationDto.channel as any,
                    content: updateNotificationDto.content,
                    status: updateNotificationDto.status,
                },
            });
            return this.mapToResponseDto(notification);
        } catch (error) {
            throw new NotFoundException(`Notificação com ID ${id} não encontrada`);
        }
    }

    async remove(id: string): Promise<void> {
        try {
            await this.prisma.notifications.delete({
                where: { id },
            });
        } catch (error) {
            throw new NotFoundException(`Notificação com ID ${id} não encontrada`);
        }
    }

    async findByContractId(contractId: string): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            where: { contract_id: contractId },
        });
        return notifications.map((notification) => this.mapToResponseDto(notification));
    }

    async findBySellerId(sellerId: string): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            where: { seller_id: sellerId },
        });
        return notifications.map((notification) => this.mapToResponseDto(notification));
    }

    async findByStatus(status: ENotificationStatus): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            where: { status },
        });
        return notifications.map((notification) => this.mapToResponseDto(notification));
    }

    async findPending(): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            where: { status: ENotificationStatus.PENDING },
        });
        return notifications.map((notification) => this.mapToResponseDto(notification));
    }

    async markAsSent(notificationId: string, messageId: string): Promise<NotificationResponseDto> {
        this.logger.debug(`Marcando notificação ${notificationId} como enviada`);

        const notification = await this.prisma.notifications.update({
            where: { id: notificationId },
            data: {
                status: ENotificationStatus.SENT,
                external_id: messageId,
                sent_at: new Date(),
            },
        });

        this.updateMetrics(true);
        this.logger.log(`Notificação ${notificationId} marcada como enviada`);
        return this.mapToResponseDto(notification);
    }

    async markAsDelivered(notificationId: string): Promise<NotificationResponseDto> {
        this.logger.debug(`Marcando notificação ${notificationId} como entregue`);

        const notification = await this.prisma.notifications.update({
            where: { id: notificationId },
            data: {
                status: ENotificationStatus.DELIVERED,
                delivered_at: new Date(),
            },
        });

        this.updateMetrics(true);
        this.logger.log(`Notificação ${notificationId} marcada como entregue`);
        return this.mapToResponseDto(notification);
    }

    async markAsFailed(notificationId: string): Promise<NotificationResponseDto> {
        this.logger.debug(`Marcando notificação ${notificationId} como falha`);

        const notification = await this.prisma.notifications.update({
            where: { id: notificationId },
            data: {
                status: ENotificationStatus.FAILED,
            },
        });

        this.updateMetrics(false);
        this.logger.error(`Notificação ${notificationId} marcada como falha`);
        return this.mapToResponseDto(notification);
    }

    async getMetrics(): Promise<NotificationMetrics> {
        return { ...this.metrics };
    }

    private updateMetrics(success: boolean): void {
        if (success) {
            this.metrics.totalSent++;
        } else {
            this.metrics.totalFailed++;
        }

        const total = this.metrics.totalSent + this.metrics.totalFailed;
        this.metrics.successRate = total > 0 ? (this.metrics.totalSent / total) * 100 : 0;
        this.metrics.lastUpdate = new Date();
    }
}
