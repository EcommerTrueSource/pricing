import { ApiProperty } from '@nestjs/swagger';
import { EContractStatus } from '../enums/contract-status.enum';

export class ContractStatusDto {
    @ApiProperty({
        enum: EContractStatus,
        description: 'Status do contrato',
        example: EContractStatus.DRAFT,
    })
    status!: EContractStatus;
}
