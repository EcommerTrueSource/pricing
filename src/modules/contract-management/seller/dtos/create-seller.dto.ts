import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, Matches, MinLength } from 'class-validator';

export class CreateSellerDto {
  @ApiProperty({ description: 'CNPJ do vendedor' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{14}$/, { message: 'CNPJ deve conter 14 dígitos numéricos' })
  cnpj!: string;

  @ApiProperty({ description: 'Razão social do vendedor' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  razaoSocial!: string;

  @ApiProperty({ description: 'Email do vendedor' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ description: 'Telefone do vendedor' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9][0-9]{10,14}$/, { message: 'Telefone inválido' })
  telefone!: string;

  @ApiProperty({ description: 'Endereço do vendedor' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  endereco!: string;
}
