export enum AutentiqueDocumentStatus {
  PENDING = 'PENDING',
  SIGNED = 'SIGNED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface IAutentiqueDocument {
  id: string;
  name: string;
  status: AutentiqueDocumentStatus;
  signed_count: number;
  signedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  signatures: IAutentiqueSignature[];
}

export interface IAutentiqueSignature {
  name: string;
  email: string;
  status: AutentiqueDocumentStatus;
  signedAt: Date | null;
  signingUrl: string | null;
}
