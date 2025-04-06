import { Injectable, Logger, Inject } from '@nestjs/common';
import {
    Processor,
    Process,
    OnQueueActive,
    OnQueueCompleted,
    OnQueueFailed,
    InjectQueue,
} from '@nestjs/bull';
import { Job, Queue } from 'bull';
import {
    INotificationProcessor,
    NotificationJobData,
} from '../interfaces/notification-processor.interface';
import { NotificationService } from '../services/notification.service';
import { IMessagingService } from '../interfaces/messaging-service.interface';
import { ENotificationStatus } from '../enums/notification-status.enum';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { contract_status } from '@prisma/client';

@Injectable()
@Processor('notifications')
export class NotificationProcessor implements INotificationProcessor {
    private readonly logger = new Logger(NotificationProcessor.name);
    private readonly MAX_ATTEMPTS = 5;

    constructor(
        private readonly notificationService: NotificationService,
        @Inject('MESSAGING_SERVICE') private readonly messagingService: IMessagingService,
        @InjectQueue('notifications') private readonly notificationQueue: Queue,
        private readonly prisma: PrismaService,
    ) {
        this.logger.log('⭐⭐⭐ NotificationProcessor inicializado ⭐⭐⭐');

        // Verificar a conexão com a fila
        this.notificationQueue
            .isReady()
            .then(() => {
                this.logger.log('✅ Conexão com fila Bull estabelecida com sucesso!');

                // Verificar jobs pendentes
                this.notificationQueue
                    .getJobs(['waiting', 'active', 'delayed'])
                    .then((jobs) => {
                        this.logger.log(`📊 Jobs pendentes na fila: ${jobs.length}`);
                        if (jobs.length > 0) {
                            this.logger.log(`📝 Primeiro job: ${JSON.stringify(jobs[0].data)}`);
                        }
                    })
                    .catch((err) => {
                        this.logger.error(`❌ Erro ao verificar jobs pendentes: ${err.message}`);
                    });
            })
            .catch((err) => {
                this.logger.error(`❌ Erro ao conectar com fila Bull: ${err.message}`);
            });
    }

    @Process('send-notification')
    async handleNotification(job: Job<NotificationJobData>): Promise<void> {
        let notification;
        const { notificationId } = job.data;

        this.logger.log(
            `[handleNotification] Iniciando processamento do job ${job.id} para notificação ${notificationId}`,
        );
        this.logger.debug(`[handleNotification] Dados do job: ${JSON.stringify(job.data)}`);

        try {
            // 1. Buscar a notificação atual do banco
            notification = await this.prisma.notifications.findUnique({
                where: { id: notificationId },
                include: { sellers: true, contracts: true },
            });

            if (!notification) {
                this.logger.error(
                    `[handleNotification] Notificação ${notificationId} não encontrada no DB. Removendo job ${job.id}.`,
                );
                return;
            }

            // 2. Verificar se o contrato já foi assinado
            if (notification.contracts.status === contract_status.SIGNED) {
                this.logger.log(
                    `[handleNotification] Contrato ${notification.contract_id} já foi assinado. Cancelando notificação.`,
                );
                await this.notificationService.markAsFailed(notification.id);
                return;
            }

            // 3. Verificar se existem notificações pendentes para o mesmo contrato
            const pendingNotifications = await this.prisma.notifications.findMany({
                where: {
                    contract_id: notification.contract_id,
                    status: ENotificationStatus.PENDING,
                    id: { not: notification.id },
                },
                orderBy: { created_at: 'asc' },
            });

            if (pendingNotifications.length > 0) {
                this.logger.log(
                    `[handleNotification] Existem ${pendingNotifications.length} notificações pendentes para o contrato ${notification.contract_id}. Adiando processamento.`,
                );
                // Adia o processamento desta notificação
                await this.notificationQueue.add(
                    'send-notification',
                    { notificationId: notification.id, attemptNumber: 1 },
                    { delay: 60000 },
                );
                return;
            }

            // 4. Verificar se a notificação já foi processada
            if (notification.status !== ENotificationStatus.PENDING) {
                this.logger.log(
                    `[handleNotification] Notificação ${notification.id} já foi processada com status ${notification.status}.`,
                );
                return;
            }

            // 5. Processar a notificação
            const currentAttempt = job.attemptsMade + 1;
            this.logger.log(
                `[handleNotification] Processando notificação ${notification.id} (tentativa ${currentAttempt})`,
            );

            const result = await this.messagingService.sendContractNotification(
                notification.sellers.telefone,
                {
                    razaoSocial: notification.sellers.razao_social,
                    contractUrl: notification.contracts.signing_url || '',
                    sellerId: notification.sellers.id,
                    notificationAttempts: currentAttempt,
                    messageContent: notification.content,
                },
            );

            if (result.success) {
                this.logger.log(
                    `[handleNotification] ✅ Notificação ${notification.id} enviada com sucesso`,
                );
                await this.notificationService.markAsSent(notification.id, result.messageId);
            } else {
                // Falha no envio reportada pelo serviço
                const errorMsg = result.error || 'Falha reportada pelo messagingService';
                this.logger.warn(
                    `[handleNotification] ⚠️ Envio FALHOU (tentativa ${currentAttempt}) para Notif ID: ${notification.id}. Erro: ${errorMsg}`,
                );
                // Se atingiu o limite de tentativas, marcar como falha permanente
                if (currentAttempt >= this.MAX_ATTEMPTS) {
                    this.logger.error(
                        `[handleNotification] Notificação ${notification.id} falhou definitivamente após ${currentAttempt} tentativas. Última falha: ${errorMsg}`,
                    );
                    await this.notificationService.markAsFailed(notification.id);
                } else {
                    // Lança erro para o Bull tentar novamente
                    this.logger.log(
                        `[handleNotification] Lançando erro para Bull tentar novamente (tentativa ${currentAttempt}/${this.MAX_ATTEMPTS})`,
                    );
                    throw new Error(errorMsg);
                }
            }
        } catch (error) {
            // Erro inesperado durante o processamento do job
            this.logger.error(
                `[handleNotification] ❌ Erro CATASTRÓFICO no job ${job.id} para notificação ${notificationId}: ${error.message}`,
                error.stack,
            );

            const finalAttempt = job.attemptsMade + 1;
            // Tentar marcar como FAILED no DB se possível
            if (notificationId && finalAttempt >= this.MAX_ATTEMPTS) {
                try {
                    await this.notificationService.markAsFailed(notificationId);
                    this.logger.warn(
                        `[handleNotification] Notificação ${notificationId} marcada como FAILED devido a erro catastrófico na última tentativa.`,
                    );
                } catch (dbError) {
                    this.logger.error(
                        `[handleNotification] Erro ao tentar marcar notificação ${notificationId} como FAILED após erro catastrófico: ${dbError.message}`,
                    );
                }
            }
            // Relança o erro para o Bull saber que falhou e (talvez) tentar de novo
            throw error;
        }
    }

    @OnQueueActive()
    onActive(job: Job) {
        this.logger.log(`[onActive] Iniciando processamento do job ${job.id}`);
        this.logger.debug(`[onActive] Dados do job: ${JSON.stringify(job.data)}`);
    }

    @OnQueueCompleted()
    onCompleted(job: Job) {
        this.logger.log(`[onCompleted] Job ${job.id} concluído com sucesso`);
        this.logger.debug(`[onCompleted] Dados do job: ${JSON.stringify(job.data)}`);
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(`[onFailed] Job ${job.id} falhou: ${error.message}`, error.stack);
        this.logger.debug(`[onFailed] Dados do job: ${JSON.stringify(job.data)}`);
    }
}
