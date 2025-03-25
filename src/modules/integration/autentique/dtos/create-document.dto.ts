import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class SignerDto {
  @ApiProperty({ description: 'Nome do signatário' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Email do signatário' })
  @IsEmail()
  email: string;
}

export class CreateDocumentDto {
  @ApiProperty({ description: 'Nome do documento' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Conteúdo do documento' })
  @IsString()
  content: string;

  @ApiProperty({ type: [SignerDto], description: 'Lista de signatários' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignerDto)
  signers: SignerDto[];
}
