/* eslint-disable prettier/prettier */
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IBrasilApiResponse } from '../interfaces/brasil-api-response.interface';
import { AxiosError } from 'axios';

@Injectable()
export class BrasilApiService {
  private readonly baseUrl = 'https://brasilapi.com.br/api/cnpj/v1';
  private readonly maxRetries = 3;
  private readonly delayBetweenRequests = 1000; // 1 segundo
  private lastRequestTime = 0;

  constructor(private readonly httpService: HttpService) {}

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.delayBetweenRequests) {
      await this.delay(this.delayBetweenRequests - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }

  async getCompanyData(cnpj: string, retryCount = 0): Promise<IBrasilApiResponse> {
    try {
      await this.waitForRateLimit();

      const { data } = await firstValueFrom(
        this.httpService.get<IBrasilApiResponse>(`${this.baseUrl}/${cnpj}`),
      );

      if (!data || !data.cnpj) {
        throw new HttpException('Dados da empresa não encontrados', HttpStatus.NOT_FOUND);
      }

      return data;
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 404) {
          throw new HttpException('CNPJ não encontrado', HttpStatus.NOT_FOUND);
        }

        // Se for erro de rate limit (429) ou erro do servidor (5xx)
        if (
          error.response?.status === 429 ||
          (error.response?.status && error.response?.status >= 500 && error.response?.status < 600)
        ) {
          if (retryCount < this.maxRetries) {
            // Espera um tempo exponencial antes de tentar novamente
            await this.delay(Math.pow(2, retryCount) * 1000);
            return this.getCompanyData(cnpj, retryCount + 1);
          }
        }
      }

      throw new HttpException('Erro ao buscar dados da empresa', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  formatAddress(data: IBrasilApiResponse): string {
    const addressParts = [
      data.logradouro,
      data.numero,
      data.complemento,
      data.bairro,
      data.municipio,
      data.uf,
      data.cep,
    ].filter(Boolean);

    return addressParts.join(', ');
  }
}
