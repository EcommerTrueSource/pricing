import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class MercosClienteData {
    @ApiProperty({ description: 'CNPJ do cliente' })
    @IsString()
    cliente_cnpj: string;

    @ApiProperty({ description: 'Email do cliente', type: [String] })
    @IsArray()
    cliente_email: string[];

    @ApiProperty({ description: 'Telefone do cliente', type: [String] })
    @IsArray()
    cliente_telefone: string[];
}

export class MercosEventoData {
    @ApiProperty({ description: 'Tipo de evento', example: 'pedido.gerado' })
    @IsString()
    evento: string;

    @ApiProperty({ description: 'Dados do evento' })
    @IsObject()
    @ValidateNested()
    @Type(() => MercosClienteData)
    dados: MercosClienteData;
}

export class MercosWebhookItem {
    @ApiProperty({ description: 'Cabeçalhos da requisição' })
    @IsObject()
    headers: Record<string, any>;

    @ApiProperty({ description: 'Parâmetros da requisição' })
    @IsObject()
    params: Record<string, any>;

    @ApiProperty({ description: 'Query da requisição' })
    @IsObject()
    query: Record<string, any>;

    @ApiProperty({ description: 'Corpo da requisição' })
    @IsObject()
    @ValidateNested()
    @Type(() => MercosEventoData)
    body: MercosEventoData;

    @ApiProperty({ description: 'URL do webhook' })
    @IsString()
    webhookUrl: string;

    @ApiProperty({ description: 'Modo de execução' })
    @IsString()
    executionMode: string;
}

export class MercosWebhookDto {
    @ApiProperty({ description: 'Array de itens do webhook', type: [MercosWebhookItem] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MercosWebhookItem)
    webhookItems: MercosWebhookItem[];
}
