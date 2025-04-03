/* eslint-disable prettier/prettier */
export interface IBrasilApiResponse {
    uf: string;
    cep: string;
    cnpj: string;
    razao_social: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    // ... outros campos que não vamos usar por enquanto
}

export interface ISellerAddress {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
}

export interface ISellerData {
    razaoSocial: string;
    endereco: ISellerAddress;
}
