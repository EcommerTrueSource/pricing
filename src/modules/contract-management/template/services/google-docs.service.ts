import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import * as path from 'path';

@Injectable()
export class GoogleDocsService {
  private docs: any;

  constructor() {
    this.initializeGoogleDocs();
  }

  private async initializeGoogleDocs() {
    try {
      // Autenticação usando credenciais
      const auth = await authenticate({
        keyfilePath: path.join(process.cwd(), 'credentials.json'),
        scopes: ['https://www.googleapis.com/auth/documents.readonly'],
      });

      // Inicializa o cliente do Google Docs
      this.docs = google.docs({ version: 'v1', auth });
    } catch (error) {
      console.error('Erro ao inicializar Google Docs:', error);
      throw error;
    }
  }

  async getDocument(documentId: string): Promise<string> {
    try {
      // Busca o documento
      const response = await this.docs.documents.get({
        documentId,
      });

      // Converte o documento para HTML
      let html = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
      html += '<style>';
      html += `
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
      `;
      html += '</style></head><body><div class="container">';

      // Processa o conteúdo do documento
      const content = response.data.body.content;
      for (const element of content) {
        if (element.paragraph) {
          const paragraph = element.paragraph;
          let text = '';

          // Processa os elementos do parágrafo
          for (const element of paragraph.elements) {
            if (element.textRun) {
              const style = element.textRun.textStyle || {};
              let formattedText = element.textRun.content;

              // Aplica formatação
              if (style.bold) formattedText = `<strong>${formattedText}</strong>`;
              if (style.italic) formattedText = `<em>${formattedText}</em>`;
              if (style.underline) formattedText = `<u>${formattedText}</u>`;

              text += formattedText;
            }
          }

          // Adiciona o parágrafo ao HTML
          if (paragraph.paragraphStyle?.namedStyleType === 'HEADING_1') {
            html += `<h1>${text}</h1>`;
          } else if (paragraph.paragraphStyle?.namedStyleType === 'HEADING_2') {
            html += `<h2>${text}</h2>`;
          } else {
            html += `<p>${text}</p>`;
          }
        }
      }

      html += '</div></body></html>';
      return html;
    } catch (error) {
      console.error('Erro ao buscar documento:', error);
      throw error;
    }
  }
}
