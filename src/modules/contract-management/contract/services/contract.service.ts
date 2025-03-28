import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { CreateContractDto } from '../dtos/create-contract.dto';
import { UpdateContractDto } from '../dtos/update-contract.dto';
import { EContractStatus } from '../enums/contract-status.enum';
import { EStatusChangeReason } from '../enums/status-change-reason.enum';
import { SellerService } from '../../seller/services/seller.service';
import { IContractService } from '../interfaces/contract-service.interface';
import { ContractResponseDto } from '../dtos/contract-response.dto';
import { ContractTemplateService } from '../../template/services/contract-template.service';
import { ContractDataDto } from '../dtos/contract-data.dto';
import { AutentiqueService } from '../../../integration/autentique/services/autentique.service';
import { contract_status, status_change_reason } from '@prisma/client';
import { AutentiqueDocumentStatus } from '../../../integration/autentique/interfaces/autentique-document.interface';
import * as fs from 'fs';
import { NotificationService } from '../../notification/services/notification.service';
import { ENotificationType } from '../../notification/enums/notification-type.enum';
import { ENotificationChannel } from '../../notification/enums/notification-channel.enum';

@Injectable()
export class ContractService implements IContractService {
    private readonly logger = new Logger(ContractService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly sellerService: SellerService,
        private readonly contractTemplateService: ContractTemplateService,
        private readonly autentiqueService: AutentiqueService,
        private readonly notificationService: NotificationService,
    ) {}

    async create(
        createContractDto: CreateContractDto,
        contractData: ContractDataDto,
    ): Promise<ContractResponseDto> {
        await this.sellerService.findOne(createContractDto.sellerId);

        const templateData = {
            seller: {
                name: contractData.companyName,
                cnpj: contractData.companyCnpj,
                address: contractData.companyAddress,
            },
            contractNumber: contractData.contractNumber,
            contractDuration: contractData.contractDuration,
            commissionRate: contractData.commissionRate,
            paymentDay: contractData.paymentDay,
            jurisdiction: contractData.jurisdiction,
            city: contractData.city,
        };

        const content = await this.contractTemplateService.generateContract(templateData);

        const contract = await this.prisma.contracts.create({
            data: {
                seller_id: createContractDto.sellerId,
                template_id: createContractDto.templateId,
                status: EContractStatus.DRAFT,
                content,
                expires_at: createContractDto.expiresAt,
            },
        });
        return this.mapToResponseDto(contract);
    }

    async findAll(): Promise<ContractResponseDto[]> {
        const contracts = await this.prisma.contracts.findMany({
            include: {
                sellers: true,
                templates: true,
            },
        });
        return contracts.map((contract) => this.mapToResponseDto(contract));
    }

    async findOne(id: string): Promise<ContractResponseDto> {
        const contract = await this.prisma.contracts.findUnique({
            where: { id },
            include: {
                sellers: true,
                templates: true,
            },
        });

        if (!contract) {
            throw new NotFoundException(`Contrato com ID ${id} não encontrado`);
        }

        return this.mapToResponseDto(contract);
    }

    async update(id: string, updateContractDto: UpdateContractDto): Promise<ContractResponseDto> {
        try {
            const contract = await this.prisma.contracts.update({
                where: { id },
                data: updateContractDto,
            });
            return this.mapToResponseDto(contract);
        } catch (error) {
            throw new NotFoundException(`Contrato com ID ${id} não encontrado`);
        }
    }

    async remove(id: string): Promise<void> {
        try {
            await this.prisma.contracts.delete({
                where: { id },
            });
        } catch (error) {
            throw new NotFoundException(`Contrato com ID ${id} não encontrado`);
        }
    }

    async updateStatus(
        id: string,
        status: EContractStatus,
        changeReason: EStatusChangeReason,
        metadata?: Record<string, any>,
    ): Promise<ContractResponseDto> {
        const contract = await this.findOne(id);

        await this.prisma.status_history.create({
            data: {
                contract_id: id,
                from_status: contract.status,
                to_status: status,
                reason: changeReason as any,
                metadata: metadata || {},
            },
        });

        const updatedContract = await this.prisma.contracts.update({
            where: { id },
            data: { status },
        });
        return this.mapToResponseDto(updatedContract);
    }

