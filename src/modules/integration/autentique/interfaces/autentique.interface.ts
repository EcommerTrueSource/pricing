import { EContractStatus } from '../../../contract-management/contract/enums/contract-status.enum';

export enum AutentiqueDocumentStatus {
    DRAFT = 'DRAFT',
    PENDING = 'PENDING',
    SIGNED = 'SIGNED',
    REJECTED = 'REJECTED',
    EXPIRED = 'EXPIRED',
    CANCELLED = 'CANCELLED',
}

export interface IAutentiqueUser {
    id: string;
    name: string;
    email: string;
}

export interface IAutentiqueSignature {
    public_id: string;
    name: string;
    email: string;
    created_at: Date;
    action: { name: string };
    link: { short_link: string };
    user: IAutentiqueUser;
    signed: boolean;
}

export interface IAutentiqueFiles {
    original: string;
    signed: string;
    pades: string;
}

export interface IAutentiqueResponse {
    data: {
        createDocument: {
            id: string;
            name: string;
            refusable: boolean;
            sortable: boolean;
            created_at: string;
            signatures: Array<{
                public_id: string;
                name: string;
                email: string;
                created_at: string;
                action: {
                    name: string;
                };
                link: {
                    short_link: string;
                };
                user: IAutentiqueUser;
            }>;
        };
    };
    errors?: Array<{
        message: string;
    }>;
}

export interface IAutentiqueDocument {
    id: string;
    name: string;
    status: AutentiqueDocumentStatus;
    signatures: IAutentiqueSignature[];
    signed_count: number;
    created_at: Date;
    updatedAt: Date;
    signedAt?: Date;
    expiresAt?: Date;
    refusable: boolean;
    sortable: boolean;
    files: IAutentiqueFiles;
}

export interface IAutentiqueService {
    createDocument(
        documentName: string,
        content: string,
        signers: Array<{ name: string; email: string }>,
        options?: { short_link?: boolean },
    ): Promise<IAutentiqueDocument>;

    findDocumentBySellerCnpj(cnpj: string): Promise<IAutentiqueDocument[]>;
    deleteDocument(id: string): Promise<boolean>;
    mapStatus(document: IAutentiqueDocument): EContractStatus;
    getDocument(documentId: string): Promise<IAutentiqueDocument>;
    syncContracts(): Promise<void>;
    createSignatureLink(publicId: string): Promise<string>;
}
