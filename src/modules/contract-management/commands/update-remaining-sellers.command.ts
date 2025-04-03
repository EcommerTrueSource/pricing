import { Command, CommandRunner } from 'nest-commander';
import { SellerService } from '../seller/services/seller.service';

@Command({
    name: 'update-remaining-sellers',
    description: 'Atualiza apenas os sellers que ainda não foram atualizados pela Brasil API',
})
export class UpdateRemainingSellersCommand extends CommandRunner {
    constructor(private readonly sellerService: SellerService) {
        super();
    }

    async run(): Promise<void> {
        const result = await this.sellerService.updateRemainingSellersFromBrasilApi();
        console.log('Resultado da atualização:', result);
    }
}
