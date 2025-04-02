import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsInt, Min, Max, IsObject } from 'class-validator';

export class SellerDataDto {
    @ApiProperty({ description: 'ID do vendedor' })
    @IsNotEmpty()
    @IsString()
    id!: string;

    @ApiProperty({ description: 'CNPJ do vendedor' })
    @IsNotEmpty()
    @IsString()
    cnpj!: string;

    @ApiProperty({ description: 'Razão social do vendedor' })
    @IsNotEmpty()
    @IsString()
    razao_social!: string;

    @ApiProperty({ description: 'Email do vendedor' })
    @IsNotEmpty()
    @IsString()
    email!: string;

    @ApiProperty({ description: 'Telefone do vendedor' })
    @IsNotEmpty()
    @IsString()
    telefone!: string;

    @ApiProperty({ description: 'Endereço do vendedor' })
    @IsNotEmpty()
    @IsString()
    endereco!: string;
}

export class ContractDataDto {
    @ApiProperty({ description: 'Número do contrato' })
    @IsNotEmpty()
    @IsString()
    contractNumber!: string;

    @ApiProperty({ description: 'Nome da empresa contratante' })
    @IsNotEmpty()
    @IsString()
    companyName!: string;

    @ApiProperty({ description: 'CNPJ da empresa contratante' })
    @IsNotEmpty()
    @IsString()
    companyCnpj!: string;

    @ApiProperty({ description: 'Endereço da empresa contratante' })
    @IsNotEmpty()
    @IsString()
    companyAddress!: string;

    @ApiProperty({ description: 'Duração do contrato em meses' })
    @IsNotEmpty()
    @IsInt()
    @Min(1)
    @Max(60)
    contractDuration!: number;

    @ApiProperty({ description: 'Taxa de comissão em porcentagem' })
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    @Max(100)
    commissionRate!: number;

    @ApiProperty({ description: 'Dia do mês para pagamento' })
    @IsNotEmpty()
    @IsInt()
    @Min(1)
    @Max(31)
    paymentDay!: number;

    @ApiProperty({ description: 'Foro de jurisdição' })
    @IsNotEmpty()
    @IsString()
    jurisdiction!: string;

    @ApiProperty({ description: 'Cidade de assinatura' })
    @IsNotEmpty()
    @IsString()
    city!: string;

    @ApiProperty({ description: 'Dados do vendedor' })
    @IsNotEmpty()
    @IsObject()
    seller!: SellerDataDto;
}
