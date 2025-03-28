export enum AutentiqueDocumentStatus {
  PENDING = 'PENDING',
  SIGNED = 'SIGNED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface IAutentiqueEmailEvent {
  sent?: Date;
  opened?: Date;
  delivered?: Date;
  refused?: Date;
  reason?: string;
}

export interface IAutentiqueSignature {
  public_id: string;
  name: string;
  email: string;
  created_at: Date;
  action: { name: string };
  link?: { short_link: string };
  user?: { id: string; name: string; email: string; phone: string };
  user_data?: { name: string; email: string; phone: string };
  email_events?: IAutentiqueEmailEvent;
  viewed?: { timestamp: Date };
  signed?: { timestamp: Date };
  rejected?: { timestamp: Date };
}

export interface IAutentiqueDocument {
  id: string;
  name: string;
  refusable: boolean;
  sortable: boolean;
  created_at: Date;
  files: {
    original: string;
    signed: string;
    pades: string;
  };
  signatures: IAutentiqueSignature[];
  signed_count: number;
  status: AutentiqueDocumentStatus;
  signedAt: Date | null;
  expiresAt: Date | null;
  updatedAt: Date;
}
