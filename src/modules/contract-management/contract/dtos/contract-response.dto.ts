import { ApiProperty } from '@nestjs/swagger';
import { EContractStatus } from '../enums/contract-status.enum';

export class SellerResponseDto {
    @ApiProperty({ description: 'ID do vendedor' })
    id!: string;

    @ApiProperty({ description: 'CNPJ do vendedor' })
    cnpj!: string;

    @ApiProperty({ description: 'Razão social do vendedor' })
    razaoSocial!: string;

    @ApiProperty({ description: 'Email do vendedor' })
    email!: string;

    @ApiProperty({ description: 'Telefone do vendedor' })
    telefone!: string;

    @ApiProperty({ description: 'Endereço do vendedor', required: false })
    endereco?: string;

    @ApiProperty({ description: 'Data de criação do registro' })
    createdAt!: Date;

    @ApiProperty({ description: 'Data de atualização do registro' })
    updatedAt!: Date;
}

export class TemplateResponseDto {
    @ApiProperty({ description: 'ID do template' })
    id!: string;

    @ApiProperty({ description: 'Nome do template' })
    name!: string;

    @ApiProperty({ description: 'Conteúdo do template' })
    content!: string;

    @ApiProperty({ description: 'Versão do template' })
    version!: string;

    @ApiProperty({ description: 'Indica se o template está ativo' })
    isActive!: boolean;

    @ApiProperty({ description: 'Data de criação do registro' })
    createdAt!: Date;

    @ApiProperty({ description: 'Data de atualização do registro' })
    updatedAt!: Date;
}

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

    @ApiProperty({ description: 'Dados do vendedor', required: false })
    seller?: SellerResponseDto;

    @ApiProperty({ description: 'Dados do template', required: false })
    template?: TemplateResponseDto;

    contractsDeleted: number;
    hasMultipleContracts: boolean;
}
