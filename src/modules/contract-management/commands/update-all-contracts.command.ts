import { Command, CommandRunner } from 'nest-commander';
import { PrismaService } from '../../../shared/services/prisma.service';
import { ContractService } from '../contract/services/contract.service';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';

interface ProcessResult {
    total: number;
    processed: number;
    success: number;
    failed: number;
    lastProcessedCnpj: string | null;
    contractsDeleted: number;
    contractsWithMultipleVersions: number;
    failedDeletions: number;
    errors: Array<{
        cnpj: string;
        razaoSocial: string;
        error: string;
    }>;
    summary: {
        totalSellers: number;
        sellersWithMultipleContracts: number;
        contractsDeleted: number;
        contractsKept: number;
        failedDeletions: number;
        startTime: Date;
        endTime: Date | null;
        duration: string | null;
    };
}

@Command({
    name: 'update-all-contracts',
    description: 'Atualiza todos os contratos com dados da Autentique e remove duplicados',
})
export class UpdateAllContractsCommand extends CommandRunner {
    private readonly logger = new Logger(UpdateAllContractsCommand.name);
    private readonly BATCH_SIZE = 60; // Limite da API
    private readonly BATCH_DELAY = 30000; // 30 segundos em ms
    private readonly SELLER_DELAY = 1500; // 1.5 segundos entre sellers
    private readonly CHECKPOINT_FILE = 'contract-update-checkpoint.json';
    private readonly SUMMARY_FILE = 'contract-update-summary.json';

    constructor(
        private readonly prisma: PrismaService,
        private readonly contractService: ContractService,
    ) {
        super();
    }

