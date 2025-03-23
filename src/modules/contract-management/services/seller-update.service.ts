import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { BrasilApiService } from '../../integration/brasil-api/services/brasil-api.service';
import { sellers } from '@prisma/client';

@Injectable()
export class SellerUpdateService {
  private readonly logger = new Logger(SellerUpdateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brasilApiService: BrasilApiService,
  ) {}

  async updateSellerData(seller: sellers): Promise<sellers> {
    try {
      const sellerData = await this.brasilApiService.getSellerData(seller.cnpj);

      seller.razao_social = sellerData.razaoSocial;
      seller.endereco = `${sellerData.endereco.logradouro}, ${sellerData.endereco.numero} - ${sellerData.endereco.bairro}, ${sellerData.endereco.municipio} - ${sellerData.endereco.uf}, ${sellerData.endereco.cep}`;

      return await this.prisma.sellers.update({
        where: { id: seller.id },
        data: {
          razao_social: sellerData.razaoSocial,
          endereco: `${sellerData.endereco.logradouro}, ${sellerData.endereco.numero} - ${sellerData.endereco.bairro}, ${sellerData.endereco.municipio} - ${sellerData.endereco.uf}, ${sellerData.endereco.cep}`,
        },
      });
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar dados do seller ${seller.id}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      );
      throw error;
    }
  }

  async updateAllSellers(): Promise<void> {
    const sellers = await this.prisma.sellers.findMany();

    for (const seller of sellers) {
      try {
        await this.updateSellerData(seller);
        this.logger.log(`Seller ${seller.id} atualizado com sucesso`);
      } catch (error) {
        this.logger.error(
          `Erro ao atualizar seller ${seller.id}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        );
      }
    }
  }
}
