/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { CreateSellerDto } from '../dtos/create-seller.dto';
import { UpdateSellerDto } from '../dtos/update-seller.dto';
import { CnpjIntegrationService } from '../../../integration/cnpj/services/cnpj-integration.service';
import { SellerResponseDto } from '../dtos/seller-response.dto';

@Injectable()
export class SellerService {
    private readonly logger = new Logger(SellerService.name);
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 5000; // 5 segundos

    constructor(
        private readonly prisma: PrismaService,
        private readonly cnpjIntegrationService: CnpjIntegrationService,
    ) {}

    async create(createSellerDto: CreateSellerDto): Promise<SellerResponseDto> {
        try {
            this.logger.log(`Iniciando criação de seller com CNPJ: ${createSellerDto.cnpj}`);

            const sellerData = await this.cnpjIntegrationService.getSellerData(createSellerDto.cnpj);
            this.logger.log(`Dados obtidos da API de CNPJ: ${JSON.stringify(sellerData)}`);

            const seller = await this.prisma.sellers.create({
                data: {
                    cnpj: createSellerDto.cnpj,
                    razao_social: sellerData.razaoSocial,
                    email: createSellerDto.email,
                    telefone: createSellerDto.telefone,
                    endereco: `${sellerData.endereco.logradouro}, ${sellerData.endereco.numero} - ${sellerData.endereco.bairro}, ${sellerData.endereco.municipio} - ${sellerData.endereco.uf}, ${sellerData.endereco.cep}`,
                },
            });

            this.logger.log(`Seller criado com sucesso: ${JSON.stringify(seller)}`);
            return this.mapToResponseDto(seller);
        } catch (error) {
            this.logger.error(
                `Erro ao criar seller: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            );
            this.logger.error(
                `Stack trace: ${error instanceof Error ? error.stack : 'Stack trace não disponível'}`,
            );
            throw new Error(
                `Erro ao criar seller: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            );
        }
    }

