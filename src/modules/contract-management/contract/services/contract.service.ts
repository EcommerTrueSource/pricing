import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
import { Logger } from '@nestjs/common';

@Injectable()
export class ContractService implements IContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sellerService: SellerService,
    private readonly contractTemplateService: ContractTemplateService,
    private readonly autentiqueService: AutentiqueService,
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

  async updateContractByCnpj(cnpj: string): Promise<ContractResponseDto> {
    this.logger.log(`Iniciando migração do contrato para o CNPJ ${cnpj}`);

    const seller = await this.prisma.sellers.findUnique({
      where: { cnpj },
    });

    if (!seller) {
      throw new NotFoundException(`Seller com CNPJ ${cnpj} não encontrado`);
    }
    this.logger.log(`Seller encontrado: ${seller.razao_social}`);

    const document = await this.autentiqueService.findDocumentBySellerCnpj(cnpj);

    if (!document) {
      throw new NotFoundException(`Documento não encontrado na Autentique para o CNPJ ${cnpj}`);
    }
    this.logger.log(`Documento encontrado na Autentique: ${document.id}`);

    const template = await this.prisma.templates.findFirst({
      where: { is_active: true },
      orderBy: { version: 'desc' },
    });

    if (!template) {
      throw new NotFoundException('Nenhum template ativo encontrado');
    }
    this.logger.log(`Template encontrado: ${template.version}`);

    let contract = await this.prisma.contracts.findFirst({
      where: { external_id: document.id },
    });

    const autentiqueStatus = this.mapAutentiqueStatus(document.status);

    if (!contract) {
      this.logger.log(`Criando novo contrato para o documento ${document.id}`);

      let expiresAt: Date;
      let finalStatus = autentiqueStatus;

      // Pega a data de assinatura do seller (ignora a assinatura da True Brands)
      const signedAt =
        document.signatures
          .filter((sig) => sig.signedAt && !sig.email.includes('@truebrands.com.br'))
          .map((sig) => sig.signedAt)[0] || null;

      if (autentiqueStatus === contract_status.SIGNED) {
        // Para contratos já assinados, define expiração como ontem
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() - 1);
        this.logger.log(
          `Contrato já assinado em ${signedAt?.toISOString()}, definindo data de expiração para ontem: ${expiresAt.toISOString()}`,
        );
      } else if (document.expiresAt) {
        // Se tem data de expiração na Autentique e não está assinado
        expiresAt = document.expiresAt;

        // Se a data já expirou, mantém a data original mas atualiza o status
        if (expiresAt < new Date()) {
          this.logger.log(
            `Contrato expirado em ${expiresAt.toISOString()}, atualizando status para EXPIRED`,
          );
          finalStatus = contract_status.EXPIRED;
        }
      } else {
        // Se não tem data de expiração e não está assinado, define 30 dias a partir de hoje
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        this.logger.log(`Definindo nova data de expiração: ${expiresAt.toISOString()}`);
      }

      contract = await this.prisma.contracts.create({
        data: {
          sellers: {
            connect: {
              id: seller.id,
            },
          },
          templates: {
            connect: {
              id: template.id,
            },
          },
          status: finalStatus,
          content: template.content,
          external_id: document.id,
          signing_url: document.signatures[0]?.signingUrl || null,
          notification_attempts: 0,
          last_notification_at: null,
          signed_at: signedAt,
          expires_at: expiresAt,
          created_at: new Date(document.createdAt),
        },
        include: {
          sellers: true,
          templates: true,
        },
      });

      await this.prisma.status_history.create({
        data: {
          contract_id: contract.id,
          from_status: contract_status.DRAFT,
          to_status: finalStatus,
          reason: status_change_reason.CREATED,
          metadata: {
            source: 'autentique_import',
            document_id: document.id,
            document_status: document.status,
            created_at: document.createdAt,
            signed_at: signedAt,
            expires_at: expiresAt,
            is_expired: expiresAt < new Date(),
            signatures: document.signatures.map((sig) => ({
              name: sig.name,
              email: sig.email,
              signed_at: sig.signedAt,
            })),
          },
        },
      });

      this.logger.log(`Novo contrato criado com ID ${contract.id} e status ${finalStatus}`);
    } else {
      this.logger.log(`Atualizando contrato existente ${contract.id}`);
      const oldStatus = contract.status;

      // Pega a data de assinatura do seller (ignora a assinatura da True Brands)
      const signedAt =
        document.signatures
          .filter((sig) => sig.signedAt && !sig.email.includes('@truebrands.com.br'))
          .map((sig) => sig.signedAt)[0] || null;

      contract = await this.prisma.contracts.update({
        where: { id: contract.id },
        data: {
          status: autentiqueStatus,
          content: template.content,
          signing_url: document.signatures[0]?.signingUrl || contract.signing_url,
          signed_at: signedAt,
          expires_at:
            autentiqueStatus === contract_status.SIGNED
              ? (() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  return yesterday;
                })()
              : document.expiresAt || contract.expires_at,
        },
      });

      if (oldStatus !== autentiqueStatus) {
        const reason =
          autentiqueStatus === contract_status.SIGNED
            ? status_change_reason.SIGNED
            : status_change_reason.SENT_TO_SIGNATURE;

        await this.prisma.status_history.create({
          data: {
            contract_id: contract.id,
            from_status: oldStatus,
            to_status: autentiqueStatus,
            reason,
            metadata: {
              source: 'autentique_update',
              document_id: document.id,
              document_status: document.status,
              signed_at: signedAt,
            },
          },
        });
        this.logger.log(`Status do contrato atualizado de ${oldStatus} para ${autentiqueStatus}`);
      }
    }

    this.logger.log(`Migração do contrato ${contract.id} concluída com sucesso`);
    return this.mapToResponseDto(contract);
  }

  private mapAutentiqueStatus(status: string): contract_status {
    switch (status.toUpperCase()) {
      case 'DRAFT':
        return contract_status.DRAFT;
      case 'SIGNED':
        return contract_status.SIGNED;
      case 'EXPIRED':
        return contract_status.EXPIRED;
      case 'CANCELLED':
        return contract_status.CANCELLED;
      case 'PENDING':
      case 'WAITING_SIGNERS':
        return contract_status.PENDING_SIGNATURE;
      default:
        this.logger.warn(
          `Status desconhecido da Autentique: ${status}. Definindo como PENDING_SIGNATURE`,
        );
        return contract_status.PENDING_SIGNATURE;
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
    };
  }
}
