import { ApiProperty } from '@nestjs/swagger';
import { ENotificationType } from '../enums/notification-type.enum';
import { ENotificationChannel } from '../enums/notification-channel.enum';
import { ENotificationStatus } from '../enums/notification-status.enum';
import { IContractInfo } from '../interfaces/contract-info.interface';
import { ISellerInfo } from '../interfaces/seller-info.interface';

export class NotificationResponseDto {
  @ApiProperty({
    description: 'ID da notificação',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'ID do contrato',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  contractId!: string;

  @ApiProperty({
    description: 'ID do vendedor',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  sellerId!: string;

  @ApiProperty({
    description: 'Tipo da notificação',
    enum: ENotificationType,
    example: ENotificationType.SIGNATURE_PENDING,
  })
  type!: ENotificationType;

  @ApiProperty({
    description: 'Canal da notificação',
    enum: ENotificationChannel,
    example: ENotificationChannel.WHATSAPP,
  })
  channel!: ENotificationChannel;

  @ApiProperty({
    description: 'Conteúdo da notificação',
    example: 'Olá! Por favor, assine o contrato #123.',
  })
  content!: string;

  @ApiProperty({
    description: 'Status da notificação',
    enum: ENotificationStatus,
    example: ENotificationStatus.SENT,
  })
  status!: ENotificationStatus;

  @ApiProperty({
    description: 'Número da tentativa de envio',
    example: 1,
    minimum: 1,
    maximum: 5,
  })
  attemptNumber!: number;

  @ApiProperty({
    description: 'ID externo da notificação (WhatsApp, Email, SMS)',
    example: 'msg_123456789',
    required: false,
  })
  externalId?: string;

  @ApiProperty({
    description: 'Data de envio da notificação',
    example: '2024-03-20T10:00:00Z',
    required: false,
  })
  sentAt?: Date;

  @ApiProperty({
    description: 'Data de entrega da notificação',
    example: '2024-03-20T10:01:00Z',
    required: false,
  })
  deliveredAt?: Date;

  @ApiProperty({
    description: 'Data de criação da notificação',
    example: '2024-03-20T09:59:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Informações do contrato',
    required: false,
  })
  contract?: IContractInfo;

  @ApiProperty({
    description: 'Informações do vendedor',
    required: false,
  })
  seller?: ISellerInfo;
}
