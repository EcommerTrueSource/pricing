import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum EAutentiqueEventType {
    DOCUMENT_CREATED = 'document.created',
    DOCUMENT_UPDATED = 'document.updated',
    DOCUMENT_DELETED = 'document.deleted',
    DOCUMENT_FINISHED = 'document.finished',
    SIGNATURE_CREATED = 'signature.created',
    SIGNATURE_UPDATED = 'signature.updated',
    SIGNATURE_DELETED = 'signature.deleted',
    SIGNATURE_VIEWED = 'signature.viewed',
    SIGNATURE_ACCEPTED = 'signature.accepted',
    SIGNATURE_REJECTED = 'signature.rejected',
    SIGNATURE_BIOMETRIC_APPROVED = 'signature.biometric_approved',
    SIGNATURE_BIOMETRIC_UNAPPROVED = 'signature.biometric_unapproved',
    SIGNATURE_BIOMETRIC_REJECTED = 'signature.biometric_rejected',
}

export class AutentiqueUserDto {
    @ApiProperty({ description: 'UUID do usuário' })
    @IsString()
    uuid: string;

    @ApiProperty({ description: 'Nome do usuário', required: false })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({ description: 'Email do usuário' })
    @IsString()
    email: string;

    @ApiProperty({ description: 'CPF do usuário', required: false })
    @IsString()
    @IsOptional()
    cpf?: string;

    @ApiProperty({ description: 'Data de nascimento do usuário', required: false })
    @IsString()
    @IsOptional()
    birthday?: string;
}

export class AutentiqueGeolocationDto {
    @ApiProperty({ description: 'País' })
    @IsString()
    country: string;

    @ApiProperty({ description: 'Código ISO do país' })
    @IsString()
    countryISO: string;

    @ApiProperty({ description: 'Estado' })
    @IsString()
    state: string;

    @ApiProperty({ description: 'Código ISO do estado' })
    @IsString()
    stateISO: string;

    @ApiProperty({ description: 'Cidade' })
    @IsString()
    city: string;

    @ApiProperty({ description: 'CEP' })
    @IsString()
    zipcode: string;

    @ApiProperty({ description: 'Latitude' })
    @IsString()
    latitude: string;

    @ApiProperty({ description: 'Longitude' })
    @IsString()
    longitude: string;
}

export class AutentiqueSignatureDto {
    @ApiProperty({ description: 'ID do documento' })
    @IsString()
    document: string;

    @ApiProperty({ description: 'Dados do usuário' })
    @ValidateNested()
    @Type(() => AutentiqueUserDto)
    user: AutentiqueUserDto;

    @ApiProperty({ description: 'Dados de geolocalização' })
    @ValidateNested()
    @Type(() => AutentiqueGeolocationDto)
    geolocation: AutentiqueGeolocationDto;

    @ApiProperty({ description: 'Motivo da rejeição', required: false })
    @IsString()
    @IsOptional()
    reason?: string;

    @ApiProperty({ description: 'IP do usuário' })
    @IsString()
    ip: string;

    @ApiProperty({ description: 'Porta do usuário' })
    @IsString()
    port: string;

    @ApiProperty({ description: 'Data de criação' })
    @IsString()
    created_at: string;
}

export class AutentiqueWebhookEventDto {
    @ApiProperty({ description: 'ID do webhook' })
    @IsString()
    id: string;

    @ApiProperty({ description: 'Tipo do objeto' })
    @IsString()
    object: string;

    @ApiProperty({ description: 'Nome do webhook' })
    @IsString()
    name: string;

    @ApiProperty({ description: 'Formato do webhook' })
    @IsString()
    format: string;

    @ApiProperty({ description: 'URL do webhook' })
    @IsString()
    url: string;

    @ApiProperty({ description: 'Dados do evento' })
    @IsObject()
    event: {
        id: string;
        object: string;
        organization: number;
        type: EAutentiqueEventType;
        data: {
            object: any;
            previous_attributes?: any;
        };
        created_at: string;
    };
}
