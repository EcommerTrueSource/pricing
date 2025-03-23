import { Controller, Post, Body, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import * as puppeteer from 'puppeteer';
import { ContractTemplateService } from '../services/contract-template.service';
import { ContractDataDto } from '../../contract/dtos/contract-data.dto';

@ApiTags('templates-preview')
@Controller('templates-preview')
export class TemplatePreviewController {
  constructor(private readonly contractTemplateService: ContractTemplateService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Visualizar template do contrato' })
  @ApiResponse({ status: 200, description: 'Retorna o HTML do template' })
  @ApiBody({
    type: ContractDataDto,
    examples: {
      example1: {
        value: {
          contractNumber: '123',
          companyName: 'Empresa Teste',
          companyCnpj: '12345678901234',
          companyAddress: 'Rua Teste, 123',
          contractDuration: 12,
          commissionRate: 5,
          paymentDay: 5,
          jurisdiction: 'São Paulo',
          city: 'São Paulo',
        },
      },
    },
  })
  async previewTemplate(@Body() contractData: ContractDataDto, @Res() res: Response) {
    console.log('Preview template - Dados recebidos:', contractData);
    try {
      const content = await this.contractTemplateService.generateContract('preview', contractData);
      console.log('Preview template - Conteúdo gerado com sucesso');

      // Envia o HTML com o Content-Security-Policy adequado
      res.setHeader('Content-Type', 'text/html');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data: https://fonts.gstatic.com",
      );
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Preview do Contrato</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                font-family: Arial, sans-serif;
              }
              .preview-container {
                max-width: 210mm;
                margin: 0 auto;
                background: white;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                padding: 20mm;
              }
              @media print {
                body {
                  padding: 0;
                }
                .preview-container {
                  box-shadow: none;
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="preview-container">
              ${content}
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Preview template - Erro:', error);
      throw error;
    }
  }

  @Post('download')
  @ApiOperation({ summary: 'Baixar template do contrato em PDF' })
  @ApiResponse({ status: 200, description: 'Retorna o PDF do template' })
  @ApiBody({
    type: ContractDataDto,
    examples: {
      example1: {
        value: {
          contractNumber: '123',
          companyName: 'Empresa Teste',
          companyCnpj: '12345678901234',
          companyAddress: 'Rua Teste, 123',
          contractDuration: 12,
          commissionRate: 5,
          paymentDay: 5,
          jurisdiction: 'São Paulo',
          city: 'São Paulo',
        },
      },
    },
  })
  async downloadTemplate(@Body() contractData: ContractDataDto, @Res() res: Response) {
    console.log('Download template - Dados recebidos:', contractData);
    try {
      const content = await this.contractTemplateService.generateContract('preview', contractData);
      console.log('Download template - Conteúdo gerado com sucesso');

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();

      // Configura o conteúdo com estilos adequados
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body {
                margin: 0;
                padding: 20mm;
                font-family: Arial, sans-serif;
              }
              @page {
                size: A4;
                margin: 20mm;
              }
              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            ${content}
          </body>
        </html>
      `);

      // Aguarda o carregamento completo
      await page.evaluateHandle('document.fonts.ready');

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
      });

      await browser.close();
      console.log('Download template - PDF gerado com sucesso');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=template-contrato.pdf');
      res.send(pdf);
    } catch (error) {
      console.error('Download template - Erro:', error);
      throw error;
    }
  }
}
