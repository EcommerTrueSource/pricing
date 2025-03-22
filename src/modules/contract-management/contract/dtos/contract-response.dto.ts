import { ApiProperty } from '@nestjs/swagger';
import { EContractStatus } from '../enums/contract-status.enum';

export class ContractResponseDto {
  @ApiProperty({ description: 'ID único do contrato' })
  id!: string;

  @ApiProperty({ description: 'ID do vendedor' })
  sellerId!: string;

  @ApiProperty({ description: 'ID do template' })
  templateId!: string;

  @ApiProperty({ description: 'Status atual do contrato', enum: EContractStatus })
  status!: EContractStatus;

  @ApiProperty({ description: 'Conteúdo do contrato' })
  content!: string;

  @ApiProperty({ description: 'ID externo do contrato (Autentique)', required: false })
  externalId?: string;

  @ApiProperty({ description: 'URL para assinatura', required: false })
  signingUrl?: string;

  @ApiProperty({ description: 'Número de tentativas de notificação' })
  notificationAttempts!: number;

  @ApiProperty({ description: 'Data da última notificação', required: false })
  lastNotificationAt?: Date;

  @ApiProperty({ description: 'Data de assinatura', required: false })
  signedAt?: Date;

  @ApiProperty({ description: 'Data de expiração' })
  expiresAt!: Date;

  @ApiProperty({ description: 'Data de criação do registro' })
  createdAt!: Date;

  @ApiProperty({ description: 'Data de atualização do registro' })
  updatedAt!: Date;
}
