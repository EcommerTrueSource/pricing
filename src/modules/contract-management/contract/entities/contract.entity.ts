import { EContractStatus } from '../enums/contract-status.enum';

export class Contract {
  id!: string;
  sellerId!: string;
  templateId!: string;
  status!: EContractStatus;
  content!: string;
  externalId?: string;
  signingUrl?: string;
  notificationAttempts!: number;
  lastNotificationAt?: Date;
  signedAt?: Date;
  expiresAt!: Date;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<Contract>) {
    Object.assign(this, partial);
  }
}
