import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class BrasilApiService {
  private readonly baseUrl = 'https://brasilapi.com.br/api/cnpj/v1';

  async getSellerData(cnpj: string) {
    const response = await axios.get(`${this.baseUrl}/${cnpj}`);
    return {
      razaoSocial: response.data.razao_social,
      endereco: response.data.logradouro,
    };
  }
}
