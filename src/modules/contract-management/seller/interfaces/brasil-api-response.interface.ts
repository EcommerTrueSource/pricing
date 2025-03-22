/* eslint-disable prettier/prettier */
export interface IBrasilApiResponse {
  uf: string;
  cep: string;
  cnpj: string;
  bairro: string;
  numero: string;
  municipio: string;
  logradouro: string;
  complemento: string;
  razao_social: string;
  nome_fantasia: string;
  capital_social: number;
  natureza_juridica: string;
  situacao_cadastral: number;
  descricao_situacao_cadastral: string;
  data_inicio_atividade: string;
  data_situacao_cadastral: string;
  motivo_situacao_cadastral: number;
  descricao_motivo_situacao_cadastral: string;
  identificador_matriz_filial: number;
  descricao_identificador_matriz_filial: string;
}
