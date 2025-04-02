import { CreateContractDto } from '../dtos/create-contract.dto';
import { UpdateContractDto } from '../dtos/update-contract.dto';
import { EContractStatus } from '../enums/contract-status.enum';
import { EStatusChangeReason } from '../enums/status-change-reason.enum';
import { ContractResponseDto } from '../dtos/contract-response.dto';
import { ContractDataDto } from '../dtos/contract-data.dto';

export interface IContractService {
    create(
        createContractDto: CreateContractDto,
        contractData: ContractDataDto,
    ): Promise<ContractResponseDto>;
    findAll(): Promise<ContractResponseDto[]>;
    findOne(id: string): Promise<ContractResponseDto>;
    update(id: string, updateContractDto: UpdateContractDto): Promise<ContractResponseDto>;
    remove(id: string): Promise<void>;
    updateStatus(
        id: string,
        status: EContractStatus,
        changeReason: EStatusChangeReason,
        metadata?: Record<string, any>,
    ): Promise<ContractResponseDto>;
    findBySeller(sellerId: string): Promise<ContractResponseDto[]>;
    findByStatus(status: EContractStatus): Promise<ContractResponseDto[]>;
    findExpired(): Promise<ContractResponseDto[]>;
    findPendingSignature(): Promise<ContractResponseDto[]>;
    cancel(id: string, reason: string): Promise<ContractResponseDto>;
    sign(id: string): Promise<ContractResponseDto>;
    sendToSignature(id: string): Promise<ContractResponseDto>;
    getStatusHistory(contractId: string): Promise<any[]>;
    updateContractByCnpj(cnpj: string): Promise<{
        contractsDeleted: number;
        hasMultipleContracts: boolean;
        failedDeletions: number;
    }>;
}
