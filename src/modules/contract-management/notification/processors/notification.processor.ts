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
        this.logger.log('NotificationProcessor inicializado');
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
                include: { sellers: true, contracts: true }, // Incluir dados necessários para envio
            });

            if (!notification) {
                this.logger.error(
                    `[handleNotification] Notificação ${notificationId} não encontrada no DB. Removendo job ${job.id}.`,
                );
                // Se não existe, não há o que fazer, considera o job "concluído" sem erro para não ficar retentando
                return;
            }

            // 2. VERIFICAR STATUS ATUAL ANTES DE PROCESSAR
            if (
                notification.status === ENotificationStatus.SENT ||
                notification.status === ENotificationStatus.DELIVERED
            ) {
                this.logger.log(
                    `[handleNotification] Notificação ${notificationId} já está ${notification.status}. Job ${job.id} ignorado.`,
                );
                return; // Já foi enviada/entregue, não faz nada
            }
            if (notification.status === ENotificationStatus.FAILED) {
                this.logger.log(
                    `[handleNotification] Notificação ${notificationId} já está FAILED permanentemente. Job ${job.id} ignorado.`,
                );
                return; // Já falhou permanentemente, não faz nada
            }

            // Se chegou aqui, está PENDING e precisa ser processada
            this.logger.log(
                `[handleNotification] Notificação ${notificationId} está ${notification.status}. Prosseguindo com tentativa de envio.`,
            );

            // 3. Verificar tentativas
            const currentAttempt = job.attemptsMade + 1; // attemptsMade é 0-based
            this.logger.log(
                `[handleNotification] Tentativa ${currentAttempt}/${this.MAX_ATTEMPTS} para job ${job.id}`,
            );

            // Atualiza o número de tentativas no banco ANTES de tentar enviar
            await this.prisma.notifications.update({
                where: { id: notification.id },
                data: { attempt_number: currentAttempt },
            });
            notification.attempt_number = currentAttempt; // Atualiza objeto em memória

            // 4. Preparar dados e chamar o serviço de mensageria
            const seller = notification.sellers;
            const contract = notification.contracts;
            if (!seller || !contract) {
                throw new Error('Dados do vendedor ou contrato ausentes na notificação');
            }

            this.logger.debug(
                `[handleNotification] Chamando WhatsAppService para notificação ${notification.id}, tentativa ${currentAttempt}`,
            );

            const result = await this.messagingService.sendContractNotification(seller.telefone, {
                razaoSocial: seller.razao_social,
                contractUrl: contract.signing_url || '',
                sellerId: seller.id,
                notificationAttempts: currentAttempt,
                messageContent: notification.content,
            });

            // 5. Processar resultado do envio
            if (result.success) {
                this.logger.log(
                    `[handleNotification] ✅ Envio SUCESSO (tentativa ${currentAttempt}) para Notif ID: ${notification.id}. Msg ID: ${result.messageId}`,
                );
                await this.notificationService.markAsSent(notification.id, result.messageId);
                // Job concluído com sucesso
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
                    // Job concluído (como falha permanente), não lança erro para não tentar mais
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
