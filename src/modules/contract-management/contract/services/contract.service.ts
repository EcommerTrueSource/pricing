import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { CreateContractDto } from '../dtos/create-contract.dto';
import { UpdateContractDto } from '../dtos/update-contract.dto';
import { EContractStatus } from '../enums/contract-status.enum';
import { EStatusChangeReason } from '../enums/status-change-reason.enum';
import { SellerService } from '../../seller/services/seller.service';
import { IContractService } from '../interfaces/contract-service.interface';
import { ContractResponseDto } from '../dtos/contract-response.dto';

@Injectable()
export class ContractService implements IContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sellerService: SellerService,
  ) {}

  async create(createContractDto: CreateContractDto): Promise<ContractResponseDto> {
    await this.sellerService.findOne(createContractDto.sellerId);

    const contract = await this.prisma.contracts.create({
      data: {
        seller_id: createContractDto.sellerId,
        template_id: createContractDto.templateId,
        status: EContractStatus.DRAFT,
        content: createContractDto.content,
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
    return contracts.map(contract => this.mapToResponseDto(contract));
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
    return contracts.map(contract => this.mapToResponseDto(contract));
  }

  async findByStatus(status: EContractStatus): Promise<ContractResponseDto[]> {
    const contracts = await this.prisma.contracts.findMany({
      where: { status },
      include: {
        sellers: true,
        templates: true,
      },
    });
    return contracts.map(contract => this.mapToResponseDto(contract));
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
    return contracts.map(contract => this.mapToResponseDto(contract));
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
    return contracts.map(contract => this.mapToResponseDto(contract));
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
