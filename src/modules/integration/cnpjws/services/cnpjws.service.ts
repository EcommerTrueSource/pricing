import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { ICnpjwsResponse, ISellerData } from '../interfaces/cnpjws.interface';
import { RateLimiterMemory } from 'rate-limiter-flexible';

@Injectable()
export class CnpjwsService {
    private readonly logger = new Logger(CnpjwsService.name);
    private readonly baseUrl: string;
    private readonly apiToken: string;
    private readonly rateLimiter: RateLimiterMemory;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) {
        this.baseUrl = this.configService.get<string>(
            'CNPJWS_API_URL',
            'https://comercial.cnpj.ws/cnpj',
        );
        this.apiToken = this.configService.get<string>('CNPJWS_API_TOKEN');

        if (!this.apiToken) {
            this.logger.warn(
                'CNPJWS_API_TOKEN não configurado, o serviço não funcionará corretamente',
            );
        }

        this.logger.log(`CnpjwsService inicializado com baseUrl: ${this.baseUrl}`);

        // Configurando o rate limiter - 10 requisições por minuto
        this.rateLimiter = new RateLimiterMemory({
            points: 10,
            duration: 60,
        });
    }

    private formatCnpj(cnpj: string): string {
        const cleaned = cnpj.replace(/[^\d]/g, '');
        this.logger.debug(`CNPJ formatado: ${cleaned}`);
        return cleaned;
    }

    private async waitForRateLimit(): Promise<void> {
        try {
            await this.rateLimiter.consume('cnpjws_api', 1);
        } catch (error) {
            const timeToWait = Math.floor(error.msBeforeNext / 1000) || 1;
            this.logger.warn(`Rate limit atingido, aguardando ${timeToWait} segundos`);
            await new Promise((resolve) => setTimeout(resolve, error.msBeforeNext || 1000));
            await this.waitForRateLimit();
        }
    }

    private mapResponseToSellerData(response: ICnpjwsResponse): ISellerData {
        const estabelecimento = response.estabelecimento;
        const estado = estabelecimento.estado;

        return {
            razaoSocial: response.razao_social,
            endereco: {
                logradouro: estabelecimento.logradouro,
                numero: estabelecimento.numero,
                complemento: estabelecimento.complemento,
                bairro: estabelecimento.bairro,
                municipio: estabelecimento.cidade?.nome || '',
                uf: estado?.sigla || '',
                cep: estabelecimento.cep,
            },
        };
    }

    async getSellerData(cnpj: string): Promise<ISellerData> {
        try {
            this.logger.debug(`📣 CNPJWS: Iniciando busca de dados para CNPJ: ${cnpj}`);
            const formattedCnpj = this.formatCnpj(cnpj);
            this.logger.debug(`📣 CNPJWS: CNPJ formatado: ${formattedCnpj}`);

            // Verificar se o token está configurado
            if (!this.apiToken) {
                this.logger.error(
                    `❌ CNPJWS: API Token não configurado! Verifique a variável de ambiente CNPJWS_API_TOKEN`,
                );
                throw new Error('Token CNPJWS não configurado');
            }

            // Respeitar rate limiting
            await this.waitForRateLimit();

            const url = `${this.baseUrl}/${formattedCnpj}`;
            const headers = {
                x_api_token: this.apiToken,
            };

            this.logger.debug(`📣 CNPJWS: Enviando requisição para: ${url}`);
            this.logger.debug(`📣 CNPJWS: Usando token: ${this.apiToken.substring(0, 5)}...`);

            const response = await firstValueFrom(
                this.httpService.get<ICnpjwsResponse[]>(url, { headers }).pipe(
                    map((response) => {
                        this.logger.debug('📣 CNPJWS: Resposta recebida da API:', response.status);

                        if (response.status !== 200) {
                            this.logger.warn(`⚠️ CNPJWS: Status inesperado: ${response.status}`);
                        }

                        // A API retorna um array, pegamos o primeiro item
                        if (Array.isArray(response.data) && response.data.length > 0) {
                            this.logger.debug(
                                `📣 CNPJWS: Resposta é um array com ${response.data.length} item(s)`,
                            );
                            return response.data[0];
                        }

                        // Se não for um array ou for vazio, retorna o próprio dado
                        this.logger.debug(`📣 CNPJWS: Resposta não é um array ou está vazia`);
                        return response.data;
                    }),
                ),
            );

            // Garantir que response seja um objeto ICnpjwsResponse
            const cnpjData = Array.isArray(response) ? response[0] : (response as ICnpjwsResponse);

            if (!cnpjData || !cnpjData.razao_social) {
                this.logger.error('CNPJ não encontrado na API CNPJWS');
                throw new HttpException('CNPJ não encontrado na API CNPJWS', HttpStatus.NOT_FOUND);
            }

            const mappedData = this.mapResponseToSellerData(cnpjData);
            this.logger.debug('Dados mapeados:', mappedData);
            return mappedData;
        } catch (error) {
            this.logger.error('Erro detalhado na chamada à API CNPJWS:', {
                error: error instanceof Error ? error.message : 'Erro desconhecido',
                stack: error instanceof Error ? error.stack : undefined,
                response: error.response?.data,
                status: error.response?.status,
                url: `${this.baseUrl}/${this.formatCnpj(cnpj)}`,
            });
            throw new HttpException(
                `Erro ao buscar dados do CNPJ ${cnpj} na API CNPJWS: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
                error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
