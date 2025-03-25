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
  errors: Array<{
    cnpj: string;
    razaoSocial: string;
    error: string;
  }>;
}

@Command({
  name: 'update-all-contracts',
  description: 'Atualiza todos os contratos com dados da Autentique',
})
export class UpdateAllContractsCommand extends CommandRunner {
  private readonly logger = new Logger(UpdateAllContractsCommand.name);
  private readonly BATCH_SIZE = 60; // Limite da API
  private readonly BATCH_DELAY = 60000; // 1 minuto em ms
  private readonly CHECKPOINT_FILE = 'contract-update-checkpoint.json';

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

  async run(): Promise<void> {
    // Tenta carregar checkpoint existente
    const result = this.loadCheckpoint() || {
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      lastProcessedCnpj: null,
      errors: [],
    };

    try {
      this.logger.log('Iniciando atualização de contratos com a Autentique...');

      // Busca todos os sellers cadastrados
      let sellers = await this.prisma.sellers.findMany({
        select: {
          id: true,
          cnpj: true,
          razao_social: true,
        },
        orderBy: {
          cnpj: 'asc',
        },
      });

      // Se tem checkpoint, filtra sellers já processados
      if (result.lastProcessedCnpj) {
        this.logger.log(`Retomando processamento a partir do CNPJ ${result.lastProcessedCnpj}`);
        sellers = sellers.filter((s) => s.cnpj > result.lastProcessedCnpj!);
      }

      result.total = sellers.length;
      const tempoEstimado =
        Math.ceil(sellers.length / this.BATCH_SIZE) * (this.BATCH_DELAY / 60000);

      this.logger.log(`Total de sellers para processar: ${sellers.length}`);
      this.logger.log(`Tempo estimado: ${tempoEstimado} minutos`);

      // Processa os sellers em lotes
      for (let i = 0; i < sellers.length; i += this.BATCH_SIZE) {
        const batch = sellers.slice(i, i + this.BATCH_SIZE);
        const loteAtual = Math.floor(i / this.BATCH_SIZE) + 1;
        const totalLotes = Math.ceil(sellers.length / this.BATCH_SIZE);
        const percentualConcluido = (((i + 1) / sellers.length) * 100).toFixed(2);

        this.logger.log(
          `Processando lote ${loteAtual}/${totalLotes} (${percentualConcluido}% concluído)`,
        );

        // Processa cada seller do lote
        for (const seller of batch) {
          try {
            result.processed++;
            this.logger.log(`Processando seller ${seller.cnpj} (${seller.razao_social})...`);

            await this.contractService.updateContractByCnpj(seller.cnpj);

            result.success++;
            result.lastProcessedCnpj = seller.cnpj;
            this.logger.log(`Contrato atualizado com sucesso para o seller ${seller.cnpj}`);
          } catch (error) {
            result.failed++;
            result.errors.push({
              cnpj: seller.cnpj,
              razaoSocial: seller.razao_social,
              error: error instanceof Error ? error.message : 'Erro desconhecido',
            });
            this.logger.error(`Erro ao processar seller ${seller.cnpj}:`, error);
          }

          // Salva checkpoint após cada seller
          this.saveCheckpoint(result);
        }

        // Aguarda antes do próximo lote
        if (i + this.BATCH_SIZE < sellers.length) {
          const tempoRestante =
            Math.ceil((sellers.length - (i + this.BATCH_SIZE)) / this.BATCH_SIZE) *
            (this.BATCH_DELAY / 60000);
          this.logger.log(
            `Aguardando ${this.BATCH_DELAY / 1000} segundos antes do próximo lote... Tempo restante estimado: ${tempoRestante} minutos`,
          );
          await new Promise((resolve) => setTimeout(resolve, this.BATCH_DELAY));
        }
      }

      // Exibe o relatório final
      this.logger.log('Atualização de contratos concluída');
      this.logger.log('Relatório final:', {
        total: result.total,
        processed: result.processed,
        success: result.success,
        failed: result.failed,
      });

      if (result.errors.length > 0) {
        this.logger.warn('Erros encontrados durante o processo:');
        result.errors.forEach((error) => {
          this.logger.warn(
            `- CNPJ: ${error.cnpj}, Razão Social: ${error.razaoSocial}, Erro: ${error.error}`,
          );
        });
      }

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
