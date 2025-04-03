import { EContractStatus } from '../../contract/enums/contract-status.enum';

export interface IContractInfo {
    id: string;
    number: string;
    status: EContractStatus;
}
