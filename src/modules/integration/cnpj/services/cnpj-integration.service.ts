import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { CnpjwsService } from '../../cnpjws/services/cnpjws.service';
import { BrasilApiService } from '../../brasil-api/services/brasil-api.service';
import { ISellerData } from '../../cnpjws/interfaces/cnpjws.interface';

@Injectable()
export class CnpjIntegrationService {
    private readonly logger = new Logger(CnpjIntegrationService.name);

    constructor(
        private readonly cnpjwsService: CnpjwsService,
        private readonly brasilApiService: BrasilApiService,
    ) {
        this.logger.log('CnpjIntegrationService inicializado');
    }

    /**
     * Obtém dados de um CNPJ utilizando CNPJWS como principal e BrasilAPI como fallback
     * @param cnpj CNPJ a ser consultado
     * @returns Dados do vendedor
     */
    async getSellerData(cnpj: string): Promise<ISellerData> {
        try {
            this.logger.log(`🔵 TENTANDO CNPJWS: Consultando CNPJ ${cnpj} na API principal`);
            const result = await this.cnpjwsService.getSellerData(cnpj);
            this.logger.log(`✅ SUCESSO CNPJWS: Dados obtidos com sucesso para CNPJ ${cnpj}`);
            return result;
        } catch (error) {
            this.logger.warn(
                `❌ FALHA CNPJWS: Erro na API principal para CNPJ ${cnpj}: ${
                    error instanceof Error ? error.message : 'Erro desconhecido'
                }. Tentando fallback.`,
            );

            try {
                this.logger.log(`🟠 TENTANDO BRASIL API: Consultando CNPJ ${cnpj} em fallback`);
                const result = await this.brasilApiService.getSellerData(cnpj);
                this.logger.log(`✅ SUCESSO BRASIL API: Fallback obteve dados para CNPJ ${cnpj}`);
                return result;
            } catch (fallbackError) {
                this.logger.error(
                    `❌ FALHA COMPLETA: Erro também no fallback da BrasilAPI para CNPJ ${cnpj}: ${
                        fallbackError instanceof Error ? fallbackError.message : 'Erro desconhecido'
                    }`,
                );
                throw new HttpException(
                    `Não foi possível obter dados do CNPJ ${cnpj} em nenhuma das APIs disponíveis`,
                    HttpStatus.NOT_FOUND,
                );
            }
        }
    }
}
