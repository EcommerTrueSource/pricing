export interface ICnpjwsAddress {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio?: string;
    cidade?: {
        id: number;
        nome: string;
        ibge_id: number;
        siafi_id: string;
    };
    uf?: string;
    estado?: {
        id: number;
        nome: string;
        sigla: string;
        ibge_id: number;
    };
    cep: string;
}

export interface ICnpjwsAtividade {
    id: string;
    secao: string;
    divisao: string;
    grupo: string;
    classe: string;
    subclasse: string;
    descricao: string;
}

export interface ICnpjwsEstabelecimento {
    cnpj: string;
    cnpj_raiz: string;
    nome_fantasia: string | null;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cep: string;
    atividade_principal: ICnpjwsAtividade;
    atividades_secundarias: ICnpjwsAtividade[];
    cidade?: {
        id: number;
        nome: string;
        ibge_id: number;
        siafi_id: string;
    };
    estado?: {
        id: number;
        nome: string;
        sigla: string;
        ibge_id: number;
    };
    situacao_cadastral: string;
    email: string;
    telefone1: string;
    ddd1: string;
    atualizado_em: string;
}

export interface ICnpjwsResponse {
    cnpj_raiz: string;
    razao_social: string;
    capital_social: string;
    porte: {
        id: string;
        descricao: string;
    };
    natureza_juridica: {
        id: string;
        descricao: string;
    };
    estabelecimento: ICnpjwsEstabelecimento;
}

export interface ISellerData {
    razaoSocial: string;
    endereco: {
        logradouro: string;
        numero: string;
        complemento: string;
        bairro: string;
        municipio: string;
        uf: string;
        cep: string;
    };
}
