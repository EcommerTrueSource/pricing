import { Command, CommandRunner } from 'nest-commander';
import { SellerService } from '../seller/services/seller.service';
import { Logger } from '@nestjs/common';

@Command({
    name: 'update-sellers-cnpjws',
    description: 'Atualiza os dados dos vendedores utilizando a nova API CNPJWS',
})
export class UpdateSellersCnpjwsCommand extends CommandRunner {
    private readonly logger = new Logger(UpdateSellersCnpjwsCommand.name);

    constructor(private readonly sellerService: SellerService) {
        super();
    }

    async run(): Promise<void> {
        this.logger.log('Iniciando atualização dos vendedores com a API CNPJWS');

        try {
            const result = await this.sellerService.updateAllSellersDataFromBrasilApi();
            this.logger.log('Resultado da atualização:', result);

            this.logger.log(`Total: ${result.total}`);
            this.logger.log(`Sucessos: ${result.success}`);
            this.logger.log(`Falhas: ${result.failed}`);

            if (result.errors.length > 0) {
                this.logger.warn(`Erros: ${result.errors.length}`);
                this.logger.debug('Detalhes dos erros:', result.errors);
            }
        } catch (error) {
            this.logger.error('Erro ao executar atualização:', error);
        }
    }
}
