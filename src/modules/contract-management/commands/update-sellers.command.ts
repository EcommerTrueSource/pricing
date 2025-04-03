import { Command, CommandRunner } from 'nest-commander';
import { SellerService } from '../seller/services/seller.service';

@Command({
    name: 'update-sellers',
    description: 'Atualiza apenas os sellers com endereço pendente usando a Brasil API',
})
export class UpdateSellersCommand extends CommandRunner {
    constructor(private readonly sellerService: SellerService) {
        super();
    }

    async run(): Promise<void> {
        const result = await this.sellerService.updateRemainingSellersFromBrasilApi();
        console.log('Resultado da atualização:', result);
    }
}
