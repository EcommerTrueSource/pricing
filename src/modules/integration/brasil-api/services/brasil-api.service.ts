import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { IBrasilApiResponse, ISellerData } from '../interfaces/brasil-api.interface';

@Injectable()
export class BrasilApiService {
  private readonly logger = new Logger(BrasilApiService.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiUrl = this.configService.get<string>('BRASIL_API_URL');
    if (!apiUrl) {
      throw new Error('BRASIL_API_URL não configurada');
    }
    this.baseUrl = apiUrl;
  }

  private formatCnpj(cnpj: string): string {
    return cnpj.replace(/[^\d]/g, '');
  }

  private mapResponseToSellerData(response: IBrasilApiResponse): ISellerData {
    return {
      razaoSocial: response.razao_social,
      endereco: {
        logradouro: response.logradouro,
        numero: response.numero,
        complemento: response.complemento,
        bairro: response.bairro,
        municipio: response.municipio,
        uf: response.uf,
        cep: response.cep,
      },
    };
  }

  async getSellerData(cnpj: string): Promise<ISellerData> {
    try {
      const formattedCnpj = this.formatCnpj(cnpj);
      const response = await axios.get<IBrasilApiResponse>(
        `${this.baseUrl}/cnpj/v1/${formattedCnpj}`,
      );

      if (!response.data) {
        throw new HttpException('CNPJ não encontrado na Brasil API', HttpStatus.NOT_FOUND);
      }

      return this.mapResponseToSellerData(response.data);
    } catch (error) {
      if (error instanceof AxiosError) {
        this.logger.error(`Erro ao buscar dados do CNPJ ${cnpj}: ${error.message}`);
        throw new HttpException(
          'Erro ao buscar dados na Brasil API',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw error;
    }
  }
}
