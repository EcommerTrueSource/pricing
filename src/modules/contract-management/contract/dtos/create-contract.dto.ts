import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsDateString } from 'class-validator';

export class CreateContractDto {
  @ApiProperty({ description: 'ID do vendedor' })
  @IsNotEmpty()
  @IsUUID()
  sellerId!: string;

  @ApiProperty({ description: 'ID do template' })
  @IsNotEmpty()
  @IsUUID()
  templateId!: string;

  @ApiProperty({ description: 'Conteúdo do contrato' })
  @IsNotEmpty()
  @IsString()
  content!: string;

  @ApiProperty({ description: 'Data de expiração do contrato' })
  @IsNotEmpty()
  @IsDateString()
  expiresAt!: string;
}
