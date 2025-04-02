import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { JWT } from 'google-auth-library';

@Injectable()
export class GoogleDocsService {
    private readonly logger = new Logger(GoogleDocsService.name);
    private readonly auth: JWT;
    private readonly docs: any;
    private readonly drive: any;

    // IDs das pastas no Google Drive
    private readonly CONTRATOS_CRIADOS_FOLDER_ID = '1VTqPoBZelVI2wqzlavNfhVeqKHlnwVrs';
    private readonly CONTRATOS_MOCK_FOLDER_ID = '1NmnwKHW7KOIyBRy0l5F4G4LOSzeMvwDf';

    constructor(private readonly configService: ConfigService) {
        const clientEmail = this.configService.get<string>('GOOGLE_CLIENT_EMAIL');
        const privateKey = this.configService
            .get<string>('GOOGLE_PRIVATE_KEY')
            ?.replace(/\\n/g, '\n');
        const projectId = this.configService.get<string>('GOOGLE_PROJECT_ID');

        if (!clientEmail || !privateKey || !projectId) {
            throw new Error('Credenciais do Google não configuradas corretamente');
        }

        this.auth = new JWT({
            email: clientEmail,
            key: privateKey,
            scopes: [
                'https://www.googleapis.com/auth/documents',
                'https://www.googleapis.com/auth/drive',
            ],
        });

        this.docs = google.docs({ version: 'v1', auth: this.auth });
        this.drive = google.drive({ version: 'v3', auth: this.auth });
    }

    async createFilledTemplate(documentId: string, mockData: any): Promise<string> {
        try {
            this.logger.log('Criando cópia do template com dados mockados:', {
                documentId,
                mockData: {
                    ...mockData,
                    seller: {
                        ...mockData.seller,
                        name: mockData.seller.name.trim(),
                        cnpj: mockData.seller.cnpj.replace(/[^\d]/g, ''),
                        address: mockData.seller.address.trim(),
                    },
                    date: mockData.date.trim(),
                },
            });

            // 1. Criar uma cópia do documento
            const copyResponse = await this.drive.files.copy({
                fileId: documentId,
                requestBody: {
                    name: `Contrato_Preview_${new Date().getTime()}`,
                    parents: [this.CONTRATOS_MOCK_FOLDER_ID],
                },
            });

            const copyId = copyResponse.data.id;
            this.logger.log(`Cópia criada com ID: ${copyId}`);

            // 2. Configurar permissão pública para o documento
            await this.drive.permissions.create({
                fileId: copyId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone',
                },
            });

            this.logger.log('Permissão pública configurada com sucesso');

            // 3. Substituir as variáveis pelos dados mockados
            const requests = [
                {
                    replaceAllText: {
                        containsText: { text: '{{RAZAO_SOCIAL}}' },
                        replaceText: mockData.seller.name.trim(),
                    },
                },
                {
                    replaceAllText: {
                        containsText: { text: '{{CNPJ}}' },
                        replaceText: mockData.seller.cnpj,
                    },
                },
                {
                    replaceAllText: {
                        containsText: { text: '{{ENDERECO_COMPLETO}}' },
                        replaceText: mockData.seller.address.trim(),
                    },
                },
                {
                    replaceAllText: {
                        containsText: { text: '{{DATA}}' },
                        replaceText: mockData.date.trim(),
                    },
                },
                // Variações alternativas das variáveis
                {
                    replaceAllText: {
                        containsText: { text: '{{nome.seller}}' },
                        replaceText: mockData.seller.name.trim(),
                    },
                },
                {
                    replaceAllText: {
                        containsText: { text: '{{endereco}}' },
                        replaceText: mockData.seller.address.trim(),
                    },
                },
                {
                    replaceAllText: {
                        containsText: { text: '{{endereco completo}}' },
                        replaceText: mockData.seller.address.trim(),
                    },
                },
                {
                    replaceAllText: {
                        containsText: { text: '{{data}}' },
                        replaceText: mockData.date.trim(),
                    },
                },
            ];

            await this.docs.documents.batchUpdate({
                documentId: copyId,
                requestBody: {
                    requests,
                },
            });

            this.logger.log('Dados mockados substituídos com sucesso');

            // 4. Retornar o ID do documento preenchido
            return copyId;
        } catch (error) {
            this.logger.error('Erro ao criar template preenchido:', {
                error: error instanceof Error ? error.message : 'Erro desconhecido',
                stack: error instanceof Error ? error.stack : undefined,
                documentId,
                mockData,
            });
            throw error;
        }
    }

    async createContractForSeller(
        documentId: string,
        sellerData: { cnpj: string; razaoSocial: string },
        contractData: any,
    ): Promise<string> {
        try {
            this.logger.log('Criando contrato para seller');

            // 1. Criar uma cópia do documento
            const copyResponse = await this.drive.files.copy({
                fileId: documentId,
                requestBody: {
                    name: `Contrato_${sellerData.cnpj}_${sellerData.razaoSocial}`,
                    parents: [this.CONTRATOS_CRIADOS_FOLDER_ID], // Salva na pasta de contratos criados
                },
            });

            const copyId = copyResponse.data.id;
            this.logger.log(`Cópia criada com ID: ${copyId}`);

            // 2. Configurar permissão pública para o documento
            await this.drive.permissions.create({
                fileId: copyId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone',
                },
            });

            this.logger.log('Permissão pública configurada com sucesso');

            // 3. Substituir as variáveis pelos dados do seller
            const requests = [
                {
                    replaceAllText: {
                        containsText: { text: '{{nome.seller}}' },
                        replaceText: sellerData.razaoSocial,
                    },
                },
                {
                    replaceAllText: {
                        containsText: { text: '{{CNPJ}}' },
                        replaceText: sellerData.cnpj,
                    },
                },
                {
                    replaceAllText: {
                        containsText: { text: '{{endereco}}' },
                        replaceText: contractData.address,
                    },
                },
                {
                    replaceAllText: {
                        containsText: { text: '{{endereco completo}}' },
                        replaceText: contractData.address,
                    },
                },
                {
                    replaceAllText: {
                        containsText: { text: '{{data}}' },
                        replaceText: new Date().toLocaleDateString('pt-BR', {
                            timeZone: 'America/Sao_Paulo',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        }),
                    },
                },
            ];

            await this.docs.documents.batchUpdate({
                documentId: copyId,
                requestBody: {
                    requests,
                },
            });

            this.logger.log('Dados do seller substituídos com sucesso');

            // 4. Retornar o ID do documento preenchido
            return copyId;
        } catch (error) {
            this.logger.error('Erro ao criar contrato para seller:', error);
            throw error;
        }
    }

    async getDocument(documentId: string): Promise<Buffer> {
        try {
            // Exporta o documento como DOCX
            const response = await this.drive.files.export(
                {
                    fileId: documentId,
                    mimeType:
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                },
                {
                    responseType: 'arraybuffer',
                },
            );

            return Buffer.from(response.data);
        } catch (error) {
            this.logger.error('Erro ao obter documento:', error);
            throw error;
        }
    }
}
