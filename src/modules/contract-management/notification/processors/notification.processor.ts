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
import { ENotificationType } from '../enums/notification-type.enum';

@Injectable()
@Processor('notifications')
export class NotificationProcessor implements INotificationProcessor {
    private readonly logger = new Logger(NotificationProcessor.name);
    private readonly MAX_ATTEMPTS = 5;

    constructor(
        private readonly notificationService: NotificationService,
        @Inject('MESSAGING_SERVICE') private readonly messagingService: IMessagingService,
        @InjectQueue('notifications') private readonly notificationQueue: Queue,
    ) {
        this.logger.log('NotificationProcessor inicializado');
    }

    @Process()
    async handleNotification(job: Job<NotificationJobData>): Promise<void> {
        let notification;
        try {
            this.logger.debug(
                `[handleNotification] Processando notificação ${job.data.notificationId}`,
            );

            if (!job.data.notificationId) {
                throw new Error('ID da notificação não fornecido');
            }

            notification = await this.notificationService.findOne(job.data.notificationId);

            if (!notification) {
                throw new Error(`Notificação ${job.data.notificationId} não encontrada`);
            }

            this.logger.debug(
                `[handleNotification] Notificação encontrada: ${JSON.stringify(notification)}`,
            );

            if (notification.status === ENotificationStatus.DELIVERED) {
                this.logger.debug(
                    `[handleNotification] Notificação ${job.data.notificationId} já entregue`,
                );
                return;
            }

            // Se for uma notificação de contrato, usa o método específico
            if (notification.type === ENotificationType.SIGNATURE_REMINDER) {
                this.logger.debug(`[handleNotification] Enviando notificação de contrato`);
                const seller = await this.notificationService.getSellerByNotificationId(
                    notification.id,
                );

                if (!seller) {
                    throw new Error(
                        `Vendedor não encontrado para a notificação ${notification.id}`,
                    );
                }

                const contract = await this.notificationService.getContractByNotificationId(
                    notification.id,
                );

                if (!contract) {
                    throw new Error(
                        `Contrato não encontrado para a notificação ${notification.id}`,
                    );
                }

                this.logger.debug(
                    `[handleNotification] Dados obtidos - Vendedor: ${JSON.stringify(seller)}, Contrato: ${JSON.stringify(contract)}`,
                );

                if (!contract.signing_url) {
                    throw new Error(
                        `URL de assinatura não encontrada para o contrato: ${notification.contract_id}`,
                    );
                }

                this.logger.debug(
                    `[handleNotification] Enviando mensagem para ${seller.telefone} com URL: ${contract.signing_url}`,
                );

                try {
                    this.logger.debug(
                        `[handleNotification] Chamando WhatsAppService.sendContractNotification`,
                    );
                    const result = await (this.messagingService as any).sendContractNotification(
                        seller.telefone,
                        {
                            razaoSocial: seller.razao_social,
                            contractUrl: contract.signing_url,
                            sellerId: seller.id,
                            notificationAttempts: notification.attempt_number,
                        },
                    );

                    this.logger.debug(
                        `[handleNotification] Resultado do envio: ${JSON.stringify(result)}`,
                    );

                    if (!result || !result.success) {
                        throw new Error(
                            `Falha ao enviar notificação de contrato: ${result?.error || 'Erro desconhecido'}`,
                        );
                    }

                    this.logger.debug(
                        `[handleNotification] Mensagem de contrato enviada com ID: ${result.messageId}`,
                    );

                    await this.notificationService.markAsSent(notification.id);
                    this.logger.debug(
                        `[handleNotification] Notificação ${notification.id} marcada como enviada`,
                    );
                } catch (error) {
                    this.logger.error(
                        `[handleNotification] Erro ao enviar notificação de contrato: ${error.message}`,
                        error.stack,
                    );
                    await this.notificationService.markAsFailed(notification.id);
                    throw error;
                }
            } else {
                this.logger.debug(`[handleNotification] Enviando notificação padrão`);
                try {
                    this.logger.debug(`[handleNotification] Chamando WhatsAppService.sendMessage`);
                    const result = await this.messagingService.sendMessage(notification);

                    if (!result || !result.messageId) {
                        throw new Error(
                            'Falha ao enviar notificação: resposta inválida do serviço',
                        );
                    }

                    this.logger.debug(
                        `[handleNotification] Mensagem enviada com ID: ${result.messageId}`,
                    );
                    await this.notificationService.markAsSent(notification.id);
                } catch (error) {
                    this.logger.error(
                        `[handleNotification] Erro ao enviar notificação padrão: ${error.message}`,
                        error.stack,
                    );
                    await this.notificationService.markAsFailed(notification.id);
                    throw error;
                }
            }
        } catch (error) {
            this.logger.error(
                `[handleNotification] Erro ao processar notificação ${job.data.notificationId}: ${error.message}`,
                error.stack,
            );
            if (notification) {
                await this.notificationService.markAsFailed(notification.id);
            }
            throw error;
        }
    }

    @OnQueueActive()
    onActive(job: Job) {
        this.logger.log(`[onActive] Iniciando processamento do job ${job.id}`);
    }

    @OnQueueCompleted()
    onCompleted(job: Job) {
        this.logger.log(`[onCompleted] Job ${job.id} concluído com sucesso`);
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(`[onFailed] Job ${job.id} falhou: ${error.message}`, error.stack);
    }
}