    private loadCheckpoint(): ProcessResult | null {
        try {
            if (fs.existsSync(this.CHECKPOINT_FILE)) {
                const data = fs.readFileSync(this.CHECKPOINT_FILE, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            this.logger.warn('Erro ao carregar checkpoint:', error);
        }
        return null;
    }

    private saveCheckpoint(result: ProcessResult): void {
        try {
            fs.writeFileSync(this.CHECKPOINT_FILE, JSON.stringify(result, null, 2));
        } catch (error) {
            this.logger.error('Erro ao salvar checkpoint:', error);
        }
    }

    private deleteCheckpoint(): void {
        try {
            if (fs.existsSync(this.CHECKPOINT_FILE)) {
                fs.unlinkSync(this.CHECKPOINT_FILE);
            }
        } catch (error) {
            this.logger.error('Erro ao deletar checkpoint:', error);
        }
    }

    private saveSummary(result: ProcessResult): void {
        try {
            result.summary.endTime = new Date();
            result.summary.duration = this.calculateDuration(
                result.summary.startTime,
                result.summary.endTime,
            );
            fs.writeFileSync(this.SUMMARY_FILE, JSON.stringify(result.summary, null, 2));
        } catch (error) {
            this.logger.error('Erro ao salvar resumo:', error);
        }
    }

    private calculateDuration(start: Date, end: Date): string {
        const diff = end.getTime() - start.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    async run(): Promise<void> {
        // Tenta carregar checkpoint existente
        const result = this.loadCheckpoint() || {
            total: 0,
            processed: 0,
            success: 0,
            failed: 0,
            lastProcessedCnpj: null,
            contractsDeleted: 0,
            contractsWithMultipleVersions: 0,
            failedDeletions: 0,
            errors: [],
            summary: {
                totalSellers: 0,
                sellersWithMultipleContracts: 0,
                contractsDeleted: 0,
                contractsKept: 0,
                failedDeletions: 0,
                startTime: new Date(),
                endTime: null,
                duration: null,
            },
        };

        try {
            this.logger.log('Iniciando atualização e limpeza de contratos com a Autentique...');
            this.logger.log('Este processo irá:');
            this.logger.log('1. Consultar todos os sellers');
            this.logger.log('2. Identificar contratos duplicados');
            this.logger.log('3. Manter contratos assinados ou mais antigos');
            this.logger.log('4. Remover contratos duplicados não assinados');
            this.logger.log('5. Gerar relatório detalhado');

            // Busca todos os sellers cadastrados que possuem contratos
            let sellers = await this.prisma.sellers.findMany({
                select: {
                    id: true,
                    cnpj: true,
                    razao_social: true,
                },
                where: {
                    contracts: {
                        some: {}, // Garante que o seller tenha pelo menos um contrato
                    },
                },
                orderBy: {
                    cnpj: 'asc',
                },
            });

            // Se tem checkpoint, filtra sellers já processados
            if (result.lastProcessedCnpj) {
                this.logger.log(
                    `Retomando processamento a partir do CNPJ ${result.lastProcessedCnpj}`,
                );
                sellers = sellers.filter((s) => s.cnpj > result.lastProcessedCnpj!);
            }

            result.total = sellers.length;
            result.summary.totalSellers = sellers.length;
            const tempoEstimado =
                Math.ceil(sellers.length / this.BATCH_SIZE) * (this.BATCH_DELAY / 60000);

            this.logger.log(`Total de sellers com contratos para processar: ${sellers.length}`);
            this.logger.log(`Tempo estimado: ${tempoEstimado} minutos`);

            // Processa os sellers em lotes
            for (let i = 0; i < sellers.length; i += this.BATCH_SIZE) {
                const batch = sellers.slice(i, i + this.BATCH_SIZE);
                const loteAtual = Math.floor(i / this.BATCH_SIZE) + 1;
                const totalLotes = Math.ceil(sellers.length / this.BATCH_SIZE);
                const percentualConcluido = (((i + 1) / sellers.length) * 100).toFixed(2);

                this.logger.log(
                    `\n=== Processando Lote ${loteAtual}/${totalLotes} (${percentualConcluido}% concluído) ===`,
                );

                let loteSucessos = 0;
                let loteFalhas = 0;
                let loteContratosDeletados = 0;
                let loteContratosMultiplos = 0;
                let loteFalhasDelecao = 0;

                // Processa cada seller do lote
                for (const seller of batch) {
                    try {
                        result.processed++;
                        this.logger.log(
                            `\nProcessando seller ${seller.cnpj} (${seller.razao_social})...`,
                        );

                        const processResult = await this.contractService.updateContractByCnpj(
                            seller.cnpj,
                        );

                        if (processResult.contractsDeleted) {
                            loteContratosDeletados += processResult.contractsDeleted;
                            result.contractsDeleted += processResult.contractsDeleted;
                        }

                        if (processResult.failedDeletions) {
                            loteFalhasDelecao += processResult.failedDeletions;
                            result.failedDeletions += processResult.failedDeletions;
                        }

                        if (processResult.hasMultipleContracts) {
                            loteContratosMultiplos++;
                            result.contractsWithMultipleVersions++;
                        }

                        result.success++;
                        loteSucessos++;
                        result.lastProcessedCnpj = seller.cnpj;
                        this.logger.log(
                            `✓ Contrato processado com sucesso para o seller ${seller.cnpj}`,
                        );
                    } catch (error) {
                        result.failed++;
                        loteFalhas++;
                        result.errors.push({
                            cnpj: seller.cnpj,
                            razaoSocial: seller.razao_social,
                            error: error instanceof Error ? error.message : 'Erro desconhecido',
                        });
                        this.logger.error(`✗ Erro ao processar seller ${seller.cnpj}:`, error);
                    }

                    // Aguarda 1.5 segundos entre sellers
                    if (
                        i + this.BATCH_SIZE < sellers.length ||
                        seller !== batch[batch.length - 1]
                    ) {
                        await new Promise((resolve) => setTimeout(resolve, this.SELLER_DELAY));
                    }

                    // Salva checkpoint após cada seller
                    this.saveCheckpoint(result);
                }

                // Exibe resumo do lote
                this.logger.log('\n=== Resumo do Lote ===');
                this.logger.log(`Sucessos: ${loteSucessos}`);
                this.logger.log(`Falhas: ${loteFalhas}`);
                this.logger.log(`Contratos Deletados: ${loteContratosDeletados}`);
                this.logger.log(`Falhas na Deleção: ${loteFalhasDelecao}`);
                this.logger.log(`Sellers com Múltiplos Contratos: ${loteContratosMultiplos}`);

                // Aguarda antes do próximo lote
                if (i + this.BATCH_SIZE < sellers.length) {
                    const tempoRestante =
                        Math.ceil((sellers.length - (i + this.BATCH_SIZE)) / this.BATCH_SIZE) *
                        (this.BATCH_DELAY / 60000);
                    this.logger.log(
                        `\nAguardando ${this.BATCH_DELAY / 1000} segundos antes do próximo lote... Tempo restante estimado: ${tempoRestante} minutos`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, this.BATCH_DELAY));
                }
            }

            // Atualiza e salva o resumo final
            result.summary.contractsDeleted = result.contractsDeleted;
            result.summary.sellersWithMultipleContracts = result.contractsWithMultipleVersions;
            result.summary.contractsKept = result.success;
            result.summary.failedDeletions = result.failedDeletions;
            this.saveSummary(result);

            // Exibe o relatório final
            this.logger.log('\n=== Relatório Final ===');
            this.logger.log('Atualização de contratos concluída');
            this.logger.log('Estatísticas:', {
                total: result.total,
                processed: result.processed,
                success: result.success,
                failed: result.failed,
                contractsDeleted: result.contractsDeleted,
                failedDeletions: result.failedDeletions,
                sellersWithMultipleContracts: result.contractsWithMultipleVersions,
                duration: result.summary.duration,
            });

            if (result.errors.length > 0) {
                this.logger.warn('\nErros encontrados durante o processo:');
                result.errors.forEach((error) => {
                    this.logger.warn(
                        `- CNPJ: ${error.cnpj}, Razão Social: ${error.razaoSocial}, Erro: ${error.error}`,
                    );
                });
            }

            this.logger.log(`\nResumo detalhado salvo em: ${this.SUMMARY_FILE}`);

            // Processo concluído com sucesso, remove o checkpoint
            this.deleteCheckpoint();
        } catch (error) {
            this.logger.error('Erro ao executar atualização de contratos:', error);
            // Mantém o checkpoint para posterior retomada
            this.saveCheckpoint(result);
            throw error;
        }
    }
}
