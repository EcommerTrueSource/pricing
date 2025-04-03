import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class CreateTemplateDto {
    @ApiProperty({ description: 'Nome do template' })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    name!: string;

    @ApiProperty({ description: 'Conteúdo do template com placeholders' })
    @IsString()
    @IsNotEmpty()
    @MinLength(100)
    content!: string;

    @ApiProperty({ description: 'Versão do template (formato: X.Y.Z)' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^\d+\.\d+\.\d+$/, { message: 'Versão deve seguir o formato X.Y.Z' })
    version!: string;

    @ApiProperty({ description: 'Indica se o template está ativo' })
    @IsNotEmpty()
    isActive!: boolean;
}
