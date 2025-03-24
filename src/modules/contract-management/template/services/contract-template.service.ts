import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleDocsService } from './google-docs.service';
import { PrismaService } from '../../../../shared/services/prisma.service';
import * as Handlebars from 'handlebars';
import * as puppeteer from 'puppeteer';

@Injectable()
export class ContractTemplateService implements OnModuleInit {
  private readonly logger = new Logger(ContractTemplateService.name);
  private readonly documentId: string;
  private activeTemplate: any = null;

  constructor(
    private readonly googleDocsService: GoogleDocsService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const docId = this.configService.get<string>('GOOGLE_DOC_ID');
    if (!docId) {
      this.logger.error('GOOGLE_DOC_ID não está configurado no .env.local');
      throw new Error('ID do documento do Google Docs não configurado');
    }
    this.documentId = docId;
    this.logger.log(`ID do documento configurado: ${docId}`);

    // Registra helpers do Handlebars
    Handlebars.registerHelper('nome.seller', function (context) {
      return context?.seller?.name || '';
    });

    Handlebars.registerHelper('CNPJ', function (context) {
      return context?.seller?.cnpj || '';
    });

    Handlebars.registerHelper('endereco', function (context) {
      return context?.seller?.address || '';
    });

    Handlebars.registerHelper('data', function () {
      const date = new Date();
      const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return formatter.format(date);
    });

    // Novos helpers para os campos do ContractDataDto
    Handlebars.registerHelper('numero.contrato', function (context) {
      return context?.contractNumber || '';
    });

    Handlebars.registerHelper('duracao.contrato', function (context) {
      return context?.contractDuration || '';
    });

    Handlebars.registerHelper('taxa.comissao', function (context) {
      return context?.commissionRate || '';
    });

    Handlebars.registerHelper('dia.pagamento', function (context) {
      return context?.paymentDay || '';
    });

    Handlebars.registerHelper('foro', function (context) {
      return context?.jurisdiction || '';
    });

    Handlebars.registerHelper('cidade', function (context) {
      return context?.city || '';
    });
  }

  async onModuleInit() {
    await this.syncTemplateFromGoogleDocs();
  }

  async syncTemplateFromGoogleDocs() {
    try {
      this.logger.log('Iniciando sincronização do template do Google Docs');
      const content = await this.googleDocsService.getDocument(this.documentId);

      // Verifica se já existe um template ativo
      const existingTemplate = await this.prisma.templates.findFirst({
        where: { is_active: true },
      });

      if (existingTemplate) {
        // Atualiza o template existente
        const updatedTemplate = await this.prisma.templates.update({
          where: { id: existingTemplate.id },
          data: {
            content,
            version: this.incrementVersion(existingTemplate.version),
            updated_at: new Date(),
          },
        });
        this.activeTemplate = updatedTemplate;
        this.logger.log(`Template atualizado para versão ${updatedTemplate.version}`);
      } else {
        // Cria um novo template
        const newTemplate = await this.prisma.templates.create({
          data: {
            name: 'Template Principal',
            content,
            version: '1.0.0',
            is_active: true,
          },
        });
        this.activeTemplate = newTemplate;
        this.logger.log('Novo template criado com sucesso');
      }
    } catch (error) {
      this.logger.error('Erro ao sincronizar template:', error);
      throw error;
    }
  }

  async forceTemplateUpdate() {
    this.logger.log('Forçando atualização do template');
    await this.syncTemplateFromGoogleDocs();
  }

  async getActiveTemplate() {
    if (!this.activeTemplate) {
      await this.syncTemplateFromGoogleDocs();
    }
    return this.activeTemplate;
  }

  private incrementVersion(currentVersion: string): string {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    return `${major}.${minor}.${patch + 1}`;
  }

