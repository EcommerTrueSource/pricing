import { Controller, Get, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { GoogleDocsService } from '../services/google-docs.service';

@ApiTags('templates')
@Controller('templates/preview')
export class TemplatePreviewController {
  private readonly logger = new Logger(TemplatePreviewController.name);
  private readonly documentId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly googleDocsService: GoogleDocsService,
  ) {
    const docId = this.configService.get<string>('GOOGLE_DOC_ID');
    if (!docId) {
      throw new Error('ID do documento do Google Docs não configurado');
    }
    this.documentId = docId;
  }

  @Get('mock')
  @ApiOperation({ summary: 'Visualizar template com dados mockados' })
  @ApiResponse({ status: 200, description: 'URL para preview do template com dados mockados' })
  @ApiResponse({ status: 400, description: 'Erro ao gerar preview mockado' })
  async previewMockTemplate() {
    try {
      if (!this.documentId) {
        throw new HttpException('ID do documento não configurado', HttpStatus.BAD_REQUEST);
      }

      // Dados mockados para o template
      const mockData = {
        seller: {
          name: 'Vendedor Exemplo LTDA',
          cnpj: '12.345.678/0001-90',
          address: 'Rua Exemplo, 123 - São Paulo/SP',
        },
        date: new Date().toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      };

      // Criar uma cópia do documento com os dados mockados
      const filledDocId = await this.googleDocsService.createFilledTemplate(
        this.documentId,
        mockData,
      );

      // URL para visualização do documento preenchido
      const downloadUrl = `https://docs.google.com/document/d/${filledDocId}/export?format=pdf`;

      return { downloadUrl };
    } catch (error: unknown) {
      this.logger.error('Erro ao gerar preview mockado:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Erro ao gerar preview mockado',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('download')
  @ApiOperation({ summary: 'Baixar template ativo em PDF' })
  @ApiResponse({ status: 200, description: 'URL para download do PDF' })
  @ApiResponse({ status: 400, description: 'Erro ao gerar URL de download' })
  async downloadTemplate() {
    try {
      if (!this.documentId) {
        throw new HttpException('ID do documento não configurado', HttpStatus.BAD_REQUEST);
      }

      // URL para download direto do PDF
      const downloadUrl = `https://docs.google.com/document/d/${this.documentId}/export?format=pdf`;

      return { downloadUrl };
    } catch (error: unknown) {
      this.logger.error('Erro ao gerar URL de download:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Erro ao gerar URL de download',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
