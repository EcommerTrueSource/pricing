import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

export class WebhookDto {
    @ApiProperty({
        description: 'CNPJ do vendedor',
        example: '38308523000172',
    })
    @IsString()
    @Matches(/^\d{14}$/, {
        message: 'CNPJ deve conter apenas números',
    })
    cnpj: string;

    @ApiProperty({
        description: 'Email do vendedor',
        example: 'vendedor@empresa.com.br',
    })
    @IsEmail({}, { message: 'Email inválido' })
    email: string;

    @ApiProperty({
        description: 'Telefone do vendedor',
        example: '27992594304',
    })
    @IsString()
    @Matches(/^\d{10,11}$/, {
        message: 'Telefone deve conter apenas números (10 ou 11 dígitos)',
    })
    telefone: string;
}
