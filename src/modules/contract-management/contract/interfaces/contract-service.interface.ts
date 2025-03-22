import { Contract } from '../entities/contract.entity';
import { CreateContractDto } from '../dtos/create-contract.dto';
import { UpdateContractDto } from '../dtos/update-contract.dto';
import { EContractStatus } from '../enums/contract-status.enum';
import { EStatusChangeReason } from '../enums/status-change-reason.enum';
import { ContractResponseDto } from '../dtos/contract-response.dto';

export interface IContractService {
  create(createContractDto: CreateContractDto): Promise<Contract>;
  findAll(): Promise<Contract[]>;
  findOne(id: string): Promise<Contract>;
  update(id: string, updateContractDto: UpdateContractDto): Promise<Contract>;
  remove(id: string): Promise<void>;
  updateStatus(
    id: string,
    newStatus: EContractStatus,
    reason: EStatusChangeReason,
    metadata?: Record<string, unknown>,
  ): Promise<Contract>;
  cancel(id: string, reason: string): Promise<ContractResponseDto>;
  sign(id: string): Promise<ContractResponseDto>;
  findBySeller(sellerId: string): Promise<ContractResponseDto[]>;
}
