import { ApiProperty } from '@nestjs/swagger';

export class TemplateResponseDto {
  @ApiProperty({ description: 'ID único do template' })
  id!: string;

  @ApiProperty({ description: 'Nome do template' })
  name!: string;

  @ApiProperty({ description: 'Conteúdo do template com placeholders' })
  content!: string;

  @ApiProperty({ description: 'Versão do template' })
  version!: string;

  @ApiProperty({ description: 'Indica se o template está ativo' })
  isActive!: boolean;

  @ApiProperty({ description: 'Data de criação do registro' })
  createdAt!: Date;

  @ApiProperty({ description: 'Data de atualização do registro' })
  updatedAt!: Date;
}
