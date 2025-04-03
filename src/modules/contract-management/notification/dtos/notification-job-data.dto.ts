import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsEnum } from 'class-validator';
import { ENotificationType } from '../enums/notification-type.enum';
import { ENotificationChannel } from '../enums/notification-channel.enum';

export class NotificationJobData {
    @ApiProperty({ description: 'ID da notificação' })
    @IsUUID()
    notificationId: string;

    @ApiProperty({ description: 'ID do contrato' })
    @IsUUID()
    contractId: string;

    @ApiProperty({ description: 'ID do vendedor' })
    @IsUUID()
    sellerId: string;

    @ApiProperty({ description: 'Tipo da notificação', enum: ENotificationType })
    @IsEnum(ENotificationType)
    type: ENotificationType;

    @ApiProperty({ description: 'Canal da notificação', enum: ENotificationChannel })
    @IsEnum(ENotificationChannel)
    channel: ENotificationChannel;

    @ApiProperty({ description: 'Conteúdo da notificação' })
    @IsString()
    content: string;
}
