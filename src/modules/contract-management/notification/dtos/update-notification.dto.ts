import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDate, IsString } from 'class-validator';
import { CreateNotificationDto } from './create-notification.dto';
import { ENotificationStatus } from '../enums/notification-status.enum';

export class UpdateNotificationDto extends CreateNotificationDto {
    @ApiProperty({
        description: 'Status da notificação',
        enum: ENotificationStatus,
        example: ENotificationStatus.SENT,
        required: false,
    })
    @IsEnum(ENotificationStatus, {
        message: 'Status de notificação inválido',
    })
    @IsOptional()
    status?: ENotificationStatus;

    @ApiProperty({
        description: 'Data de envio da notificação',
        example: '2024-03-20T10:00:00Z',
        required: false,
    })
    @IsDate()
    @IsOptional()
    sentAt?: Date;

    @ApiProperty({
        description: 'Data de entrega da notificação',
        example: '2024-03-20T10:01:00Z',
        required: false,
    })
    @IsDate()
    @IsOptional()
    deliveredAt?: Date;

    @ApiProperty({
        description: 'ID externo da notificação (WhatsApp)',
        example: 'msg_123456789',
        required: false,
    })
    @IsString()
    @IsOptional()
    externalId?: string;
}
