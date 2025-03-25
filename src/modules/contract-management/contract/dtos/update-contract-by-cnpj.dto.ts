import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class UpdateContractByCnpjDto {
  @ApiProperty({
    description: 'CNPJ do seller',
    example: '56080172000177',
  })
  @IsString()
  @Matches(/^\d{14}$/, {
    message: 'CNPJ deve conter exatamente 14 dígitos numéricos',
  })
  cnpj: string;
}
