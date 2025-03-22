import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsEnum, MinLength, Min, Max } from 'class-validator';
import { ENotificationType } from '../enums/notification-type.enum';
import { ENotificationChannel } from '../enums/notification-channel.enum';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'ID do contrato',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty({ message: 'O ID do contrato é obrigatório' })
  contractId!: string;

  @ApiProperty({
    description: 'ID do vendedor',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty({ message: 'O ID do vendedor é obrigatório' })
  sellerId!: string;

  @ApiProperty({
    description: 'Tipo da notificação',
    enum: ENotificationType,
    example: ENotificationType.SIGNATURE_PENDING,
  })
  @IsEnum(ENotificationType, {
    message: 'Tipo de notificação inválido',
  })
  @IsNotEmpty({ message: 'O tipo da notificação é obrigatório' })
  type!: ENotificationType;

  @ApiProperty({
    description: 'Canal da notificação',
    enum: ENotificationChannel,
    example: ENotificationChannel.WHATSAPP,
  })
  @IsEnum(ENotificationChannel, {
    message: 'Canal de notificação inválido',
  })
  @IsNotEmpty({ message: 'O canal da notificação é obrigatório' })
  channel!: ENotificationChannel;

  @ApiProperty({
    description: 'Conteúdo da notificação',
    example: 'Olá! Por favor, assine o contrato #123.',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty({ message: 'O conteúdo da notificação é obrigatório' })
  @MinLength(10, {
    message: 'O conteúdo da notificação deve ter no mínimo 10 caracteres',
  })
  content!: string;

  @ApiProperty({
    description: 'Número da tentativa de envio (1-5)',
    example: 1,
    minimum: 1,
    maximum: 5,
  })
  @Min(1, { message: 'O número da tentativa deve ser maior ou igual a 1' })
  @Max(5, { message: 'O número da tentativa deve ser menor ou igual a 5' })
  attemptNumber!: number;
}
