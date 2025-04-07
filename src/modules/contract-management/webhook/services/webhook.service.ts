import { Injectable, Logger } from '@nestjs/common';
import { ContractService } from '../../contract/services/contract.service';
import { ContractTemplateService } from '../../template/services/contract-template.service';
import { EContractStatus } from '../../contract/enums/contract-status.enum';
import { NotificationService } from '../../notification/services/notification.service';
import { WebhookDto } from '../dtos/webhook.dto';
import { GoogleDocsService } from '../../template/services/google-docs.service';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CnpjIntegrationService } from '../../../integration/cnpj/services/cnpj-integration.service';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cnpjIntegrationService: CnpjIntegrationService,
        private readonly contractService: ContractService,
        private readonly contractTemplateService: ContractTemplateService,
        private readonly googleDocsService: GoogleDocsService,
        private readonly notificationService: NotificationService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async processContractWebhook(data: WebhookDto) {
        try {
            this.logger.log('📥 Iniciando processamento do webhook:', {
                cnpj: data.cnpj,
                email: data.email,
                telefone: data.telefone,
            });

            // 1. Validar dados obrigatórios
            if (!data.cnpj || !data.email || !data.telefone) {
                throw new Error('Dados obrigatórios não fornecidos');
            }

            // 2. Busca dados usando nosso serviço de integração (CNPJWS com fallback para Brasil API)
            this.logger.log('📊 Buscando dados de CNPJ via serviço de integração:', data.cnpj);
            const sellerData = await this.cnpjIntegrationService.getSellerData(data.cnpj);
            this.logger.log('✅ Dados recebidos via serviço de integração:', {
                razaoSocial: sellerData.razaoSocial,
                endereco: sellerData.endereco,
            });

            // 3. Verifica se o vendedor já existe
            const existingSeller = await this.prisma.sellers.findUnique({
                where: { cnpj: data.cnpj },
                include: {
                    contracts: {
                        where: {
                            status: EContractStatus.SIGNED,
                        },
                    },
                },
            });

            let sellerId: string;

            if (existingSeller) {
                this.logger.log('📄 Vendedor encontrado:', {
                    id: existingSeller.id,
                    cnpj: existingSeller.cnpj,
                    hasSignedContract: existingSeller.contracts.length > 0,
                });

                // Se tem contrato assinado, apenas atualiza email e telefone
                if (existingSeller.contracts.length > 0) {
                    this.logger.log(
                        '✅ Vendedor já possui contrato assinado, atualizando dados...',
                    );
                    await this.prisma.sellers.update({
                        where: { id: existingSeller.id },
                        data: {
                            email: data.email,
                            telefone: data.telefone,
                        },
                    });
                    return {
                        success: true,
                        message: 'Vendedor já possui contrato assinado',
                    };
                }

                // Se não tem contrato assinado, verifica se tem contrato pendente recente
                this.logger.log('📄 Verificando existência de contratos pendentes recentes...');

                // Procura por um contrato PENDING_SIGNATURE criado nos últimos 10 minutos
                const recentContract = await this.prisma.contracts.findFirst({
                    where: {
                        seller_id: existingSeller.id,
                        status: EContractStatus.PENDING_SIGNATURE,
                        signing_url: { not: null }, // Tem que ter URL de assinatura
                        created_at: {
                            gte: new Date(Date.now() - 10 * 60 * 1000), // 10 minutos
                        },
                    },
                    orderBy: {
                        created_at: 'desc',
                    },
                });

                if (recentContract?.signing_url) {
                    this.logger.log(
                        '✅ Contrato PENDING_SIGNATURE recente encontrado, reutilizando:',
                        {
                            id: recentContract.id,
                            signingUrl: recentContract.signing_url,
                            createdAt: recentContract.created_at,
                        },
                    );

                    // Apenas atualiza dados do vendedor e retorna
                    await this.prisma.sellers.update({
                        where: { id: existingSeller.id },
                        data: {
                            email: data.email,
                            telefone: data.telefone,
                        },
                    });

                    return {
                        success: true,
                        message: 'Contrato pendente de assinatura já existe',
                        data: {
                            contractId: recentContract.id,
                            sellerId: existingSeller.id,
                            signingUrl: recentContract.signing_url,
                        },
                    };
                }

                // Se não tem contrato recente válido, atualiza dados e remove contratos pendentes
                this.logger.log(
                    '📄 Nenhum contrato recente válido. Atualizando dados do vendedor e removendo contratos pendentes...',
                );

                // Busca os contratos pendentes do vendedor
                const pendingContracts = await this.prisma.contracts.findMany({
                    where: {
                        seller_id: existingSeller.id,
                        status: { not: EContractStatus.SIGNED },
                    },
                    include: {
                        notifications: true,
                        status_history: true,
                    },
                });

                this.logger.log('📄 Contratos pendentes encontrados:', {
                    count: pendingContracts.length,
                    contracts: pendingContracts.map((c) => ({
                        id: c.id,
                        status: c.status,
                        notifications: c.notifications.length,
                        history: c.status_history.length,
                    })),
                });

                // Para cada contrato pendente, remove primeiro as notificações e histórico
                for (const contract of pendingContracts) {
                    // Remove notificações do contrato
                    await this.prisma.notifications.deleteMany({
                        where: { contract_id: contract.id },
                    });

                    // Remove histórico de status do contrato
                    await this.prisma.status_history.deleteMany({
                        where: { contract_id: contract.id },
                    });

                    // Remove o contrato
                    await this.prisma.contracts.delete({
                        where: { id: contract.id },
                    });
                }

                // Atualiza dados do vendedor
                const updatedSeller = await this.prisma.sellers.update({
                    where: { id: existingSeller.id },
                    data: {
                        email: data.email,
                        telefone: data.telefone,
                    },
                });
                sellerId = updatedSeller.id;
            } else {
                // Se não existe, cria novo
                this.logger.log('📄 Criando novo vendedor...');
                const newSeller = await this.prisma.sellers.create({
                    data: {
                        cnpj: data.cnpj.replace(/\D/g, '').slice(0, 14),
                        razao_social: sellerData.razaoSocial.slice(0, 255),
                        email: data.email.slice(0, 255),
                        telefone: data.telefone.replace(/\D/g, '').slice(0, 20),
                        endereco: `${sellerData.endereco.logradouro}, ${sellerData.endereco.numero} - ${sellerData.endereco.bairro}, ${sellerData.endereco.municipio}/${sellerData.endereco.uf} - CEP: ${sellerData.endereco.cep}`,
                    },
                });
                sellerId = newSeller.id;
                this.logger.log('✅ Vendedor criado:', { id: sellerId });
            }

            // 4. Obtém o template ativo
            this.logger.log('📄 Obtendo template ativo...');
            const template = await this.contractTemplateService.getActiveTemplate();
            if (!template) {
                throw new Error('Nenhum template ativo encontrado');
            }
            this.logger.log('✅ Template obtido:', { id: template.id });

            // 5. Cria uma cópia do template com dados do seller
            const documentId = process.env.GOOGLE_DOC_ID;
            if (!documentId) {
                throw new Error('ID do documento do Google Docs não configurado');
            }

            const formattedCnpj = this.formatCnpj(data.cnpj);
            const currentDate = new Date();
            const formattedDate = this.formatDate(currentDate);
            const filledDocId = await this.googleDocsService.createFilledTemplate(documentId, {
                seller: {
                    name: sellerData.razaoSocial,
                    cnpj: formattedCnpj,
                    address: `${sellerData.endereco.logradouro}, ${sellerData.endereco.numero} - ${sellerData.endereco.bairro}, ${sellerData.endereco.municipio}/${sellerData.endereco.uf} - CEP: ${sellerData.endereco.cep}`,
                },
                date: formattedDate,
            });
            this.logger.log('✅ Template preenchido:', { docId: filledDocId });

            // 6. Obtém o conteúdo do documento
            const content = await this.googleDocsService.getDocument(filledDocId);
            this.logger.log('✅ Conteúdo do documento obtido');

            // 7. Cria o contrato
            this.logger.log('📄 Criando contrato...');
            const contract = await this.contractService.create(
                {
                    sellerId,
                    templateId: template.id,
                    content: content.toString('base64'),
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                },
                {
                    contractNumber: await this.generateContractNumber(),
                    companyName: sellerData.razaoSocial,
                    companyCnpj: data.cnpj,
                    companyAddress: `${sellerData.endereco.logradouro}, ${sellerData.endereco.numero} - ${sellerData.endereco.bairro}, ${sellerData.endereco.municipio}/${sellerData.endereco.uf} - CEP: ${sellerData.endereco.cep}`,
                    contractDuration: 12,
                    commissionRate: 10,
                    paymentDay: 10,
                    jurisdiction: 'São Paulo/SP',
                    city: sellerData.endereco.municipio,
                    seller: {
                        id: sellerId,
                        cnpj: data.cnpj,
                        razao_social: sellerData.razaoSocial,
                        email: data.email,
                        telefone: data.telefone,
                        endereco: `${sellerData.endereco.logradouro}, ${sellerData.endereco.numero} - ${sellerData.endereco.bairro}, ${sellerData.endereco.municipio}/${sellerData.endereco.uf} - CEP: ${sellerData.endereco.cep}`,
                    },
                },
            );
            this.logger.log('✅ Contrato criado:', { id: contract.id });

            // 8. Envia para assinatura
            this.logger.log('📄 Enviando contrato para assinatura...');
            const signedContract = await this.contractService.sendToSignature(contract.id);

            // Verifica se conseguimos a URL de assinatura
            if (!signedContract.signingUrl) {
                this.logger.warn(
                    '⚠️ URL de assinatura ausente no objeto retornado, tentando buscar diretamente do banco...',
                );

                // Busca o contrato diretamente do banco para obter a URL
                const contractFromDB = await this.prisma.contracts.findUnique({
                    where: { id: signedContract.id },
                    select: { signing_url: true, external_id: true },
                });

                if (contractFromDB?.signing_url) {
                    this.logger.log(
                        '✅ URL de assinatura recuperada diretamente do banco de dados:',
                        contractFromDB.signing_url,
                    );

                    // Usa a URL encontrada no banco
                    return {
                        success: true,
                        message:
                            'Contrato criado e enviado para assinatura com sucesso (URL recuperada do banco)',
                        data: {
                            contractId: signedContract.id,
                            sellerId: signedContract.sellerId,
                            signingUrl: contractFromDB.signing_url,
                            externalId: contractFromDB.external_id,
                        },
                    };
                }

                // Se ainda não encontrou a URL, emite alerta mas continua o fluxo
                this.logger.warn(
                    '⚠️ Contrato criado, mas URL de assinatura não foi encontrada nem no banco. ' +
                        'Uma tentativa automática de recuperação será feita posteriormente.',
                    { contractId: contract.id },
                );

                // Emite um evento que poderia ser capturado por um sistema de recuperação assíncrona
                try {
                    this.eventEmitter.emit('contract.signing_url_missing', {
                        contractId: contract.id,
                        sellerId: signedContract.sellerId,
                        externalId: signedContract.externalId,
                        timestamp: new Date(),
                    });
                } catch (eventError) {
                    this.logger.error('❌ Erro ao emitir evento de URL ausente:', eventError);
                }

                // Retornamos sucesso parcial, informando que o contrato foi criado, mas sem URL
                return {
                    success: true,
                    warning:
                        'Contrato criado sem URL de assinatura, uma recuperação será tentada automaticamente',
                    data: {
                        contractId: signedContract.id,
                        sellerId: signedContract.sellerId,
                        signingUrl: null,
                        urlPending: true,
                    },
                };
            }

            // Caso normal (com URL)
            this.logger.log('✅ Contrato enviado para assinatura:', {
                id: signedContract.id,
                signingUrl: signedContract.signingUrl,
            });

            return {
                success: true,
                message: 'Contrato criado e enviado para assinatura com sucesso',
                data: {
                    contractId: signedContract.id,
                    sellerId: signedContract.sellerId,
                    signingUrl: signedContract.signingUrl,
                },
            };
        } catch (error) {
            this.logger.error('❌ Erro ao processar webhook:', {
                error: error.message,
                stack: error.stack,
                data,
            });
            throw error;
        }
    }

    private formatCnpj(cnpj: string): string {
        const cleanCnpj = cnpj.replace(/\D/g, '');
        return cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }

    private formatDate(date: Date): string {
        const months = [
            'janeiro',
            'fevereiro',
            'março',
            'abril',
            'maio',
            'junho',
            'julho',
            'agosto',
            'setembro',
            'outubro',
            'novembro',
            'dezembro',
        ];

        const day = date.getDate().toString().padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        return `${day} de ${month} de ${year}`;
    }

    private async generateContractNumber(): Promise<string> {
        // Busca o último contrato criado
        const lastContract = await this.prisma.contracts.findFirst({
            orderBy: {
                created_at: 'desc',
            },
        });

        // Se não houver contratos, começa do 1
        if (!lastContract) {
            return `CONT-${new Date().getFullYear()}-0001`;
        }

        // Extrai o número do último contrato
        const match = lastContract.id.match(/CONT-\d{4}-(\d{4})/);
        if (!match) {
            return `CONT-${new Date().getFullYear()}-0001`;
        }

        // Incrementa o número
        const lastNumber = parseInt(match[1], 10);
        const nextNumber = (lastNumber + 1).toString().padStart(4, '0');

        return `CONT-${new Date().getFullYear()}-${nextNumber}`;
    }
}
