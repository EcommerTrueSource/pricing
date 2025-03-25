import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAutentiqueService } from '../interfaces/autentique-service.interface';
import { IAutentiqueDocument } from '../interfaces/autentique-document.interface';
import { AutentiqueDocumentStatus } from '../interfaces/autentique-document.interface';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import axios, { AxiosInstance } from 'axios';
import { PrismaClient } from '@prisma/client';
import { contract_status } from '@prisma/client';
import { status_change_reason } from '@prisma/client';

interface IAutentiqueResponse {
  data?: any;
  errors?: Array<{
    message: string;
    locations?: Array<{
      line: number;
      column: number;
    }>;
    path?: string[];
    code?: string;
  }>;
}

@Injectable()
export class AutentiqueService implements IAutentiqueService {
  private readonly logger = new Logger(AutentiqueService.name);
  private readonly rateLimiter: RateLimiterMemory;
  private readonly httpClient: AxiosInstance;
  private readonly documentNamePattern = 'Contrato PMA True Brands - {cnpj}';
  private readonly prisma: PrismaClient;

  constructor(private readonly configService: ConfigService) {
    this.prisma = new PrismaClient();
    this.logger.debug('Inicializando AutentiqueService...');

    // Debug do ConfigService
    this.logger.debug('ConfigService disponível:', !!this.configService);

    // Listando todas as variáveis de ambiente disponíveis
    const envKeys = Object.keys(process.env);
    this.logger.debug('Variáveis de ambiente disponíveis:', envKeys);

    this.rateLimiter = new RateLimiterMemory({
      points: 10,
      duration: 1,
    });

    // Obtendo o token da API
    const apiKey = this.configService.getOrThrow<string>('AUTENTIQUE_API_KEY');

    if (!apiKey || apiKey === 'your_api_key_here') {
      this.logger.error('Token não encontrado ou inválido:', {
        hasToken: !!apiKey,
        tokenValue: apiKey,
        envKeys: Object.keys(process.env),
      });
      throw new Error('AUTENTIQUE_API_KEY não configurada corretamente no .env.local');
    }

    this.logger.debug(`Inicializando AutentiqueService com API Key: ${apiKey.substring(0, 8)}...`);

    // Configurando o cliente HTTP
    this.httpClient = axios.create({
      baseURL: 'https://api.autentique.com.br/v2/graphql',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 segundos
    });

    // Adicionando interceptor para log de requisições
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`Requisição para: ${config.method?.toUpperCase()} ${config.url}`);
        this.logger.debug(`Headers: ${JSON.stringify(config.headers)}`);
        this.logger.debug(`Data: ${JSON.stringify(config.data)}`);
        return config;
      },
      (error) => {
        this.logger.error('Erro na requisição:', error);
        return Promise.reject(error);
      },
    );

    // Adicionando interceptor para log de respostas
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`Resposta recebida: ${response.status} ${response.statusText}`);
        this.logger.debug(`Data: ${JSON.stringify(response.data)}`);
        return response;
      },
      (error) => {
        this.logger.error('Erro na resposta:', {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers,
          },
        });
        return Promise.reject(error);
      },
    );
  }

  private formatCnpj(cnpj: string): string {
    // Remove todos os caracteres não numéricos
    const cleanCnpj = cnpj.replace(/\D/g, '');

    // Formata o CNPJ com pontos e traço (XX.XXX.XXX/XXXX-XX)
    return cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  private async makeGraphQLRequest(
    query: string,
    variables: Record<string, any> = {},
  ): Promise<any> {
    try {
      await this.rateLimiter.consume('autentique-api');

      this.logger.debug('Iniciando requisição GraphQL...');
      this.logger.debug(`Query: ${query}`);
      this.logger.debug(`Variables: ${JSON.stringify(variables)}`);

      const response = await this.httpClient.post<IAutentiqueResponse>('', {
        query,
        variables,
      });

      this.logger.debug(`Resposta da API: ${JSON.stringify(response.data)}`);

      if (response.data.errors) {
        this.logger.error('Erro na resposta GraphQL:', response.data.errors);
        throw new Error(response.data.errors[0].message);
      }

      return response.data;
    } catch (error) {
      this.logger.error('Erro na requisição GraphQL:', error);
      if (error.response) {
        this.logger.error('Detalhes do erro:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        });
      }
      throw error;
    }
  }

  async findDocumentBySellerCnpj(cnpj: string): Promise<IAutentiqueDocument | null> {
    await this.rateLimiter.consume('autentique-api');

    try {
      const formattedCnpj = this.formatCnpj(cnpj);
      this.logger.debug(`Buscando documento com nome: Contrato PMA True Brands - ${formattedCnpj}`);

      const query = `
        query {
          documents(limit: 10, page: 1, name: "Contrato PMA True Brands - ${formattedCnpj}") {
            data {
              id
              name
              signed_count
              created_at
              updated_at
              expiration_at
              signatures {
                name
                email
                link {
                  short_link
                }
              }
            }
          }
        }
      `;

      const response = await this.makeGraphQLRequest(query);
      const documents = response?.data?.documents?.data || [];

      if (documents.length === 0) {
        this.logger.debug(`Nenhum documento encontrado para o CNPJ ${cnpj}`);
        return null;
      }

      const document = documents[0];
      this.logger.debug(`Documento encontrado: ${document.id}`);

      return {
        id: document.id,
        name: document.name,
        status:
          document.signed_count > 0
            ? AutentiqueDocumentStatus.SIGNED
            : AutentiqueDocumentStatus.PENDING,
        signed_count: document.signed_count || 0,
        signedAt: null,
        expiresAt: document.expiration_at,
        createdAt: new Date(document.created_at),
        updatedAt: new Date(document.updated_at),
        signatures: document.signatures.map((signature) => ({
          name: signature.name,
          email: signature.email,
          status: AutentiqueDocumentStatus.PENDING,
          signedAt: null,
          signingUrl: signature.link?.short_link || null,
        })),
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar documento por CNPJ ${cnpj}: ${error.message}`);
      this.logger.error('Detalhes do erro:', error);
      this.logger.error(`Detalhes do erro: ${JSON.stringify(error.response?.data, null, 2)}`);

      if (error.response?.status === 401) {
        this.logger.error(
          'Erro de autenticação com a API do Autentique. Verifique se a chave de API está correta.',
        );
      }
      throw error;
    }
  }

  async getDocument(documentId: string): Promise<IAutentiqueDocument> {
    await this.rateLimiter.consume('autentique-api');

    try {
      const query = `query {
        document(id: "${documentId}") {
          id
          name
          status
          created_at
          updated_at
          signed_at
          expires_at
          signatures {
            id
            name
            email
            status
            signed_at
            link {
              short_link
            }
          }
        }
      }`;

      const response = await this.makeGraphQLRequest(query);
      return this.mapDocumentResponse(response.data?.document);
    } catch (error) {
      this.logger.error(`Erro ao buscar documento ${documentId}: ${error.message}`);
      if (error.response?.status === 401) {
        this.logger.error(
          'Erro de autenticação com a API do Autentique. Verifique se a chave de API está correta.',
        );
      }
      throw error;
    }
  }

  async createDocument(
    name: string,
    content: string,
    signers: Array<{ name: string; email: string }>,
  ): Promise<IAutentiqueDocument> {
    await this.rateLimiter.consume('autentique-api');

    try {
      const mutation = `mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
        createDocument(document: $document, signers: $signers, file: $file) {
          id
          name
          status
          created_at
          updated_at
          signed_at
          expires_at
          signatures {
            id
            name
            email
            status
            signed_at
            link {
              short_link
            }
          }
        }
      }`;

      const variables = {
        document: {
          name,
        },
        signers: signers.map((signer) => ({
          email: signer.email,
          name: signer.name,
          action: 'SIGN',
        })),
        file: content,
      };

      const response = await this.makeGraphQLRequest(mutation, variables);
      return this.mapDocumentResponse(response.data?.createDocument);
    } catch (error) {
      this.logger.error(`Erro ao criar documento: ${error.message}`);
      if (error.response?.status === 401) {
        this.logger.error(
          'Erro de autenticação com a API do Autentique. Verifique se a chave de API está correta.',
        );
      }
      throw error;
    }
  }

  private mapStatus(status: string): AutentiqueDocumentStatus {
    switch (status.toUpperCase()) {
      case 'DRAFT':
        return AutentiqueDocumentStatus.PENDING;
      case 'SIGNED':
        return AutentiqueDocumentStatus.SIGNED;
      case 'EXPIRED':
        return AutentiqueDocumentStatus.EXPIRED;
      case 'CANCELLED':
        return AutentiqueDocumentStatus.CANCELLED;
      default:
        return AutentiqueDocumentStatus.PENDING;
    }
  }

  private mapDocumentResponse(data: any): IAutentiqueDocument {
    const signatures = data.signatures.map((signature) => ({
      name: signature.name,
      email: signature.email,
      status: signature.status as AutentiqueDocumentStatus,
      signedAt: signature.signed_at ? new Date(signature.signed_at) : null,
      signingUrl: signature.link?.short_link || null,
    }));

    return {
      id: data.id,
      name: data.name,
      status: data.status as AutentiqueDocumentStatus,
      signed_count: signatures.filter((sig) => sig.signedAt)?.length || 0,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      signedAt: data.signed_at ? new Date(data.signed_at) : null,
      expiresAt: data.expires_at ? new Date(data.expires_at) : null,
      signatures,
    };
  }

  private mapDocumentFromGraphQL(document: any): IAutentiqueDocument {
    const signatures =
      document.signatures?.map((signature) => ({
        name: signature.name,
        email: signature.email,
        status: this.mapStatus(signature.status),
        signedAt: signature.signedAt ? new Date(signature.signedAt) : null,
        signingUrl: signature.signingUrl || null,
      })) || [];

    return {
      id: document.id,
      name: document.name,
      status: this.mapStatus(document.status),
      signed_count: signatures.filter((sig) => sig.signedAt)?.length || 0,
      signedAt: null,
      expiresAt: document.expiresAt ? new Date(document.expiresAt) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      signatures,
    };
  }

  async syncContracts() {
    try {
      this.logger.log('Iniciando sincronização dos contratos com a Autentique...');

      const sellers = await this.prisma.sellers.findMany({
        include: {
          contracts: true,
        },
      });

      this.logger.log(`Encontrados ${sellers.length} sellers para sincronizar`);

      let processedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;

      for (const seller of sellers) {
        try {
          this.logger.debug(`Processando seller ${seller.cnpj}...`);

          const document = await this.findDocumentBySellerCnpj(seller.cnpj);

          if (!document) {
            this.logger.debug(`Nenhum documento encontrado para o seller ${seller.cnpj}`);
            continue;
          }

          const contract = seller.contracts[0];
          if (contract) {
            const newStatus = this.mapAutentiqueStatus(document.status);
            const statusChanged = contract.status !== newStatus;

            await this.prisma.contracts.update({
              where: { id: contract.id },
              data: {
                external_id: document.id,
                status: newStatus,
                signed_at: document.signedAt,
                updated_at: document.updatedAt,
                signing_url: document.signatures[0]?.signingUrl || null,
              },
            });

            if (statusChanged) {
              await this.prisma.status_history.create({
                data: {
                  contract_id: contract.id,
                  from_status: contract.status,
                  to_status: newStatus,
                  reason: this.getStatusChangeReason(newStatus),
                  metadata: {
                    document_id: document.id,
                    signed_at: document.signedAt,
                    updated_at: document.updatedAt,
                  },
                },
              });
            }

            updatedCount++;
          }

          processedCount++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          errorCount++;
          this.logger.error(`Erro ao processar seller ${seller.cnpj}: ${error.message}`);
        }
      }

      return {
        success: true,
        message: 'Sincronização concluída',
        stats: {
          total: sellers.length,
          processed: processedCount,
          updated: updatedCount,
          errors: errorCount,
        },
      };
    } catch (error) {
      this.logger.error('Erro na sincronização:', error);
      throw error;
    }
  }

  private mapAutentiqueStatus(status: AutentiqueDocumentStatus): contract_status {
    switch (status) {
      case AutentiqueDocumentStatus.SIGNED:
        return contract_status.SIGNED;
      case AutentiqueDocumentStatus.EXPIRED:
        return contract_status.EXPIRED;
      case AutentiqueDocumentStatus.CANCELLED:
        return contract_status.CANCELLED;
      default:
        return contract_status.PENDING_SIGNATURE;
    }
  }

  private getStatusChangeReason(status: contract_status): status_change_reason {
    switch (status) {
      case contract_status.SIGNED:
        return status_change_reason.SIGNED;
      case contract_status.EXPIRED:
        return status_change_reason.EXPIRED;
      case contract_status.CANCELLED:
        return status_change_reason.CANCELLED;
      case contract_status.PENDING_SIGNATURE:
        return status_change_reason.SENT_TO_SIGNATURE;
      default:
        return status_change_reason.CREATED;
    }
  }
}
