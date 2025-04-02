import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { CreateNotificationDto } from '../dtos/create-notification.dto';
import { NotificationResponseDto } from '../dtos/notification-response.dto';
import { ENotificationStatus } from '../enums/notification-status.enum';
import { ENotificationType, mapNotificationTypeToPrisma } from '../enums/notification-type.enum';
import { ENotificationChannel } from '../enums/notification-channel.enum';
import { UpdateNotificationDto } from '../dtos/update-notification.dto';
import { notification_channel, notification_status } from '@prisma/client';
import { WhatsAppService } from '../../../integration/services/whatsapp.service';
import { NotificationQueue } from '../queue/notification.queue';

interface NotificationMetrics {
    totalSent: number;
    totalFailed: number;
    averageDeliveryTime: number;
    successRate: number;
    lastUpdate: Date;
}

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
    private readonly MAX_ATTEMPTS = 5;
    private readonly RETRY_DELAY = 5000; // 5 segundos
    private readonly metrics: NotificationMetrics = {
        totalSent: 0,
        totalFailed: 0,
        averageDeliveryTime: 0,
        successRate: 0,
        lastUpdate: new Date(),
    };

    constructor(
        private readonly prisma: PrismaService,
        private readonly whatsappService: WhatsAppService,
        private readonly notificationQueue: NotificationQueue,
    ) {}

    async create(createNotificationDto: CreateNotificationDto): Promise<NotificationResponseDto> {
        this.logger.log(
            `Criando nova notificação para o contrato ${createNotificationDto.contractId}`,
        );

        const notification = await this.prisma.notifications.create({
            data: {
                contract_id: createNotificationDto.contractId,
                seller_id: createNotificationDto.sellerId,
                type: mapNotificationTypeToPrisma(createNotificationDto.type),
                channel: createNotificationDto.channel as notification_channel,
                content: createNotificationDto.content,
                status: ENotificationStatus.PENDING as notification_status,
                attempt_number: 1,
            },
        });

        if (createNotificationDto.channel === ENotificationChannel.WHATSAPP) {
            await this.notificationQueue.add(notification.id);
        }

        return this.mapToResponseDto(notification);
    }

    async sendWhatsAppNotification(notification: any): Promise<void> {
        try {
            const seller = await this.prisma.sellers.findUnique({
                where: { id: notification.seller_id },
            });

            if (!seller) {
                throw new NotFoundException(
                    `Vendedor com ID ${notification.seller_id} não encontrado`,
                );
            }

            this.logger.log(
                `Enviando notificação via WhatsApp para o vendedor ${seller.razao_social}`,
            );

            const result = await this.whatsappService.sendContractNotification(seller.telefone, {
                razaoSocial: seller.razao_social,
                contractUrl: this.extractContractUrl(notification.content),
                sellerId: seller.id,
                notificationAttempts: 0,
            });

            if (result.success) {
                await this.markAsSent(notification.id);
                this.logger.log(
                    `Notificação enviada com sucesso para o vendedor ${seller.razao_social}`,
                );
            } else {
                await this.markAsFailed(notification.id);
            }
        } catch (error) {
            this.logger.error(
                `Erro ao enviar notificação via WhatsApp: ${error.message}`,
                error.stack,
            );
            await this.markAsFailed(notification.id);
        }
    }

    private extractContractUrl(content: string): string {
        const urlMatch = content.match(/Link de assinatura: (.*)/);
        if (!urlMatch) {
            this.logger.warn('Link de assinatura não encontrado no conteúdo da notificação');
            return '';
        }
        return urlMatch[1];
    }

    async findAll(): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany();
        return notifications.map(this.mapToResponseDto);
    }

    async findOne(id: string): Promise<NotificationResponseDto> {
        const notification = await this.prisma.notifications.findUnique({
            where: { id },
        });

        if (!notification) {
            throw new NotFoundException(`Notificação com ID ${id} não encontrada`);
        }

        return this.mapToResponseDto(notification);
    }

    async findByContractId(contractId: string): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            where: { contract_id: contractId },
        });

        return notifications.map(this.mapToResponseDto);
    }

    async findBySellerId(sellerId: string): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            where: { seller_id: sellerId },
        });
        return notifications.map(this.mapToResponseDto);
    }

    async findByStatus(status: ENotificationStatus): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            where: { status },
        });
        return notifications.map(this.mapToResponseDto);
    }

    async findPending(): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            where: { status: ENotificationStatus.PENDING },
        });
        return notifications.map(this.mapToResponseDto);
    }

    async update(
        id: string,
        updateNotificationDto: UpdateNotificationDto,
    ): Promise<NotificationResponseDto> {
        const notification = await this.prisma.notifications.update({
            where: { id },
            data: {
                type: mapNotificationTypeToPrisma(updateNotificationDto.type),
                channel: updateNotificationDto.channel as notification_channel,
                content: updateNotificationDto.content,
                status: updateNotificationDto.status as notification_status,
                attempt_number: updateNotificationDto.attemptNumber,
                sent_at: updateNotificationDto.sentAt,
                delivered_at: updateNotificationDto.deliveredAt,
            },
        });
        return this.mapToResponseDto(notification);
    }

    async remove(id: string): Promise<void> {
        await this.prisma.notifications.delete({
            where: { id },
        });
    }

    async markAsSent(id: string): Promise<NotificationResponseDto> {
        const notification = await this.prisma.notifications.update({
            where: { id },
            data: {
                status: ENotificationStatus.SENT,
                sent_at: new Date(),
            },
        });

        this.updateMetrics(true);
        return this.mapToResponseDto(notification);
    }

    async markAsDelivered(id: string): Promise<NotificationResponseDto> {
        const notification = await this.prisma.notifications.update({
            where: { id },
            data: {
                status: ENotificationStatus.DELIVERED,
                delivered_at: new Date(),
            },
        });

        return this.mapToResponseDto(notification);
    }

    async markAsFailed(id: string): Promise<NotificationResponseDto> {
        const notification = await this.prisma.notifications.update({
            where: { id },
            data: {
                status: ENotificationStatus.FAILED,
            },
        });
        this.updateMetrics(false);
        return this.mapToResponseDto(notification);
    }

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
