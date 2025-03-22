import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { CreateNotificationDto } from '../dtos/create-notification.dto';
import { UpdateNotificationDto } from '../dtos/update-notification.dto';
import { NotificationResponseDto } from '../dtos/notification-response.dto';
import { ENotificationStatus } from '../enums/notification-status.enum';

@Injectable()
export class NotificationService {
  private readonly MAX_ATTEMPTS = 5;

  constructor(private readonly prisma: PrismaService) {}

  private mapToResponseDto(notification: any): NotificationResponseDto {
    return {
      id: notification.id,
      contractId: notification.contract_id,
      sellerId: notification.seller_id,
      type: notification.type,
      channel: notification.channel,
      content: notification.content,
      status: notification.status,
      attemptNumber: notification.attempt_number,
      externalId: notification.external_id,
      sentAt: notification.sent_at,
      deliveredAt: notification.delivered_at,
      createdAt: notification.created_at,
    };
  }

  async create(createNotificationDto: CreateNotificationDto): Promise<NotificationResponseDto> {
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
    return this.mapToResponseDto(notification);
  }

  async findAll(): Promise<NotificationResponseDto[]> {
    const notifications = await this.prisma.notifications.findMany();
    return notifications.map(notification => this.mapToResponseDto(notification));
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
    return notifications.map(notification => this.mapToResponseDto(notification));
  }

  async findBySellerId(sellerId: string): Promise<NotificationResponseDto[]> {
    const notifications = await this.prisma.notifications.findMany({
      where: { seller_id: sellerId },
    });
    return notifications.map(notification => this.mapToResponseDto(notification));
  }

  async findByStatus(status: ENotificationStatus): Promise<NotificationResponseDto[]> {
    const notifications = await this.prisma.notifications.findMany({
      where: { status },
    });
    return notifications.map(notification => this.mapToResponseDto(notification));
  }

  async findPending(): Promise<NotificationResponseDto[]> {
    const notifications = await this.prisma.notifications.findMany({
      where: { status: ENotificationStatus.PENDING },
    });
    return notifications.map(notification => this.mapToResponseDto(notification));
  }

  async markAsSent(id: string, externalId: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notifications.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notificação com ID ${id} não encontrada`);
    }

    if (notification.status === ENotificationStatus.DELIVERED) {
      throw new BadRequestException(
        'Apenas notificações enviadas podem ser marcadas como entregues',
      );
    }

    const updatedNotification = await this.prisma.notifications.update({
      where: { id },
      data: {
        status: ENotificationStatus.SENT,
        sent_at: new Date(),
        external_id: externalId,
      },
    });
    return this.mapToResponseDto(updatedNotification);
  }

  async markAsDelivered(id: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notifications.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notificação com ID ${id} não encontrada`);
    }

    if (notification.status !== ENotificationStatus.SENT) {
      throw new BadRequestException(
        'Apenas notificações enviadas podem ser marcadas como entregues',
      );
    }

    const updatedNotification = await this.prisma.notifications.update({
      where: { id },
      data: {
        status: ENotificationStatus.DELIVERED,
        delivered_at: new Date(),
      },
    });
    return this.mapToResponseDto(updatedNotification);
  }

  async markAsFailed(id: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notifications.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notificação com ID ${id} não encontrada`);
    }

    if (notification.attempt_number >= this.MAX_ATTEMPTS) {
      throw new BadRequestException(`Número máximo de tentativas (${this.MAX_ATTEMPTS}) excedido`);
    }

    const updatedNotification = await this.prisma.notifications.update({
      where: { id },
      data: {
        status: ENotificationStatus.FAILED,
        attempt_number: notification.attempt_number + 1,
      },
    });
    return this.mapToResponseDto(updatedNotification);
  }
}
