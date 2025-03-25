import { IAutentiqueDocument } from './autentique-document.interface';

export interface IAutentiqueService {
  getDocument(documentId: string): Promise<IAutentiqueDocument>;
  createDocument(
    name: string,
    content: string,
    signers: Array<{ name: string; email: string }>,
  ): Promise<IAutentiqueDocument>;
  findDocumentBySellerCnpj(cnpj: string): Promise<IAutentiqueDocument | null>;
}
