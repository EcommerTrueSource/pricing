export interface IAutentiqueDocument {
  id: string;
  name: string;
  status: AutentiqueDocumentStatus;
  signedAt: Date | null;
  expiresAt: Date;
  signatures: Array<{
    name: string;
    email: string;
    status: AutentiqueDocumentStatus;
    signedAt: Date | null;
    signingUrl: string | null;
  }>;
}

export enum AutentiqueDocumentStatus {
  PENDING = 'pending',
  SIGNED = 'signed',
}