    async findBySeller(sellerId: string): Promise<ContractResponseDto[]> {
        const contracts = await this.prisma.contracts.findMany({
            where: { seller_id: sellerId },
            include: {
                sellers: true,
                templates: true,
            },
        });
        return contracts.map((contract) => this.mapToResponseDto(contract));
    }

    async findByStatus(status: EContractStatus): Promise<ContractResponseDto[]> {
        const contracts = await this.prisma.contracts.findMany({
            where: { status },
            include: {
                sellers: true,
                templates: true,
            },
        });
        return contracts.map((contract) => this.mapToResponseDto(contract));
    }

    async findExpired(): Promise<ContractResponseDto[]> {
        const contracts = await this.prisma.contracts.findMany({
            where: {
                expires_at: {
                    lt: new Date(),
                },
                status: {
                    not: EContractStatus.EXPIRED,
                },
            },
            include: {
                sellers: true,
                templates: true,
            },
        });
        return contracts.map((contract) => this.mapToResponseDto(contract));
    }

    async findPendingSignature(): Promise<ContractResponseDto[]> {
        const contracts = await this.prisma.contracts.findMany({
            where: {
                status: EContractStatus.PENDING_SIGNATURE,
                expires_at: {
                    gt: new Date(),
                },
            },
            include: {
                sellers: true,
                templates: true,
            },
        });
        return contracts.map((contract) => this.mapToResponseDto(contract));
    }

    async cancel(id: string, reason: string): Promise<ContractResponseDto> {
        const contract = await this.findOne(id);

        if (contract.status === EContractStatus.CANCELLED) {
            throw new BadRequestException('Contrato já está cancelado');
        }

        await this.prisma.status_history.create({
            data: {
                contract_id: id,
                from_status: contract.status,
                to_status: EContractStatus.CANCELLED,
                reason: EStatusChangeReason.MANUAL_CANCELLATION as any,
                metadata: { reason },
            },
        });

        const updatedContract = await this.prisma.contracts.update({
            where: { id },
            data: { status: EContractStatus.CANCELLED },
        });

        return this.mapToResponseDto(updatedContract);
    }

    async sign(id: string): Promise<ContractResponseDto> {
        const contract = await this.findOne(id);

        if (contract.status !== EContractStatus.PENDING_SIGNATURE) {
            throw new BadRequestException('Contrato não está pendente de assinatura');
        }

        const updatedContract = await this.updateStatus(
            id,
            EContractStatus.SIGNED,
            EStatusChangeReason.SIGNED,
        );

        return this.mapToResponseDto(updatedContract);
    }

