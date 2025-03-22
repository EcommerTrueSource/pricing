import { ApiProperty } from '@nestjs/swagger';

export class SellerResponseDto {
  @ApiProperty({ description: 'ID único do vendedor' })
  id!: string;

  @ApiProperty({ description: 'CNPJ do vendedor' })
  cnpj!: string;

  @ApiProperty({ description: 'Razão social do vendedor' })
  razaoSocial!: string;

  @ApiProperty({ description: 'Email do vendedor' })
  email!: string;

  @ApiProperty({ description: 'Telefone do vendedor' })
  telefone!: string;

  @ApiProperty({ description: 'Endereço do vendedor' })
  endereco!: string;

  @ApiProperty({ description: 'Data de criação do registro' })
  createdAt!: Date;

  @ApiProperty({ description: 'Data de atualização do registro' })
  updatedAt!: Date;
}
