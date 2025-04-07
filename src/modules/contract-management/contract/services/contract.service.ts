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
import { AutentiqueDocumentStatus } from '../../../integration/autentique/interfaces/autentique.interface';
import { contract_status, status_change_reason } from '@prisma/client';
import { NotificationService } from '../../notification/services/notification.service';
import { SellerResponseDto } from '../../seller/dtos/seller-response.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContractSentToSignatureEvent } from '../../events/contract.events';

@Injectable()
export class ContractService implements IContractService {
    private readonly logger = new Logger(ContractService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly sellerService: SellerService,
        private readonly contractTemplateService: ContractTemplateService,
        private readonly autentiqueService: AutentiqueService,
        private readonly notificationService: NotificationService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async create(
        createContractDto: CreateContractDto,
        contractData: ContractDataDto,
    ): Promise<ContractResponseDto> {
        this.logger.log(`[create] Criando contrato para o vendedor ${createContractDto.sellerId}`);
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
        // Verificar se contrato existe antes de mais nada
        const contractExists = await this.prisma.contracts.findUnique({
            where: { id },
            select: { status: true }, // Seleciona apenas o status para eficiência
        });
        if (!contractExists) {
            throw new NotFoundException(
                `Contrato com ID ${id} não encontrado para atualização de status`,
            );
        }

        // 1. Cria o histórico primeiro
        await this.prisma.status_history.create({
            data: {
                contract_id: id,
                from_status: contractExists.status, // Usa o status atual lido
                to_status: status,
                reason: changeReason as status_change_reason, // Cast para o tipo do Prisma
                metadata: metadata || {},
                changed_at: new Date(), // Registrar o momento da mudança
            },
        });

        const dataToUpdate: any = {
            status,
            ...(metadata?.external_id && { external_id: metadata.external_id }),
            ...(metadata?.signing_url && { signing_url: metadata.signing_url }),
            updated_at: new Date(),
        };

        // 2. Atualiza o contrato
        await this.prisma.contracts.update({
            where: { id },
            data: dataToUpdate,
        });

        // 3. Re-busca o contrato completo para garantir todos os dados para o DTO
        const updatedContractFull = await this.prisma.contracts.findUnique({
            where: { id },
            include: {
                sellers: true,
                templates: true,
            },
        });

        if (!updatedContractFull) {
            this.logger.error(
                `[updateStatus] Contrato ${id} não encontrado após atualização bem-sucedida.`,
            );
            throw new NotFoundException(`Contrato com ID ${id} desapareceu após atualização`);
        }

        this.logger.log(`[updateStatus] Status do contrato ${id} atualizado para ${status}`);

        // Emitir novo evento APÓS salvar a URL e status
        if (
            status === EContractStatus.PENDING_SIGNATURE &&
            changeReason === EStatusChangeReason.SENT_TO_SIGNATURE &&
            updatedContractFull.signing_url
        ) {
            this.logger.log(
                `[updateStatus] Emitindo evento ASYNC contract.sent_to_signature para contrato ${id}`,
            );
            try {
                await this.eventEmitter.emitAsync(
                    'contract.sent_to_signature',
                    new ContractSentToSignatureEvent(
                        updatedContractFull.id,
                        updatedContractFull.seller_id,
                        updatedContractFull.signing_url,
                        new Date(),
                    ),
                );
                this.logger.log(
                    `[updateStatus] Evento ASYNC contract.sent_to_signature processado para contrato ${id}`,
                );
            } catch (eventError) {
                this.logger.error(
                    `[updateStatus] Erro ao processar evento ASYNC contract.sent_to_signature para ${id}: ${eventError.message}`,
                    eventError.stack,
                );
            }
        }

        return this.mapToResponseDto(updatedContractFull);
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

    async sendToSignature(
        id: string,
        data?: { content: string; seller: SellerResponseDto },
    ): Promise<ContractResponseDto> {
        try {
            const contract = await this.findOne(id);
            const seller = data?.seller || (await this.sellerService.findOne(contract.sellerId));

            // Formata o CNPJ para o nome do documento
            const formattedCnpj = seller.cnpj
                .replace(/\D/g, '')
                .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');

            // Obtém o template ativo
            const template = await this.contractTemplateService.getActiveTemplate();
            if (!template) {
                throw new Error('Template não encontrado');
            }

            // Obtém o ID do documento do Google Docs
            const documentId = process.env.GOOGLE_DOC_ID;
            if (!documentId) {
                throw new Error('ID do documento do Google Docs não configurado');
            }

            // Cria uma cópia do template com os dados do seller
            const filledDocId =
                await this.contractTemplateService.googleDocsService.createFilledTemplate(
                    documentId,
                    {
                        seller: {
                            name: seller.razaoSocial,
                            cnpj: formattedCnpj,
                            address: seller.endereco,
                        },
                        date: new Date().toLocaleDateString('pt-BR', {
                            timeZone: 'America/Sao_Paulo',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        }),
                    },
                );

            // Obtém o conteúdo do documento
            const content =
                await this.contractTemplateService.googleDocsService.getDocument(filledDocId);

            // Cria o documento na Autentique
            const document = await this.autentiqueService.createDocument(
                `Contrato PMA True Brands - ${formattedCnpj}`,
                content.toString('base64'),
                [
                    {
                        name: seller.razaoSocial,
                        email: seller.email,
                    },
                ],
                {
                    short_link: true,
                    message: `Prezado(a) Parceiro(a),

Esperamos que esta mensagem o(a) encontre bem.

Temos o prazer de apresentar a nova Política de Preço Mínimo da TRUE BRANDS, uma iniciativa estratégica que visa fortalecer nossa parceria e garantir a equidade e competitividade no mercado.

É importante ressaltar que esta política se limita exclusivamente à regulamentação do preço final de venda online e não altera outras políticas comerciais vigentes.

Benefícios da Nova Política:
• Proteção das Margens de Lucro: Garante que os preços não sejam praticados abaixo de níveis que comprometam suas margens.
• Fortalecimento da Marca: Contribui para manter a percepção de valor dos produtos e preservar a imagem da marca.
• Concorrência Justa: Promove um ambiente competitivo saudável e equilibrado, evitando práticas desleais de preços.

Este é um passo importante para garantir o sucesso contínuo de nossa parceria. Estamos comprometidos em crescer e prosperar juntos no mercado.

No botão de assinatura abaixo, você encontrará o contrato que detalha essas diretrizes. Solicitamos que leia o documento atentamente e, caso esteja de acordo com os termos, assine-o.

Caso tenha alguma dúvida ou necessite de assistência, não hesite em entrar em contato conosco. Agradecemos antecipadamente pela sua cooperação e continuamos à disposição para fornecer todo o suporte necessário.

Atenciosamente,
Equipe TRUE BRANDS`,
                },
            );

            this.logger.debug(
                '[sendToSignature] Resposta recebida da Autentique:',
                JSON.stringify(document, null, 2),
            );

            // Encontra o signatário que criamos
            const sellerEmailLower = seller.email.toLowerCase().trim();
            this.logger.debug(
                `[sendToSignature] Buscando signatário com email "${sellerEmailLower}" na resposta da Autentique`,
            );

            const signer = document.signatures.find(
                (s) =>
                    s.email.toLowerCase().trim() === sellerEmailLower && s.action?.name === 'SIGN',
            );

            this.logger.debug(
                `[sendToSignature] Resultado da busca por signatário: ${signer ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`,
            );
            if (signer) {
                this.logger.debug(
                    `[sendToSignature] Dados do signatário encontrado: email=${signer.email}, action=${signer.action?.name}, link=${JSON.stringify(signer.link)}`,
                );
            } else {
                this.logger.debug(
                    `[sendToSignature] Todos os signatários disponíveis: ${JSON.stringify(document.signatures.map((s) => ({ email: s.email, action: s.action?.name })))}`,
                );
            }

            // Após a verificação do signatário
            if (!signer?.link?.short_link) {
                this.logger.error('Erro ao obter link de assinatura:', {
                    documentId: document.id,
                    signatures: document.signatures,
                    sellerEmail: seller.email,
                });

                // Em vez de falhar completamente, vamos prosseguir mesmo sem o link
                this.logger.log(
                    '[sendToSignature] ⚠️ Continuando sem URL de assinatura - o contrato será criado, mas a notificação pode falhar',
                );

                // Atualiza o contrato no banco de dados de qualquer maneira
                const updatedContract = await this.updateStatus(
                    id,
                    EContractStatus.PENDING_SIGNATURE,
                    EStatusChangeReason.SENT_TO_SIGNATURE,
                    {
                        external_id: document.id,
                        signing_url: null, // Sem URL
                    },
                );

                // Retornamos o contrato, mas o WebhookService vai detectar a falta da URL
                return this.mapToResponseDto(updatedContract);

                // Não lançamos mais o erro: throw new Error('URL de assinatura não gerada');
            }

            this.logger.debug(
                `[sendToSignature] Link de assinatura encontrado: ${signer.link.short_link}`,
            );

            // Atualiza o status do contrato
            const updatedContract = await this.updateStatus(
                id,
                EContractStatus.PENDING_SIGNATURE,
                EStatusChangeReason.SENT_TO_SIGNATURE,
                {
                    external_id: document.id,
                    signing_url: signer.link.short_link,
                },
            );

            return this.mapToResponseDto(updatedContract);
        } catch (error) {
            this.logger.error('Erro ao enviar contrato para assinatura:', error);
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
        const sellerDto = contract.sellers
            ? {
                  id: contract.sellers.id,
                  cnpj: contract.sellers.cnpj,
                  razaoSocial: contract.sellers.razao_social,
                  email: contract.sellers.email,
                  telefone: contract.sellers.telefone,
                  endereco: contract.sellers.endereco,
                  createdAt: contract.sellers.created_at,
                  updatedAt: contract.sellers.updated_at,
              }
            : undefined;

        const templateDto = contract.templates
            ? {
                  id: contract.templates.id,
                  name: contract.templates.name,
                  content: contract.templates.content,
                  version: contract.templates.version,
                  isActive: contract.templates.is_active,
                  createdAt: contract.templates.created_at,
                  updatedAt: contract.templates.updated_at,
              }
            : undefined;

        this.logger.debug(
            `[mapToResponseDto] Mapeando contrato ID: ${contract.id}, Seller ID: ${contract.seller_id}, URL: ${contract.signing_url || 'NENHUMA'}`,
        );

        // Adiciona verificação adicional para identificar inconsistências
        if (contract.status === EContractStatus.PENDING_SIGNATURE && !contract.signing_url) {
            this.logger.warn(
                `[mapToResponseDto] INCONSISTÊNCIA DETECTADA: Contrato ${contract.id} está PENDING_SIGNATURE mas não tem signing_url!`,
            );

            // Tenta buscar diretamente do banco para verificar se há divergência
            try {
                const directCheck = this.prisma.contracts.findUnique({
                    where: { id: contract.id },
                    select: { signing_url: true },
                });

                // Loga resultado quando a Promise for resolvida
                directCheck
                    .then((result) => {
                        if (result && result.signing_url) {
                            this.logger.warn(
                                `[mapToResponseDto] 🔍 Verificação direta encontrou URL no banco: ${result.signing_url}`,
                            );
                            // Corrije o objeto contract com o valor do banco
                            contract.signing_url = result.signing_url;
                        } else {
                            this.logger.warn(
                                `[mapToResponseDto] 🔍 Verificação direta confirma ausência de URL no banco`,
                            );
                        }
                    })
                    .catch((err) => {
                        this.logger.error(
                            `[mapToResponseDto] Erro na verificação direta: ${err.message}`,
                        );
                    });
            } catch (err) {
                this.logger.error(
                    `[mapToResponseDto] Falha ao fazer verificação direta: ${err.message}`,
                );
            }
        }

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
            seller: sellerDto,
            template: templateDto,
        };
    }

    async getStatusHistory(id: string): Promise<
        Array<{
            fromStatus: EContractStatus;
            toStatus: EContractStatus;
            reason: EStatusChangeReason;
            metadata: Record<string, any>;
            changedAt: Date;
        }>
    > {
        const history = await this.prisma.status_history.findMany({
            where: { contract_id: id },
            orderBy: { created_at: 'desc' },
        });

        return history.map((record) => ({
            fromStatus: record.from_status as EContractStatus,
            toStatus: record.to_status as EContractStatus,
            reason: record.reason as EStatusChangeReason,
            metadata: record.metadata as Record<string, any>,
            changedAt: record.created_at,
        }));
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
                const batchSuccess = 0;
                let batchFailures = 0;
                const batchContractsDeleted = 0;
                const batchMultipleContracts = 0;

                this.logger.log(
                    `\nProcessando lote ${currentBatch}/${totalBatches} (${batch.length} sellers)...`,
                );

                for (const seller of batch) {
                    try {
                        this.logger.log(
                            `Processando seller ${seller.razao_social} (CNPJ: ${seller.cnpj})...`,
                        );

                        // ... existing code ...
                    } catch (error) {
                        this.logger.error(
                            `Erro ao processar seller ${seller.razao_social}:`,
                            error,
                        );
                        batchFailures++;
                    }
                }

                totalSuccess += batchSuccess;
                totalFailures += batchFailures;
                totalContractsDeleted += batchContractsDeleted;
                totalMultipleContracts += batchMultipleContracts;
            }

            this.logger.log(
                `📋 Processamento concluído. Sucessos: ${totalSuccess}, Falhas: ${totalFailures}, Contratos deletados: ${totalContractsDeleted}, Contratos múltiplos: ${totalMultipleContracts}`,
            );
        } catch (error) {
            this.logger.error('Erro ao atualizar todos os contratos:', error);
            throw error;
        }
    }

    async updateContractByCnpj(cnpj: string): Promise<{
        contractsDeleted: number;
        hasMultipleContracts: boolean;
        failedDeletions: number;
    }> {
        const seller = await this.prisma.sellers.findFirst({
            where: { cnpj },
            include: { contracts: true },
        });

        if (!seller) {
            throw new NotFoundException(`Seller com CNPJ ${cnpj} não encontrado`);
        }

        const contracts = seller.contracts;
        const hasMultipleContracts = contracts.length > 1;

        // Aqui você pode implementar a lógica de atualização específica
        // Por enquanto, retornamos apenas as informações básicas
        return {
            contractsDeleted: 0,
            hasMultipleContracts,
            failedDeletions: 0,
        };
    }
}
