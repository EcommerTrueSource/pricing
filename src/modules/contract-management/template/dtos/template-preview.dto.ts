import { ApiProperty } from '@nestjs/swagger';

export class TemplatePreviewDto {
    @ApiProperty({
        description: 'Nome da empresa',
        example: 'Empresa Exemplo LTDA',
    })
    companyName!: string;

    @ApiProperty({
        description: 'CNPJ da empresa',
        example: '12345678000190',
    })
    companyCnpj!: string;

    @ApiProperty({
        description: 'Endereço completo da empresa',
        example: 'Rua Exemplo, 123 - Centro - São Paulo/SP',
    })
    companyAddress!: string;

    @ApiProperty({
        description: 'Data do contrato',
        example: '24/03/2024',
    })
    date!: string;
}
