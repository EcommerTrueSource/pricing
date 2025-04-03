import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';

export class UpdateContractDto {
    @ApiProperty({ description: 'ID do vendedor', required: false })
    @IsOptional()
    @IsUUID()
    sellerId?: string;

    @ApiProperty({ description: 'ID do template', required: false })
    @IsOptional()
    @IsUUID()
    templateId?: string;

    @ApiProperty({ description: 'Conteúdo do contrato', required: false })
    @IsOptional()
    @IsString()
    content?: string;

    @ApiProperty({ description: 'Data de expiração do contrato', required: false })
    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}