  private wrapWithStyles(html: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              margin: 0;
              padding: 0;
              background: white;
              color: #333;
            }
            .container {
              max-width: 210mm;
              margin: 0 auto;
              padding: 20mm;
            }
            @page {
              size: A4;
              margin: 20mm;
            }
            @media print {
              body { margin: 0; }
              .container { padding: 0; }
            }
            h1, h2 {
              color: #2c3e50;
              margin-top: 1.5em;
              margin-bottom: 0.5em;
            }
            p {
              margin-bottom: 1em;
              text-align: justify;
            }
            .signature-section {
              margin-top: 3em;
              text-align: right;
            }
            .date {
              margin-top: 2em;
              text-align: right;
            }
          </style>
        </head>
        <body>
          <div class="container">
            ${html}
          </div>
        </body>
      </html>
    `;
  }

  async generateContract(data: Record<string, any>): Promise<string> {
    try {
      // Obtém o template ativo do banco
      const template = await this.getActiveTemplate();

      if (!template?.content) {
        this.logger.error('Template encontrado mas sem conteúdo');
        throw new Error('Template sem conteúdo');
      }

      this.logger.debug('Conteúdo do template:', template.content);
      this.logger.debug('Gerando contrato com os dados:', data);

      // Mapeia os dados para o formato esperado pelo template
      const templateData = {
        seller: {
          name: data.seller?.name,
          cnpj: data.seller?.cnpj,
          address: data.seller?.address,
        },
      };

      this.logger.debug('Dados mapeados para o template:', templateData);

      try {
        // Compila o template com Handlebars
        const compiledTemplate = Handlebars.compile(template.content, {
          strict: false,
          noEscape: true,
        });

        // Substitui as variáveis no template
        const html = compiledTemplate(templateData);
        this.logger.debug('HTML gerado:', html);

        // Adiciona os estilos e estrutura HTML
        return this.wrapWithStyles(html);
      } catch (handlebarsError) {
        this.logger.error('Erro ao compilar template com Handlebars:', handlebarsError);
        this.logger.error('Template que causou erro:', template.content);
        throw new Error('Erro ao processar o template do contrato');
      }
    } catch (error) {
      this.logger.error('Erro ao gerar contrato:', error);
      if (error instanceof Error) {
        this.logger.error('Stack trace:', error.stack);
      }
      throw error;
    }
  }

  async generatePDF(html: string): Promise<Buffer> {
    try {
      // Inicializa o Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      // Cria uma nova página
      const page = await browser.newPage();

      // Define o conteúdo HTML
      await page.setContent(html, {
        waitUntil: 'networkidle0',
      });

      // Gera o PDF
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm',
        },
      });

      // Fecha o navegador
      await browser.close();

      return Buffer.from(pdf);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      throw new Error('Não foi possível gerar o PDF do contrato');
    }
  }

  async previewContract(data: Record<string, any>): Promise<string> {
    try {
      const html = await this.generateContract(data);
      return html;
    } catch (error) {
      console.error('Erro ao gerar preview do contrato:', error);
      throw new Error('Não foi possível gerar o preview do contrato');
    }
  }

  async downloadContract(data: Record<string, any>): Promise<Buffer> {
    try {
      const html = await this.generateContract(data);
      const pdf = await this.generatePDF(html);
      return pdf;
    } catch (error) {
      console.error('Erro ao gerar download do contrato:', error);
      throw new Error('Não foi possível gerar o download do contrato');
    }
  }

  async testGoogleDocsConnection(documentId: string): Promise<string> {
    try {
      this.logger.log(`Testando conexão com Google Docs para documento: ${documentId}`);
      const content = await this.googleDocsService.getDocument(documentId);

      if (!content) {
        throw new Error('Conteúdo do documento não encontrado');
      }

      this.logger.log('Conexão com Google Docs estabelecida com sucesso');
      return content;
    } catch (error) {
      this.logger.error('Erro ao testar conexão com Google Docs:', error);
      throw error;
    }
  }

  async createContractForSeller(
    sellerData: { cnpj: string; razaoSocial: string },
    contractData: any,
  ): Promise<string> {
    try {
      const documentId = this.configService.get<string>('GOOGLE_DOC_ID');

      if (!documentId) {
        throw new Error('ID do documento do Google Docs não configurado');
      }

      return await this.googleDocsService.createContractForSeller(
        documentId,
        sellerData,
        contractData,
      );
    } catch (error) {
      this.logger.error('Erro ao criar contrato para seller:', error);
      throw error;
    }
  }
}
