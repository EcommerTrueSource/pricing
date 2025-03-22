/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { CreateSellerDto } from '../dtos/create-seller.dto';
import { UpdateSellerDto } from '../dtos/update-seller.dto';
import { BrasilApiService } from '../../../integration/brasil-api/services/brasil-api.service';
import { SellerResponseDto } from '../dtos/seller-response.dto';

@Injectable()
export class SellerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly brasilApiService: BrasilApiService,
  ) {}

  async create(createSellerDto: CreateSellerDto): Promise<SellerResponseDto> {
    const seller = await this.prisma.sellers.create({
      data: {
        cnpj: createSellerDto.cnpj,
        razao_social: createSellerDto.razaoSocial,
        email: createSellerDto.email,
        telefone: createSellerDto.telefone,
        endereco: createSellerDto.endereco,
      },
    });
    return this.mapToResponseDto(seller);
  }

  async findAll(): Promise<SellerResponseDto[]> {
    const sellers = await this.prisma.sellers.findMany();
    return sellers.map(seller => this.mapToResponseDto(seller));
  }

  async findOne(id: string): Promise<SellerResponseDto> {
    const seller = await this.prisma.sellers.findUnique({
      where: { id },
    });
    if (!seller) {
      throw new NotFoundException(`Vendedor com ID ${id} não encontrado`);
    }
    return this.mapToResponseDto(seller);
  }

  async update(id: string, updateSellerDto: UpdateSellerDto): Promise<SellerResponseDto> {
    const seller = await this.prisma.sellers.update({
      where: { id },
      data: updateSellerDto,
    });
    return this.mapToResponseDto(seller);
  }

  async remove(id: string) {
    try {
      return await this.prisma.sellers.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Vendedor com ID ${id} não encontrado`);
    }
  }

  async updateFromBrasilApi(id: string) {
    try {
      const seller = await this.findOne(id);
      const companyData = await this.brasilApiService.getSellerData(seller.cnpj);

      return this.prisma.sellers.update({
        where: { id },
        data: {
          razao_social: companyData.razaoSocial,
          endereco: companyData.endereco,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Erro ao atualizar dados do vendedor: ${error.message}`);
      }
      throw new Error('Erro desconhecido ao atualizar dados do vendedor');
    }
  }

  async updateAllSellersDataFromBrasilApi(): Promise<{
    success: number;
    failed: number;
    errors: Array<{ cnpj: string; error: string }>;
    processed: number;
    total: number;
  }> {
    const sellers = await this.findAll();
    const batchSize = 5; // Reduzido para 5 por lote para ser mais conservador
    const result: {
      success: number;
      failed: number;
      errors: Array<{ cnpj: string; error: string }>;
      processed: number;
      total: number;
    } = {
      success: 0,
      failed: 0,
      errors: [],
      processed: 0,
      total: sellers.length,
    };

    console.log(`Iniciando atualização de ${sellers.length} vendedores...`);

    for (let i = 0; i < sellers.length; i += batchSize) {
      const batch = sellers.slice(i, i + batchSize);

      for (const seller of batch) {
        try {
          await this.updateFromBrasilApi(seller.id);
          result.success++;
          console.log(`[${result.processed + 1}/${sellers.length}] Atualizado: ${seller.cnpj}`);
        } catch (error) {
          result.failed++;
          result.errors.push({
            cnpj: seller.cnpj,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
          });
          console.error(
            `[${result.processed + 1}/${sellers.length}] Erro ao atualizar ${seller.cnpj}:`,
            error,
          );
        }
      }

      result.processed += batch.length;

      // Espera 3 segundos entre os lotes para ser mais conservador
      if (i + batchSize < sellers.length) {
        console.log(
          `Processados ${result.processed}/${sellers.length} vendedores. Aguardando 3 segundos...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    console.log('Processo finalizado!');
    console.log(`Total: ${result.total}`);
    console.log(`Sucesso: ${result.success}`);
    console.log(`Falhas: ${result.failed}`);
    if (result.failed > 0) {
      console.log('Erros encontrados:', result.errors);
    }

    return result;
  }

  private mapToResponseDto(seller: any): SellerResponseDto {
    return {
      id: seller.id,
      cnpj: seller.cnpj,
      email: seller.email,
      telefone: seller.telefone,
      endereco: seller.endereco,
      razaoSocial: seller.razao_social,
      createdAt: seller.created_at,
      updatedAt: seller.updated_at,
    };
  }
}
