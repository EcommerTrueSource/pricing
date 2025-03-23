import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsInt, Min, Max } from 'class-validator';

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
}
