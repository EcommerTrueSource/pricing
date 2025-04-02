import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

export class WebhookDto {
    @ApiProperty({
        description: 'CNPJ do vendedor',
        example: '12.345.678/0001-90',
    })
    @IsString()
    @Matches(/^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$/, {
        message: 'CNPJ deve estar no formato XX.XXX.XXX/XXXX-XX',
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
        example: '(11) 99999-9999',
    })
    @IsString()
    @Matches(/^\(\d{2}\) \d{4,5}\-\d{4}$/, {
        message: 'Telefone deve estar no formato (XX) XXXXX-XXXX',
    })
    telefone: string;
}
