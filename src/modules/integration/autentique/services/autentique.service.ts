import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import axios, { AxiosInstance } from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
    IAutentiqueDocument,
    IAutentiqueService,
    AutentiqueDocumentStatus,
} from '../interfaces/autentique.interface';
import { EContractStatus } from '../../../contract-management/contract/enums/contract-status.enum';

@Injectable()
export class AutentiqueService implements IAutentiqueService {
    private readonly logger = new Logger(AutentiqueService.name);
    private readonly baseUrl: string;
    private readonly apiKey: string;
    private readonly rateLimiter: RateLimiterMemory;
    private readonly httpClient: AxiosInstance;
    private readonly documentNamePattern = 'Contrato PMA True Brands - {cnpj}';
    private readonly prisma: PrismaClient;

    constructor(private readonly configService: ConfigService) {
        this.prisma = new PrismaClient();
        this.logger.debug('Inicializando AutentiqueService...');

        // Configurando o rate limiter
        this.rateLimiter = new RateLimiterMemory({
            points: 10,
            duration: 1,
        });

        this.baseUrl = this.configService.get<string>('AUTENTIQUE_API_URL');
        this.apiKey = this.configService.get<string>('AUTENTIQUE_API_KEY');

        if (!this.baseUrl || !this.apiKey) {
            throw new Error('Configurações da Autentique não encontradas');
        }

        this.logger.debug(
            `Inicializando AutentiqueService com API Key: ${this.apiKey.substring(0, 8)}...`,
        );

        // Configurando o cliente HTTP
        this.httpClient = axios.create({
            baseURL: this.baseUrl,
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
        });
    }

    private mapDocumentResponse(response: any): IAutentiqueDocument {
        try {
            const signatures = response.signatures.map((sig: any) => ({
                public_id: sig.public_id,
                name: sig.name,
                email: sig.email,
                created_at: new Date(sig.created_at),
                action: sig.action,
                link: sig.link,
                user: sig.user,
                signed: sig.signed,
                rejected: sig.rejected,
            }));

            return {
                id: response.id,
                name: response.name,
                status: response.status || AutentiqueDocumentStatus.PENDING,
                signatures,
                signed_count: signatures.filter((sig) => sig.signed).length,
                created_at: new Date(response.created_at),
                updatedAt: new Date(response.updated_at),
                signedAt: signatures.find((sig) => sig.signed)?.signed_at
                    ? new Date(signatures.find((sig) => sig.signed).signed_at)
                    : undefined,
                expiresAt: response.expiration_at ? new Date(response.expiration_at) : undefined,
                refusable: response.refusable || false,
                sortable: response.sortable || false,
                files: {
                    original: response.files?.original || '',
                    signed: response.files?.signed || '',
                    pades: response.files?.pades || '',
                },
            };
        } catch (error) {
            console.error('❌ Erro ao mapear documento:', error);
            throw error;
        }
    }

    async createDocument(
        documentName: string,
        content: string,
        signers: Array<{ name: string; email: string }>,
        options?: { short_link?: boolean },
    ): Promise<IAutentiqueDocument> {
        try {
            this.logger.log(`Iniciando criação de documento: ${documentName}`);
            this.logger.log(`Número de signatários: ${signers.length}`);

            // Cria um arquivo temporário com o conteúdo
            const sanitizedName = documentName.replace(/[^a-zA-Z0-9]/g, '_');
            const tempFilePath = path.join(os.tmpdir(), `${sanitizedName}.docx`);

            // Substitui as variáveis do template
            let processedContent = content;
            const seller = signers[0];
            processedContent = processedContent
                .replace(/{{RAZAO_SOCIAL}}/g, seller.name)
                .replace(/{{EMAIL}}/g, seller.email);

            // Garante que o conteúdo está em base64
            if (!/^[A-Za-z0-9+/=]+$/.test(processedContent)) {
                processedContent = Buffer.from(processedContent).toString('base64');
            }

            const buffer = Buffer.from(processedContent, 'base64');
            await fs.promises.writeFile(tempFilePath, buffer);

            // Prepara o arquivo para upload
            const file = await fs.createReadStream(tempFilePath);

            // Prepara as operações GraphQL
            const operation = {
                query: `
                    mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
                        createDocument(document: $document, signers: $signers, file: $file) {
                            id
                            name
                            refusable
                            sortable
                            created_at
                            signatures {
                                public_id
                                name
                                email
                                created_at
                                action { name }
                                link { short_link }
                                user { id name email }
                                signed { created_at }
                                rejected { created_at }
                            }
                            files { original signed pades }
                        }
                    }
                `,
                variables: {
                    document: {
                        name: documentName,
                        message: 'Por favor, assine o documento.',
                        reminder: 'DAILY',
                        configs: {
                            notification_finished: true,
                            notification_signed: true,
                            signature_appearance: 'ELETRONIC',
                        },
                    },
                    signers: signers.map((signer) => ({
                        email: signer.email,
                        name: signer.name,
                        action: 'SIGN',
                    })),
                    file: null,
                },
            };

            // Log para debug
            this.logger.debug('Operation:', JSON.stringify(operation, null, 2));

            // Cria o FormData
            const formData = new FormData();
            formData.append('operations', JSON.stringify(operation));
            formData.append('map', JSON.stringify({ file: ['variables.file'] }));
            formData.append('file', file, {
                filename: `${sanitizedName}.docx`,
                contentType:
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });

            this.logger.log('Enviando requisição para Autentique...');

            // Faz a requisição
            const response = await axios.post(
                `${this.configService.get<string>('AUTENTIQUE_API_URL')}/graphql`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        Authorization: `Bearer ${this.configService.get<string>('AUTENTIQUE_API_KEY')}`,
                    },
                },
            );

