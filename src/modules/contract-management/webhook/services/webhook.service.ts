import { Injectable, Logger } from '@nestjs/common';
import { BrasilApiService } from '../../../integration/brasil-api/services/brasil-api.service';
import { ContractService } from '../../contract/services/contract.service';
import { ContractTemplateService } from '../../template/services/contract-template.service';
import { EContractStatus } from '../../contract/enums/contract-status.enum';
import { EStatusChangeReason } from '../../contract/enums/status-change-reason.enum';
import { NotificationService } from '../../notification/services/notification.service';
import { WebhookDto } from '../dtos/webhook.dto';
import { GoogleDocsService } from '../../template/services/google-docs.service';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly brasilApiService: BrasilApiService,
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

            // 2. Busca dados na Brasil API
            this.logger.log('📄 Buscando dados na Brasil API para CNPJ:', data.cnpj);
            const brasilApiData = await this.brasilApiService.getSellerData(data.cnpj);
            this.logger.log('✅ Dados recebidos da Brasil API:', {
                razaoSocial: brasilApiData.razaoSocial,
                endereco: brasilApiData.endereco,
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

                // Se não tem contrato assinado, atualiza dados e remove contratos pendentes
                this.logger.log(
                    '📄 Atualizando dados do vendedor e removendo contratos pendentes...',
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
                        razao_social: brasilApiData.razaoSocial.slice(0, 255),
                        email: data.email.slice(0, 255),
                        telefone: data.telefone.replace(/\D/g, '').slice(0, 20),
                        endereco: `${brasilApiData.endereco.logradouro}, ${brasilApiData.endereco.numero} - ${brasilApiData.endereco.bairro}, ${brasilApiData.endereco.municipio}/${brasilApiData.endereco.uf} - CEP: ${brasilApiData.endereco.cep}`,
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
                    name: brasilApiData.razaoSocial,
                    cnpj: formattedCnpj,
                    address: `${brasilApiData.endereco.logradouro}, ${brasilApiData.endereco.numero} - ${brasilApiData.endereco.bairro}, ${brasilApiData.endereco.municipio}/${brasilApiData.endereco.uf} - CEP: ${brasilApiData.endereco.cep}`,
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
                    companyName: brasilApiData.razaoSocial,
                    companyCnpj: data.cnpj,
                    companyAddress: `${brasilApiData.endereco.logradouro}, ${brasilApiData.endereco.numero} - ${brasilApiData.endereco.bairro}, ${brasilApiData.endereco.municipio}/${brasilApiData.endereco.uf} - CEP: ${brasilApiData.endereco.cep}`,
                    contractDuration: 12,
                    commissionRate: 10,
                    paymentDay: 10,
                    jurisdiction: 'São Paulo/SP',
                    city: brasilApiData.endereco.municipio,
                    seller: {
                        id: sellerId,
                        cnpj: data.cnpj,
                        razao_social: brasilApiData.razaoSocial,
                        email: data.email,
                        telefone: data.telefone,
                        endereco: `${brasilApiData.endereco.logradouro}, ${brasilApiData.endereco.numero} - ${brasilApiData.endereco.bairro}, ${brasilApiData.endereco.municipio}/${brasilApiData.endereco.uf} - CEP: ${brasilApiData.endereco.cep}`,
                    },
                },
            );
            this.logger.log('✅ Contrato criado:', { id: contract.id });

            // 8. Envia para assinatura
            this.logger.log('📄 Enviando contrato para assinatura...');
            const signedContract = await this.contractService.sendToSignature(contract.id);
            this.logger.log('✅ Contrato enviado para assinatura:', {
                id: signedContract.id,
                signingUrl: signedContract.signingUrl,
            });

            // 9. Atualiza status do contrato
            await this.contractService.updateStatus(
                contract.id,
                EContractStatus.PENDING_SIGNATURE,
                EStatusChangeReason.SENT_TO_SIGNATURE,
                { externalId: signedContract.externalId },
            );
            this.logger.log('✅ Status do contrato atualizado');

            // Garante que temos todos os dados necessários
            if (!signedContract.signingUrl) {
                throw new Error('URL de assinatura não gerada');
            }

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
