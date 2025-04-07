import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IBrasilApiResponse, ISellerData } from '../interfaces/brasil-api.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class BrasilApiService {
    private readonly logger = new Logger(BrasilApiService.name);
    private readonly baseUrl: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) {
        this.baseUrl = this.configService.get<string>('BRASIL_API_BASE_URL');
        if (!this.baseUrl) {
            throw new Error('BRASIL_API_BASE_URL não configurada');
        }
        this.logger.log(`BrasilApiService inicializado com baseUrl: ${this.baseUrl}`);
    }

    private formatCnpj(cnpj: string): string {
        const cleaned = cnpj.replace(/[^\d]/g, '');
        this.logger.debug(`CNPJ formatado: ${cleaned}`);
        return cleaned;
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
            this.logger.debug(`🟠 BRASIL-API: Iniciando busca de dados para CNPJ: ${cnpj}`);
            const formattedCnpj = this.formatCnpj(cnpj);
            this.logger.debug(`🟠 BRASIL-API: CNPJ formatado: ${formattedCnpj}`);

            const url = `${this.baseUrl}/cnpj/v1/${formattedCnpj}`;
            this.logger.debug(`🟠 BRASIL-API: URL da requisição: ${url}`);

            const response = await firstValueFrom(
                this.httpService.get(url).pipe(
                    map((response) => {
                        this.logger.debug(
                            `🟠 BRASIL-API: Resposta recebida com status: ${response.status}`,
                        );
                        return response.data;
                    }),
                ),
            );

            if (!response) {
                this.logger.error('🟠 BRASIL-API: CNPJ não encontrado na Brasil API');
                throw new HttpException('CNPJ não encontrado na Brasil API', HttpStatus.NOT_FOUND);
            }

            const mappedData = this.mapResponseToSellerData(response);
            this.logger.debug('🟠 BRASIL-API: Dados mapeados com sucesso');
            return mappedData;
        } catch (error) {
            this.logger.error('Erro detalhado na chamada à Brasil API:', {
                error: error instanceof Error ? error.message : 'Erro desconhecido',
                stack: error instanceof Error ? error.stack : undefined,
                response: error.response?.data,
                status: error.response?.status,
                url: `${this.baseUrl}/cnpj/v1/${this.formatCnpj(cnpj)}`,
            });
            throw new HttpException(
                `Erro ao buscar dados do CNPJ ${cnpj}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
