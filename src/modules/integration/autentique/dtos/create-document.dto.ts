import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ValidateNested, IsEmail, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class SignerDto {
    @ApiProperty({ description: 'Nome do signatário' })
    @IsString()
    name: string;

    @ApiProperty({ description: 'Email do signatário' })
    @IsEmail()
    email: string;

    @ApiProperty({ description: 'Ação do signatário', example: 'SIGN' })
    @IsString()
    @IsOptional()
    action?: string;
}

export class CreateDocumentOptionsDto {
    @ApiProperty({ description: 'Se deve gerar link curto para assinatura', default: true })
    @IsBoolean()
    @IsOptional()
    short_link?: boolean;
}

export class CreateDocumentDto {
    @ApiProperty({ description: 'Nome do documento' })
    @IsString()
    name: string;

    @ApiProperty({ description: 'Conteúdo do documento' })
    @IsString()
    content: string;

    @ApiProperty({ type: [SignerDto], description: 'Lista de signatários' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SignerDto)
    signers: SignerDto[];

    @ApiProperty({ type: CreateDocumentOptionsDto, description: 'Opções de criação do documento' })
    @ValidateNested()
    @Type(() => CreateDocumentOptionsDto)
    @IsOptional()
    options?: CreateDocumentOptionsDto;
}