    async sendToSignature(contractId: string, sellerId: string) {
        const contract = await this.findOne(contractId);
        if (!contract) {
            throw new Error('Contrato não encontrado');
        }

        await this.updateStatus(
            contractId,
            EContractStatus.PENDING_SIGNATURE,
            EStatusChangeReason.SENT_TO_SIGNATURE,
        );

        // Enviar notificação
        await this.notificationService.sendNotification({
            contractId,
            sellerId,
            type: ENotificationType.SIGNATURE_PENDING,
            channel: ENotificationChannel.WHATSAPP,
        });
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
            case contract_status.DRAFT:
                return status_change_reason.CREATED;
            case contract_status.SIGNED:
                return status_change_reason.SIGNED;
            case contract_status.EXPIRED:
                return status_change_reason.EXPIRED;
            case contract_status.CANCELLED:
                return status_change_reason.CANCELLED;
            case contract_status.PENDING_SIGNATURE:
                return status_change_reason.SENT_TO_SIGNATURE;
            default:
                throw new Error(`Status desconhecido: ${status}`);
        }
    }

    private mapToResponseDto(contract: any): ContractResponseDto {
        return {
            id: contract.id,
            sellerId: contract.seller_id,
            templateId: contract.template_id,
            status: contract.status,
            content: contract.content,
            externalId: contract.external_id,
            signingUrl: contract.signing_url,
            notificationAttempts: contract.notification_attempts,
            lastNotificationAt: contract.last_notification_at,
            signedAt: contract.signed_at,
            expiresAt: contract.expires_at,
            createdAt: contract.created_at,
            updatedAt: contract.updated_at,
            contractsDeleted: 0,
            hasMultipleContracts: false,
        };
    }

    async updateAllContracts(): Promise<void> {
        try {
            this.logger.log('🔄 Iniciando atualização de todos os contratos...');

            // Busca apenas sellers que têm contratos
            const sellers = await this.prisma.sellers.findMany({
                where: {
                    contracts: {
                        some: {
                            AND: [
                                {
                                    id: {
                                        not: null,
                                    },
                                },
                                {
                                    external_id: {
                                        not: null,
                                    },
                                },
                                {
                                    status: {
                                        not: EContractStatus.DRAFT,
                                    },
                                },
                            ],
                        },
                    },
                },
                select: {
                    id: true,
                    cnpj: true,
                    razao_social: true,
                },
            });

            this.logger.log(
                `📋 Encontrados ${sellers.length} sellers com contratos para processar`,
            );

            // Processa em lotes de 45 sellers
            const batchSize = 45;
            const totalBatches = Math.ceil(sellers.length / batchSize);
            let currentBatch = 0;
            let totalSuccess = 0;
            let totalFailures = 0;
            let totalContractsDeleted = 0;
            let totalMultipleContracts = 0;

            for (let i = 0; i < sellers.length; i += batchSize) {
                currentBatch++;
                const batch = sellers.slice(i, i + batchSize);
                let batchSuccess = 0;
                let batchFailures = 0;
                let batchContractsDeleted = 0;
                let batchMultipleContracts = 0;

                this.logger.log(
                    `\nProcessando lote ${currentBatch}/${totalBatches} (${batch.length} sellers)...`,
                );

                for (const seller of batch) {
                    try {
                        this.logger.log(
                            `\nProcessando seller ${seller.cnpj} (${seller.razao_social})...`,
                        );
                        const result = await this.updateContractByCnpj(seller.cnpj);

                        // Atualiza os contadores do lote
                        batchSuccess++;
                        batchContractsDeleted += result.contractsDeleted;
                        if (result.hasMultipleContracts) {
                            batchMultipleContracts++;
                        }
                    } catch (error) {
                        this.logger.error(`❌ Erro ao processar seller ${seller.cnpj}:`, error);
                        batchFailures++;
                    }

                    // Aguarda 1 segundo entre cada seller
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }

                // Atualiza os contadores totais
                totalSuccess += batchSuccess;
                totalFailures += batchFailures;
                totalContractsDeleted += batchContractsDeleted;
                totalMultipleContracts += batchMultipleContracts;

                // Log do resumo do lote
                this.logger.log('\n=== Resumo do Lote ===');
                this.logger.log(`Sucessos: ${batchSuccess}`);
                this.logger.log(`Falhas: ${batchFailures}`);
                this.logger.log(`Contratos Deletados: ${batchContractsDeleted}`);
                this.logger.log(`Sellers com Múltiplos Contratos: ${batchMultipleContracts}`);

                // Se não for o último lote, aguarda 60 segundos
                if (currentBatch < totalBatches) {
                    const remainingBatches = totalBatches - currentBatch;
                    const estimatedMinutes = Math.ceil(remainingBatches * 2); // 2 minutos por lote
                    this.logger.log(
                        `\nAguardando 60 segundos antes do próximo lote... Tempo restante estimado: ${estimatedMinutes} minutos`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, 60000));
                }
            }

            // Log do resumo final
            this.logger.log('\n=== Resumo Final ===');
            this.logger.log(`Total de Sellers com Contratos Processados: ${sellers.length}`);
            this.logger.log(`Sucessos: ${totalSuccess}`);
            this.logger.log(`Falhas: ${totalFailures}`);
            this.logger.log(`Total de Contratos Deletados: ${totalContractsDeleted}`);
            this.logger.log(`Total de Sellers com Múltiplos Contratos: ${totalMultipleContracts}`);

            // Salva o resumo em um arquivo
            const summary = `
=== Resumo da Atualização de Contratos ===
Data: ${new Date().toLocaleString()}
Total de Sellers com Contratos no Banco: ${sellers.length}
Total de Sellers Processados: ${sellers.length}
Sucessos: ${totalSuccess}
Falhas: ${totalFailures}
Total de Contratos Deletados: ${totalContractsDeleted}
Total de Sellers com Múltiplos Contratos: ${totalMultipleContracts}
      `.trim();

            fs.writeFileSync('contract-update-summary.txt', summary);
            this.logger.log('\n✅ Resumo salvo em contract-update-summary.txt');
        } catch (error) {
            this.logger.error('❌ Erro ao atualizar contratos:', error);
            throw error;
        }
    }

    async updateContractByCnpj(cnpj: string): Promise<{
        contractsDeleted: number;
        hasMultipleContracts: boolean;
        failedDeletions: number;
    }> {
        this.logger.log(`[${cnpj}] 🔄 Iniciando atualização de contrato`);
        let contractsDeleted = 0;
        let failedDeletions = 0;

        try {
            // Busca documentos na Autentique
            const documents = await this.autentiqueService.findDocumentBySellerCnpj(cnpj);

            if (!documents || documents.length === 0) {
                this.logger.warn(`[${cnpj}] ❌ Nenhum documento encontrado na Autentique`);
                return { contractsDeleted: 0, hasMultipleContracts: false, failedDeletions: 0 };
            }

            this.logger.log(
                `[${cnpj}] 📄 Encontrados ${documents.length} documentos na Autentique`,
            );

            // Se tem mais de um documento, prioriza o assinado
            if (documents.length > 1) {
                const signedDocument = documents.find((doc) =>
                    doc.signatures.some(
                        (sig) =>
                            sig &&
                            sig.email &&
                            !sig.email.includes('truebrands.com.br') &&
                            sig.signed,
                    ),
                );

                if (signedDocument) {
                    this.logger.log(
                        `[${cnpj}] ✅ Priorizando documento assinado: ${signedDocument.id}`,
                    );
                    // Remove os outros documentos
                    const documentsToDelete = documents.filter(
                        (doc) => doc.id !== signedDocument.id,
                    );
                    for (const doc of documentsToDelete) {
                        try {
                            const deleted = await this.autentiqueService.deleteDocument(doc.id);
                            if (deleted) {
                                this.logger.log(`[${cnpj}] ✅ Documento removido: ${doc.id}`);
                                contractsDeleted++;
                            } else {
                                this.logger.warn(
                                    `[${cnpj}] ⚠️ Não foi possível remover o documento: ${doc.id}`,
                                );
                                failedDeletions++;
                            }
                        } catch (error) {
                            this.logger.error(
                                `[${cnpj}] ❌ Erro ao deletar documento ${doc.id}:`,
                                error,
                            );
                            failedDeletions++;
                        }
                    }
                    documents.length = 0;
                    documents.push(signedDocument);
                } else {
                    // Se nenhum está assinado, mantém o mais antigo
                    const oldestDocument = documents.reduce((oldest, current) => {
                        return new Date(current.created_at) < new Date(oldest.created_at)
                            ? current
                            : oldest;
                    });
                    this.logger.log(
                        `[${cnpj}] 📅 Priorizando documento mais antigo: ${oldestDocument.id}`,
                    );
                    // Remove os outros documentos
                    const documentsToDelete = documents.filter(
                        (doc) => doc.id !== oldestDocument.id,
                    );
                    for (const doc of documentsToDelete) {
                        try {
                            const deleted = await this.autentiqueService.deleteDocument(doc.id);
                            if (deleted) {
                                this.logger.log(`[${cnpj}] ✅ Documento removido: ${doc.id}`);
                                contractsDeleted++;
                            } else {
                                this.logger.warn(
                                    `[${cnpj}] ⚠️ Não foi possível remover o documento: ${doc.id}`,
                                );
                                failedDeletions++;
                            }
                        } catch (error) {
                            this.logger.error(
                                `[${cnpj}] ❌ Erro ao deletar documento ${doc.id}:`,
                                error,
                            );
                            failedDeletions++;
                        }
                    }
                    documents.length = 0;
                    documents.push(oldestDocument);
                }
            }

            // Atualiza o contrato com o documento selecionado
            const document = documents[0];
            const autentiqueStatus = this.autentiqueService.mapStatus(document);
            const newStatus = this.mapAutentiqueStatus(autentiqueStatus);

            // Atualiza o contrato no banco
            await this.prisma.contracts.updateMany({
                where: {
                    sellers: {
                        cnpj,
                    },
                },
                data: {
                    external_id: document.id,
                    status: newStatus,
                    signed_at: document.signedAt,
                    updated_at: document.updatedAt,
                    signing_url: document.signatures[0]?.link?.short_link || null,
                },
            });

            this.logger.log(`[${cnpj}] ✅ Contrato atualizado com sucesso`);
            return {
                contractsDeleted,
                hasMultipleContracts: documents.length > 1,
                failedDeletions,
            };
        } catch (error) {
            this.logger.error(`[${cnpj}] ❌ Erro ao atualizar contrato:`, error);
            throw error;
        }
    }
}