    async findAll(): Promise<SellerResponseDto[]> {
        const sellers = await this.prisma.sellers.findMany();
        return sellers.map((seller) => this.mapToResponseDto(seller));
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

    async updateFromBrasilApi(id: string, retryCount = 0): Promise<any> {
        try {
            this.logger.debug(
                `Tentando atualizar seller ${id} (tentativa ${retryCount + 1}/${this.MAX_RETRIES})`,
            );
            const seller = await this.findOne(id);
            const companyData = await this.cnpjIntegrationService.getSellerData(seller.cnpj);

            // Formata o endereço completo
            const enderecoCompleto = `${companyData.endereco.logradouro}, ${companyData.endereco.numero} - ${companyData.endereco.bairro}, ${companyData.endereco.municipio} - ${companyData.endereco.uf}, ${companyData.endereco.cep}`;

            // Atualiza todos os campos necessários
            const updatedSeller = await this.prisma.sellers.update({
                where: { id },
                data: {
                    razao_social: companyData.razaoSocial,
                    endereco: enderecoCompleto,
                    // Mantém os campos existentes que não vêm da API
                    email: seller.email,
                    telefone: seller.telefone,
                },
            });

            this.logger.debug(`Seller ${id} atualizado com sucesso`);
            this.logger.debug(
                `Dados antigos: razaoSocial=${seller.razaoSocial}, endereco=${seller.endereco}`,
            );
            this.logger.debug(
                `Dados novos: razaoSocial=${updatedSeller.razao_social}, endereco=${updatedSeller.endereco}`,
            );
            return updatedSeller;
        } catch (error) {
            this.logger.error(
                `Erro ao atualizar seller ${id}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
            );

            // Se for um erro temporário e ainda não atingiu o limite de tentativas
            if (this.isTemporaryError(error) && retryCount < this.MAX_RETRIES) {
                this.logger.warn(
                    `Aguardando ${this.RETRY_DELAY / 1000} segundos antes de tentar novamente...`,
                );
                await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY));
                return this.updateFromBrasilApi(id, retryCount + 1);
            }

            throw error;
        }
    }

    private isTemporaryError(error: any): boolean {
        // Erros que podem ser temporários
        return (
            error.message?.includes('rate limit') ||
            error.message?.includes('timeout') ||
            error.message?.includes('network') ||
            error.message?.includes('ECONNRESET') ||
            error.message?.includes('ETIMEDOUT')
        );
    }

    async updateAllSellersDataFromBrasilApi(): Promise<{
        total: number;
        success: number;
        failed: number;
        errors: Array<{ cnpj: string; error: string }>;
    }> {
        this.logger.log('Iniciando atualização em massa dos sellers');
        const sellers = await this.prisma.sellers.findMany();
        this.logger.log(`Total de sellers encontrados: ${sellers.length}`);

        const result: {
            total: number;
            success: number;
            failed: number;
            errors: Array<{ cnpj: string; error: string }>;
        } = {
            total: sellers.length,
            success: 0,
            failed: 0,
            errors: [],
        };

        // Processa em lotes de 60
        const BATCH_SIZE = 60;
        const BATCH_DELAY = 5000; // 5 segundos entre lotes
        const ITEM_DELAY = 1000; // 1 segundo entre itens

        for (let i = 0; i < sellers.length; i += BATCH_SIZE) {
            const batch = sellers.slice(i, i + BATCH_SIZE);
            this.logger.log(
                `Processando lote ${Math.floor(i / BATCH_SIZE) + 1} de ${Math.ceil(sellers.length / BATCH_SIZE)}`,
            );

            for (const seller of batch) {
                try {
                    await this.updateFromBrasilApi(seller.id);
                    result.success++;
                    this.logger.log(
                        `Seller ${seller.id} (CNPJ: ${seller.cnpj}) atualizado com sucesso`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, ITEM_DELAY));
                } catch (error) {
                    result.failed++;
                    const errorMessage =
                        error instanceof Error ? error.message : 'Erro desconhecido';
                    result.errors.push({
                        cnpj: seller.cnpj,
                        error: errorMessage,
                    });
                    this.logger.error(
                        `Erro ao atualizar seller ${seller.id} (CNPJ: ${seller.cnpj}): ${errorMessage}`,
                    );
                }
            }

            // Aguarda 5 segundos entre os lotes
            if (i + BATCH_SIZE < sellers.length) {
                this.logger.log(
                    `Aguardando ${BATCH_DELAY / 1000} segundos antes do próximo lote...`,
                );
                await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
            }
        }

        this.logger.log('Atualização em massa concluída', result);
        return result;
    }

    private isValidCNPJ(cnpj: string): boolean {
        // Remove caracteres não numéricos
        cnpj = cnpj.replace(/[^\d]/g, '');

        // Verifica se tem 14 dígitos
        if (cnpj.length !== 14) return false;

        // Verifica se todos os dígitos são iguais
        if (/^(\d)\1+$/.test(cnpj)) return false;

        // Validação do primeiro dígito verificador
        let soma = 0;
        let peso = 5;
        for (let i = 0; i < 12; i++) {
            soma += parseInt(cnpj.charAt(i)) * peso;
            peso = peso === 2 ? 9 : peso - 1;
        }
        let digito = 11 - (soma % 11);
        if (digito > 9) digito = 0;
        if (parseInt(cnpj.charAt(12)) !== digito) return false;

        // Validação do segundo dígito verificador
        soma = 0;
        peso = 6;
        for (let i = 0; i < 13; i++) {
            soma += parseInt(cnpj.charAt(i)) * peso;
            peso = peso === 2 ? 9 : peso - 1;
        }
        digito = 11 - (soma % 11);
        if (digito > 9) digito = 0;
        if (parseInt(cnpj.charAt(13)) !== digito) return false;

        return true;
    }

    async updateRemainingSellersFromBrasilApi(): Promise<{
        total: number;
        remaining: number;
        success: number;
        failed: number;
        errors: Array<{
            cnpj: string;
            error: string;
            type: 'invalid_cnpj' | 'not_found' | 'validation_error' | 'other';
        }>;
    }> {
        this.logger.log('Iniciando atualização dos sellers com endereço pendente');

        // Busca apenas os sellers com endereço pendente
        const sellers = await this.prisma.sellers.findMany({
            where: {
                endereco: 'Endereço pendente',
            },
        });

        this.logger.log(`Total de sellers com endereço pendente: ${sellers.length}`);
        if (sellers.length > 0) {
            this.logger.log('Exemplos de sellers que serão atualizados:');
            sellers.slice(0, 3).forEach((seller) => {
                this.logger.log(
                    `- CNPJ: ${seller.cnpj}, Razão Social: ${seller.razao_social}, Endereço: ${seller.endereco}`,
                );
            });
        }

        const result: {
            total: number;
            remaining: number;
            success: number;
            failed: number;
            errors: Array<{
                cnpj: string;
                error: string;
                type: 'invalid_cnpj' | 'not_found' | 'validation_error' | 'other';
            }>;
        } = {
            total: sellers.length,
            remaining: sellers.length,
            success: 0,
            failed: 0,
            errors: [],
        };

        if (sellers.length === 0) {
            this.logger.log('Nenhum seller com endereço pendente encontrado');
            return result;
        }

        // Processa em lotes de 100
        const BATCH_SIZE = 100;
        const BATCH_DELAY = 5000; // 5 segundos entre lotes
        const ITEM_DELAY = 1000; // 1 segundo entre itens

        for (let i = 0; i < sellers.length; i += BATCH_SIZE) {
            const batch = sellers.slice(i, i + BATCH_SIZE);
            this.logger.log(
                `Processando lote ${Math.floor(i / BATCH_SIZE) + 1} de ${Math.ceil(sellers.length / BATCH_SIZE)}`,
            );
            this.logger.log(
                `Progresso: ${i + 1} a ${Math.min(i + BATCH_SIZE, sellers.length)} de ${sellers.length}`,
            );

            for (const seller of batch) {
                try {
                    // Validação do CNPJ
                    if (!this.isValidCNPJ(seller.cnpj)) {
                        throw new Error('CNPJ inválido');
                    }

                    await this.updateFromBrasilApi(seller.id);
                    result.success++;
                    this.logger.log(
                        `Seller ${seller.id} (CNPJ: ${seller.cnpj}) atualizado com sucesso`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, ITEM_DELAY));
                } catch (error) {
                    result.failed++;
                    const errorMessage =
                        error instanceof Error ? error.message : 'Erro desconhecido';
                    let errorType: 'invalid_cnpj' | 'not_found' | 'validation_error' | 'other' =
                        'other';

                    if (errorMessage.includes('CNPJ inválido')) {
                        errorType = 'invalid_cnpj';
                    } else if (errorMessage.includes('404')) {
                        errorType = 'not_found';
                    } else if (errorMessage.includes('400')) {
                        errorType = 'validation_error';
                    }

                    result.errors.push({
                        cnpj: seller.cnpj,
                        error: errorMessage,
                        type: errorType,
                    });
                    this.logger.error(
                        `Erro ao atualizar seller ${seller.id} (CNPJ: ${seller.cnpj}): ${errorMessage}`,
                    );
                }
            }

            // Aguarda 5 segundos entre os lotes
            if (i + BATCH_SIZE < sellers.length) {
                this.logger.log(
                    `Aguardando ${BATCH_DELAY / 1000} segundos antes do próximo lote...`,
                );
                await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
            }
        }

        // Resumo final
        this.logger.log('=== Resumo da Atualização ===');
        this.logger.log(`Total de sellers processados: ${result.total}`);
        this.logger.log(`Sucessos: ${result.success}`);
        this.logger.log(`Falhas: ${result.failed}`);

        if (result.errors.length > 0) {
            this.logger.log('Erros encontrados por tipo:');
            const errorsByType = result.errors.reduce(
                (acc, error) => {
                    acc[error.type] = (acc[error.type] || 0) + 1;
                    return acc;
                },
                {} as Record<string, number>,
            );

            Object.entries(errorsByType).forEach(([type, count]) => {
                this.logger.log(`- ${type}: ${count} erros`);
            });

            this.logger.log('\nDetalhes dos erros:');
            result.errors.forEach((error) => {
                this.logger.log(`- CNPJ: ${error.cnpj}, Tipo: ${error.type}, Erro: ${error.error}`);
            });
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
