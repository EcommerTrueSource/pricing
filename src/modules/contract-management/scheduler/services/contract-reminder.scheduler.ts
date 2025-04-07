import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { EContractStatus } from '../../contract/enums/contract-status.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContractReminderEvent } from '../../events/contract.events';
import { SystemSettingsService } from '../../../../shared/services/system-settings.service';

@Injectable()
export class ContractReminderScheduler {
    private readonly logger = new Logger(ContractReminderScheduler.name);

    // Configuração: dias após a criação para envio das notificações
    private readonly DIAS_SEGUNDA_NOTIFICACAO = 3;
    private readonly DIAS_TERCEIRA_NOTIFICACAO = 7;
    // Configuração: máximo de notificações por contrato
    private readonly MAX_NOTIFICACOES = 3;

    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
        private readonly systemSettingsService: SystemSettingsService,
    ) {
        this.logger.log('Inicializado ContractReminderScheduler');
    }

    /**
     * Executa ao meio-dia em dias úteis (segunda a sexta) para verificar contratos pendentes
     * e enviar lembretes com base no tempo desde a criação do contrato
     */
    @Cron('0 12 * * 1-5', { name: 'checkPendingContracts' }) // Executa às 12h00 de segunda a sexta
    async checkPendingContractsForReminders() {
        const hoje = new Date();
        // Verifica se é um dia útil (1-5 = segunda a sexta)
        const diaDaSemana = hoje.getDay();
        if (diaDaSemana === 0 || diaDaSemana === 6) {
            this.logger.log('🗓️ Hoje é fim de semana. Notificações não serão enviadas.');
            return;
        }

        // Verifica se as notificações estão pausadas
        const isPaused = await this.systemSettingsService.areNotificationsPaused();
        if (isPaused) {
            const pauseDate = await this.systemSettingsService.getNotificationPauseDate();
            this.logger.log(
                `⏸️ Notificações estão pausadas até ${pauseDate.toISOString()}. Pulando verificação.`,
            );
            return;
        }

        this.logger.log('🔍 Verificando contratos pendentes para envio de lembretes...');

        try {
            // Encontra contratos pendentes de assinatura
            const pendingContracts = await this.prisma.contracts.findMany({
                where: {
                    status: EContractStatus.PENDING_SIGNATURE,
                },
                include: {
                    notifications: {
                        where: {
                            type: 'SIGNATURE_REMINDER',
                        },
                        orderBy: {
                            created_at: 'desc',
                        },
                    },
                    sellers: true,
                },
            });

            this.logger.log(
                `📄 Encontrados ${pendingContracts.length} contratos pendentes de assinatura`,
            );

            let remindersCreated = 0;

            for (const contract of pendingContracts) {
                try {
                    // Verifica quantas notificações o contrato já recebeu
                    const totalNotificacoes = contract.notifications.length;

                    // Se já atingiu o limite, pula
                    if (totalNotificacoes >= this.MAX_NOTIFICACOES) {
                        this.logger.debug(
                            `📊 Contrato ${contract.id} já recebeu ${totalNotificacoes} notificações. Limite atingido.`,
                        );
                        continue;
                    }

                    // Calcula dias desde a criação do contrato
                    const dataContrato = new Date(contract.created_at);
                    const diasDesdeACriacao = Math.floor(
                        (hoje.getTime() - dataContrato.getTime()) / (1000 * 60 * 60 * 24),
                    );

                    this.logger.debug(
                        `📊 Contrato ${contract.id}: ${diasDesdeACriacao} dias desde a criação, total de ${totalNotificacoes} notificações`,
                    );

                    // Lógica para decidir qual notificação enviar com base no tempo desde a criação e notificações já enviadas
                    let enviarNotificacao = false;
                    let numeroTentativa = 0;

                    // Se for a segunda notificação (após 3 dias) e o contrato só tem 1 notificação
                    if (
                        diasDesdeACriacao >= this.DIAS_SEGUNDA_NOTIFICACAO &&
                        totalNotificacoes === 1
                    ) {
                        enviarNotificacao = true;
                        numeroTentativa = 2;
                    }
                    // Se for a terceira notificação (após 7 dias) e o contrato tem 2 notificações
                    else if (
                        diasDesdeACriacao >= this.DIAS_TERCEIRA_NOTIFICACAO &&
                        totalNotificacoes === 2
                    ) {
                        enviarNotificacao = true;
                        numeroTentativa = 3;
                    }

                    if (enviarNotificacao) {
                        this.logger.log(
                            `📱 Enviando notificação #${numeroTentativa} de ${this.MAX_NOTIFICACOES} para contrato ${contract.id} (${contract.sellers.razao_social}) - ${diasDesdeACriacao} dias após criação`,
                        );

                        // Emite o evento de lembrete que será capturado pelo ContractEventHandler
                        const reminderEvent = new ContractReminderEvent(
                            contract.id,
                            contract.seller_id,
                            'PERIODIC_REMINDER',
                            new Date(),
                            numeroTentativa,
                            this.MAX_NOTIFICACOES,
                        );

                        this.eventEmitter.emit('contract.reminder', reminderEvent);
                        remindersCreated++;
                    }
                } catch (contractError) {
                    this.logger.error(
                        `❌ Erro ao processar lembrete para contrato ${contract.id}: ${contractError.message}`,
                        contractError.stack,
                    );
                    // Continuamos com o próximo contrato mesmo se houver erro em um
                }
            }

            this.logger.log(`✅ Processamento concluído: ${remindersCreated} lembretes criados`);
        } catch (error) {
            this.logger.error(
                `❌ Erro ao verificar contratos pendentes: ${error.message}`,
                error.stack,
            );
        }
    }

    /**
     * Método para forçar a execução do job manualmente (para testes)
     */
    async triggerContractReminders() {
        this.logger.log('🔄 Acionando verificação manual de lembretes de contratos');
        return this.checkPendingContractsForReminders();
    }

    /**
     * Método para verificar e enviar lembretes para um contrato específico
     * Útil para testes ou processamento manual de um contrato
     *
     * @param contractId ID do contrato a ser verificado
     */
    async checkSpecificContract(contractId: string): Promise<boolean> {
        this.logger.log(
            `🔍 Verificando contrato específico ${contractId} para envio de lembrete...`,
        );

        try {
            // Busca o contrato específico pelo ID
            const contract = await this.prisma.contracts.findUnique({
                where: {
                    id: contractId,
                    status: EContractStatus.PENDING_SIGNATURE,
                },
                include: {
                    notifications: {
                        where: {
                            type: 'SIGNATURE_REMINDER',
                        },
                        orderBy: {
                            created_at: 'desc',
                        },
                    },
                    sellers: true,
                },
            });

            // Se o contrato não existir ou não estiver pendente
            if (!contract) {
                this.logger.warn(
                    `⚠️ Contrato ${contractId} não encontrado ou não está pendente de assinatura`,
                );
                return false;
            }

            // Verifica quantas notificações o contrato já recebeu
            const totalNotificacoes = contract.notifications.length;

            // Se já atingiu o limite, retorna falso
            if (totalNotificacoes >= this.MAX_NOTIFICACOES) {
                this.logger.warn(
                    `⚠️ Contrato ${contractId} já atingiu o limite de ${this.MAX_NOTIFICACOES} notificações`,
                );
                return false;
            }

            // Para teste, vamos simular enviando a próxima notificação na sequência
            const proximoNumeroNotificacao = totalNotificacoes + 1;

            this.logger.log(
                `📱 Enviando notificação de teste #${proximoNumeroNotificacao} de ${this.MAX_NOTIFICACOES} para contrato ${contractId} (${contract.sellers.razao_social})`,
            );

            // Emite o evento de lembrete
            const reminderEvent = new ContractReminderEvent(
                contractId,
                contract.seller_id,
                'TEST_REMINDER',
                new Date(),
                proximoNumeroNotificacao,
                this.MAX_NOTIFICACOES,
            );

            this.logger.log(
                `📣 Emitindo evento contract.reminder para o contrato ${contractId} - tentativa ${proximoNumeroNotificacao}/${this.MAX_NOTIFICACOES}`,
            );
            this.eventEmitter.emit('contract.reminder', reminderEvent);

            // Verificação adicional após a emissão do evento
            this.logger.log('✅ Evento contract.reminder emitido com sucesso');

            return true;
        } catch (error) {
            this.logger.error(
                `❌ Erro ao verificar contrato específico ${contractId}: ${error.message}`,
                error.stack,
            );
            return false;
        }
    }
}
