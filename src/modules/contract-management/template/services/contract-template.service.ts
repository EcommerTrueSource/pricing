import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import * as Handlebars from 'handlebars';
import { GoogleDocsService } from './google-docs.service';

@Injectable()
export class ContractTemplateService {
  private template!: string;
  private readonly TEMPLATE_DOC_ID = 'SEU_DOCUMENT_ID'; // ID do documento do Google Docs

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleDocsService: GoogleDocsService,
  ) {
    this.loadTemplate();
  }

  private async loadTemplate() {
    try {
      // Carrega o template do Google Docs
      this.template = await this.googleDocsService.getDocument(this.TEMPLATE_DOC_ID);
      console.log('Template carregado com sucesso do Google Docs');
    } catch (error: unknown) {
      console.error('Erro ao carregar o template:', error);
      if (error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
      throw new Error('Não foi possível carregar o template do contrato');
    }
  }

  async generateContract(sellerId: string, contractData: any): Promise<string> {
    let sellerData = {
      razao_social: 'NOME DO VENDEDOR',
      cnpj: 'CNPJ DO VENDEDOR',
      endereco: 'ENDEREÇO DO VENDEDOR',
    };

    // Se não for preview, busca os dados do vendedor
    if (sellerId !== 'preview') {
      const seller = await this.prisma.sellers.findUnique({
        where: { id: sellerId },
      });

      if (!seller) {
        throw new Error('Vendedor não encontrado');
      }

      sellerData = {
        razao_social: seller.razao_social,
        cnpj: seller.cnpj,
        endereco: seller.endereco || 'Endereço não informado',
      };
    }

    // Prepara os dados para o template
    const templateData = {
      contractNumber: contractData.contractNumber,
      companyName: contractData.companyName,
      companyCnpj: contractData.companyCnpj,
      companyAddress: contractData.companyAddress,
      sellerName: sellerData.razao_social,
      sellerCnpj: sellerData.cnpj,
      sellerAddress: sellerData.endereco,
      contractDuration: contractData.contractDuration,
      commissionRate: contractData.commissionRate,
      paymentDay: contractData.paymentDay,
      jurisdiction: contractData.jurisdiction,
      city: contractData.city,
      date: new Date().toLocaleDateString('pt-BR'),
    };

    // Compila e renderiza o template
    const template = Handlebars.compile(this.template);
    return template(templateData);
  }

  async createTemplate(): Promise<void> {
    // Verifica se já existe um template ativo
    const existingTemplate = await this.prisma.templates.findFirst({
      where: { is_active: true },
    });

    if (existingTemplate) {
      // Desativa o template existente
      await this.prisma.templates.update({
        where: { id: existingTemplate.id },
        data: { is_active: false },
      });
    }

    // Cria o novo template
    await this.prisma.templates.create({
      data: {
        name: 'Contrato de Prestação de Serviços',
        content: this.template,
        version: '1.0.0',
        is_active: true,
      },
    });
  }
}