            this.logger.log('Resposta recebida da Autentique');
            this.logger.debug('Response:', response.data);

            if (response.data.errors) {
                this.logger.error('Erros da Autentique:', response.data.errors);
                throw new Error(response.data.errors[0].message);
            }

            if (!response.data.data?.createDocument) {
                this.logger.error('Resposta inválida da Autentique:', response.data);
                throw new Error('Resposta inválida da Autentique');
            }

            // Limpa o arquivo temporário
            await fs.promises.unlink(tempFilePath);

            // Gera links de assinatura para todos os signatários se a opção short_link estiver ativa
            const document = response.data.data.createDocument;

            if (options?.short_link) {
                this.logger.log(
                    '[createDocument] Opção short_link ativada, tentando gerar links para signatários',
                );

                // Implementação resiliente com retry
                const MAX_RETRIES = 2; // Total de 3 tentativas (1 original + 2 retries)

                for (const signature of document.signatures) {
                    if (signature.action?.name === 'SIGN') {
                        let linkObtained = false;
                        let lastError = null;

                        // Já tem link na resposta inicial?
                        if (signature.link?.short_link) {
                            this.logger.log(
                                `[createDocument] Signatário ${signature.email} já tem link na resposta inicial: ${signature.link.short_link}`,
                            );
                            linkObtained = true;
                            continue;
                        }

                        // Tentativa com retry
                        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                            try {
                                if (attempt > 0) {
                                    this.logger.log(
                                        `[createDocument] Retry #${attempt} para obter link para ${signature.email}`,
                                    );
                                    // Pequena pausa entre retries
                                    await new Promise((resolve) =>
                                        setTimeout(resolve, 500 * attempt),
                                    );
                                }

                                const shortLink = await this.createSignatureLink(
                                    signature.public_id,
                                );
                                if (!shortLink) {
                                    throw new Error('Link retornado está vazio');
                                }

                                this.logger.log(
                                    `[createDocument] Link obtido com sucesso (tentativa ${attempt + 1}): ${shortLink}`,
                                );
                                signature.link = { short_link: shortLink };
                                linkObtained = true;
                                break; // Sai do loop de retry
                            } catch (error) {
                                lastError = error;
                                this.logger.error(
                                    `[createDocument] Falha na tentativa ${attempt + 1} de obter link: ${error.message}`,
                                );
                                // Continua para próxima tentativa se não for a última
                            }
                        }

                        // Se após todas as tentativas não conseguimos o link
                        if (!linkObtained) {
                            // NÃO lançamos erro, apenas logamos e continuamos
                            this.logger.error(
                                `[createDocument] Não foi possível obter link após ${MAX_RETRIES + 1} tentativas para ${signature.email}. Último erro: ${lastError?.message}`,
                            );
                            // Criamos um objeto link vazio para evitar null/undefined
                            signature.link = { short_link: null };
                        }
                    }
                }
            }

            return this.mapDocumentResponse(document);
        } catch (error) {
            this.logger.error('Erro ao criar documento na Autentique:', error);
            throw error;
        }
    }

    async createSignatureLink(publicId: string): Promise<string> {
        this.logger.debug(`[createSignatureLink] Iniciando para public_id: ${publicId}`);
        try {
            // Log antes da chamada
            this.logger.debug(
                `[createSignatureLink] Enviando requisição GraphQL para Autentique para public_id: ${publicId}`,
            );
            const response = await this.httpClient.post('/graphql', {
                query: `
                    mutation {
                        createLinkToSignature(
                            public_id: "${publicId}"
                        ) {
                            short_link
                        }
                    }
                `,
            });

            // Log detalhado da resposta, ANTES de verificar erros
            this.logger.debug(
                `[createSignatureLink] Resposta da API recebida para public_id ${publicId}: ${JSON.stringify(response.data, null, 2)}`,
            );

            if (response.data.errors) {
                this.logger.error(
                    `[createSignatureLink] Erros GraphQL da Autentique para public_id ${publicId}: ${JSON.stringify(response.data.errors)}`,
                );
                // Lança o primeiro erro GraphQL para ser pego pelo catch abaixo
                throw new Error(
                    response.data.errors[0].message || 'Erro GraphQL ao criar link de assinatura',
                );
            }

            if (!response.data.data?.createLinkToSignature?.short_link) {
                this.logger.error(
                    `[createSignatureLink] Resposta inválida ou sem short_link da Autentique para public_id ${publicId}: ${JSON.stringify(response.data)}`,
                );
                throw new Error('Resposta inválida ou sem short_link ao criar link de assinatura');
            }

            const shortLink = response.data.data.createLinkToSignature.short_link;
            this.logger.log(
                `[createSignatureLink] Link de assinatura criado com sucesso para public_id ${publicId}: ${shortLink}`,
            );
            return shortLink;
        } catch (error) {
            this.logger.error(
                `[createSignatureLink] Erro CATASTRÓFICO ao criar link para public_id ${publicId}: ${error.message}`,
                error.stack,
            );
            // Logar detalhes específicos do Axios se for um erro Axios
            if (error.isAxiosError) {
                this.logger.error(
                    `[createSignatureLink] Detalhes do erro Axios: Status=${error.response?.status}, Data=${JSON.stringify(error.response?.data)}`,
                );
            }
            // Propaga o erro para que o chamador (createDocument) saiba que falhou
            throw error;
        }
    }

    async findDocumentBySellerCnpj(cnpj: string): Promise<IAutentiqueDocument[]> {
        try {
            // Formata o CNPJ para o padrão XX.XXX.XXX/XXXX-XX
            const formattedCnpj = cnpj.replace(
                /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
                '$1.$2.$3/$4-$5',
            );

            // Constrói o nome do documento no padrão
            const documentName = `Contrato PMA True Brands - ${formattedCnpj}`;

            this.logger.debug(`Buscando documento com nome: ${documentName}`);

            const response = await this.httpClient.post('/graphql', {
                query: `
                    query {
                        documents(limit: 60, page: 1) {
                            total
                            data {
                                id
                                name
                                created_at
                                updated_at
                                expiration_at
                                refusable
                                sortable
                                signatures {
                                    public_id
                                    name
                                    email
                                    created_at
                                    action { name }
                                    link { short_link }
                                    user { id name email }
                                    signed { created_at }
                                    rejected { created_at }
                                }
                                files { original signed }
                            }
                        }
                    }
                `,
            });

            if (response.data.errors) {
                this.logger.error('Erro na resposta da Autentique:', response.data.errors);
                throw new Error(response.data.errors[0].message);
            }

            if (!response.data.data?.documents?.data) {
                this.logger.error('Resposta inválida da Autentique:', response.data);
                throw new Error('Resposta inválida da Autentique');
            }

            // Filtra os documentos que correspondem exatamente ao nome
            const documents = response.data.data.documents.data.filter(
                (doc: any) => doc && doc.name === documentName,
            );

            if (!documents.length) {
                this.logger.debug(`Nenhum documento encontrado com o nome: ${documentName}`);
                return [];
            }

            this.logger.debug(
                `Encontrados ${documents.length} documentos com o nome: ${documentName}`,
            );

            return documents
                .map((doc: any) => {
                    try {
                        return this.mapDocumentResponse(doc);
                    } catch (error) {
                        this.logger.error(`Erro ao mapear documento ${doc.id}:`, error);
                        return null;
                    }
                })
                .filter((doc): doc is IAutentiqueDocument => doc !== null);
        } catch (error) {
            this.logger.error('Erro ao buscar documentos por CNPJ:', error);
            throw error;
        }
    }

    async deleteDocument(id: string): Promise<boolean> {
        try {
            const response = await this.httpClient.post('/graphql', {
                query: `
                    mutation DeleteDocument($id: ID!) {
                        deleteDocument(id: $id)
                    }
                `,
                variables: {
                    id,
                },
            });

            if (response.data.errors) {
                throw new Error(response.data.errors[0].message);
            }

            return response.data.data.deleteDocument;
        } catch (error) {
            this.logger.error('Erro ao deletar documento:', error);
            throw error;
        }
    }

    mapStatus(document: IAutentiqueDocument): EContractStatus {
        switch (document.status) {
            case AutentiqueDocumentStatus.DRAFT:
                return EContractStatus.DRAFT;
            case AutentiqueDocumentStatus.PENDING:
                return EContractStatus.PENDING_SIGNATURE;
            case AutentiqueDocumentStatus.SIGNED:
                return EContractStatus.SIGNED;
            case AutentiqueDocumentStatus.EXPIRED:
                return EContractStatus.EXPIRED;
            case AutentiqueDocumentStatus.CANCELLED:
                return EContractStatus.CANCELLED;
            default:
                return EContractStatus.DRAFT;
        }
    }

    async getDocument(documentId: string): Promise<IAutentiqueDocument> {
        try {
            this.logger.debug(`Buscando documento por ID: ${documentId}`);

            const response = await this.httpClient.post('/graphql', {
                query: `
                    query {
                        document(id: "${documentId}") {
                            id
                            name
                            refusable
                            sortable
                            created_at
                            files { original signed pades }
                            signatures {
                                public_id
                                name
                                email
                                created_at
                                action { name }
                                link { short_link }
                                user { id name email phone }
                                user_data { name email phone }
                                email_events {
                                    sent
                                    opened
                                    delivered
                                    refused
                                    reason
                                }
                                viewed { created_at }
                                signed { created_at }
                                rejected { created_at }
                                signed_unapproved { created_at }
                                biometric_approved { created_at }
                                biometric_rejected { created_at }
                            }
                        }
                    }
                `,
            });

            if (response.data.errors) {
                this.logger.error('Erro na resposta da Autentique:', response.data.errors);
                throw new Error(response.data.errors[0].message);
            }

            if (!response.data.data?.document) {
                this.logger.error('Documento não encontrado:', documentId);
                throw new Error('Documento não encontrado na Autentique');
            }

            this.logger.debug(`Documento encontrado: ${response.data.data.document.name}`);

            return this.mapDocumentResponse(response.data.data.document);
        } catch (error) {
            this.logger.error('Erro ao buscar documento:', error);
            throw error;
        }
    }

    async syncContracts(): Promise<void> {
        try {
            const contracts = await this.prisma.contracts.findMany({
                where: {
                    external_id: {
                        not: null,
                    },
                },
            });

            for (const contract of contracts) {
                try {
                    const document = await this.getDocument(contract.external_id);
                    await this.prisma.contracts.update({
                        where: { id: contract.id },
                        data: {
                            status: this.mapAutentiqueStatus(document.status),
                            signing_url: document.signatures[0]?.link.short_link,
                            signed_at: document.signedAt,
                            expires_at: document.expiresAt,
                        },
                    });
                } catch (error) {
                    this.logger.error(`Erro ao sincronizar contrato ${contract.id}:`, error);
                }
            }
        } catch (error) {
            this.logger.error('Erro ao sincronizar contratos:', error);
            throw error;
        }
    }

    private mapAutentiqueStatus(status: AutentiqueDocumentStatus): EContractStatus {
        switch (status) {
            case AutentiqueDocumentStatus.SIGNED:
                return EContractStatus.SIGNED;
            case AutentiqueDocumentStatus.EXPIRED:
                return EContractStatus.EXPIRED;
            case AutentiqueDocumentStatus.CANCELLED:
                return EContractStatus.CANCELLED;
            default:
                return EContractStatus.PENDING_SIGNATURE;
        }
    }
}
