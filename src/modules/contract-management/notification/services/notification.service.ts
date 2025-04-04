import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { CreateNotificationDto } from '../dtos/create-notification.dto';
import { NotificationResponseDto } from '../dtos/notification-response.dto';
import { ENotificationStatus } from '../enums/notification-status.enum';
import { mapNotificationTypeToPrisma } from '../enums/notification-type.enum';
import { mapNotificationStatusToPrisma } from '../enums/notification-status.enum';
import { notification_channel, notification_status } from '@prisma/client';
import { INotificationService } from '../interfaces/notification-service.interface';
import { IMessagingService } from '../interfaces/messaging-service.interface';
import { Notification } from '../entities/notification.entity';
import { NotificationMapper } from '../mappers/notification.mapper';
import { UpdateNotificationDto } from '../dtos/update-notification.dto';
import { Inject } from '@nestjs/common';
import { ENotificationType } from '../enums/notification-type.enum';

@Injectable()
export class NotificationService implements INotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        private readonly prisma: PrismaService,
        @Inject('MESSAGING_SERVICE') private readonly messagingService: IMessagingService,
        private readonly notificationMapper: NotificationMapper,
        @InjectQueue('notifications') private readonly notificationQueue: Queue,
    ) {}

    async create(createNotificationDto: CreateNotificationDto): Promise<NotificationResponseDto> {
        // Log detalhado do DTO recebido
        this.logger.log(
            `[create] NotificationService.create chamado com DTO: ${JSON.stringify(
                {
                    ...createNotificationDto,
                    content: createNotificationDto.content
                        ? createNotificationDto.content.substring(0, 100) + '...'
                        : 'N/A',
                },
                null,
                2,
            )}`,
        );
        this.logger.log(
            `Criando nova notificação para o contrato ${createNotificationDto.contractId}`,
        );

        // Buscar dados completos necessários para envio e fallback
        const seller = await this.prisma.sellers.findUnique({
            where: { id: createNotificationDto.sellerId },
            select: { id: true, razao_social: true, telefone: true },
        });
        if (!seller) {
            throw new Error(`Vendedor não encontrado: ${createNotificationDto.sellerId}`);
        }
        const contract = await this.prisma.contracts.findUnique({
            where: { id: createNotificationDto.contractId },
            select: { id: true, signing_url: true }, // Precisa da signing_url para o fallback
        });
        if (!contract) {
            throw new Error(`Contrato não encontrado: ${createNotificationDto.contractId}`);
        }
        if (!contract.signing_url && !createNotificationDto.content) {
            throw new Error(
                `URL de assinatura não encontrada e conteúdo não fornecido para contrato ${createNotificationDto.contractId}`,
            );
        }

        const content =
            createNotificationDto.content ||
            `Olá ${seller.razao_social},\n\nSeu contrato está pronto para assinatura.\nAcesse: ${contract.signing_url}`;

        if (!createNotificationDto.content) {
            this.logger.warn(
                `[create] CONTEÚDO AUSENTE no DTO para contrato ${createNotificationDto.contractId}! Usando fallback.`,
            );
        }

        const notification = await this.prisma.notifications.create({
            data: {
                contract_id: createNotificationDto.contractId,
                seller_id: createNotificationDto.sellerId,
                type: mapNotificationTypeToPrisma(createNotificationDto.type),
                channel: createNotificationDto.channel as notification_channel,
                content: content,
                status: notification_status.PENDING,
                attempt_number: 1,
            },
            include: { sellers: true, contracts: true },
        });

        this.logger.log(
            `[create] Notificação ${notification.id} criada com status PENDING. Tentando envio imediato...`,
        );

        let notificationToSend = notification;
        let sentImmediately = false;
        let immediateSendError: Error | null = null;

        try {
            this.logger.log(`[create] Preparando envio imediato para Notif ID: ${notification.id}`);
            const result = await this.messagingService.sendContractNotification(seller.telefone, {
                razaoSocial: seller.razao_social,
                contractUrl: contract.signing_url || '',
                sellerId: seller.id,
                notificationAttempts: 1,
                messageContent: content,
            });

            if (result.success) {
                this.logger.log(
                    `[create] ✅ Envio imediato SUCESSO para Notif ID: ${notification.id}. Msg ID: ${result.messageId}`,
                );
                notificationToSend = await this.prisma.notifications.update({
                    where: { id: notification.id },
                    data: {
                        status: notification_status.SENT,
                        sent_at: new Date(),
                        external_id: result.messageId || null,
                        attempt_number: 1,
                    },
                    include: { sellers: true, contracts: true },
                });
                sentImmediately = true;
            } else {
                immediateSendError = new Error(
                    result.error || 'Falha reportada pelo messagingService',
                );
                this.logger.warn(
                    `[create] ⚠️ Envio imediato FALHOU (reportado pelo serviço) para Notif ID: ${notification.id}. Erro: ${immediateSendError.message}`,
                );
            }
        } catch (error) {
            immediateSendError = error;
            this.logger.error(
                `[create] ❌ Erro CATASTRÓFICO no envio imediato para Notif ID: ${notification.id}: ${error.message}`,
                error.stack,
            );
        }

        if (!sentImmediately) {
            this.logger.log(
                `[create] Envio imediato falhou ou não ocorreu para ${notification.id}. Enfileirando...`,
            );
            try {
                await this.enqueueNotification(notification.id);
                this.logger.log(
                    `[create] Notificação ${notification.id} enfileirada com sucesso após falha no envio imediato.`,
                );
            } catch (enqueueError) {
                this.logger.error(
                    `[create] FALHA AO ENFILEIRAR PÓS-FALHA notificação ${notification.id}: ${enqueueError.message}`,
                    enqueueError.stack,
                );
                notificationToSend = await this.prisma.notifications.update({
                    where: { id: notification.id },
                    data: { status: notification_status.FAILED },
                    include: { sellers: true, contracts: true },
                });
            }
        }

        return this.notificationMapper.toResponseDto(notificationToSend);
    }

    /**
     * Método auxiliar para adicionar uma notificação à fila Bull
     * @param notificationId ID da notificação a ser enfileirada
     * @private
     */
    private async enqueueNotification(notificationId: string): Promise<void> {
        try {
            this.logger.log(`Adicionando notificação ${notificationId} à fila Bull...`);

            // Verificando se a fila está pronta
            await this.notificationQueue.isReady();

            // Adiciona o job à fila
            await this.notificationQueue.add('send-notification', {
                notificationId: notificationId,
                attemptNumber: 1,
            });

            this.logger.log(`✅ Notificação ${notificationId} adicionada à fila com sucesso`);
        } catch (queueError) {
            this.logger.error(
                `❌ Falha ao adicionar notificação ${notificationId} à fila: ${queueError.message}`,
                queueError.stack,
            );
            // Falha silenciosa - a notificação continua como PENDING e pode ser processada manualmente
        }
    }

    async update(id: string, updateDto: UpdateNotificationDto): Promise<NotificationResponseDto> {
        const notification = await this.prisma.notifications.update({
            where: { id },
            data: updateDto,
            include: { sellers: true, contracts: true },
        });
        return this.notificationMapper.toResponseDto(notification);
    }

    async findById(id: string): Promise<NotificationResponseDto> {
        const notification = await this.getNotificationById(id);
        return this.notificationMapper.toResponseDto(notification);
    }

    async findOne(id: string): Promise<Notification> {
        const notification = await this.prisma.notifications.findUnique({
            where: { id },
            include: { sellers: true, contracts: true },
        });

        if (!notification) {
            throw new NotFoundException(`Notificação com ID ${id} não encontrada`);
        }

        return this.notificationMapper.toDomain(notification);
    }

    async findAll(): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            include: { sellers: true, contracts: true },
        });
        return notifications.map((notification) =>
            this.notificationMapper.toResponseDto(notification),
        );
    }

    async findByContractId(contractId: string): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            where: { contract_id: contractId },
            include: { sellers: true, contracts: true },
        });
        return notifications.map((notification) =>
            this.notificationMapper.toResponseDto(notification),
        );
    }

    async findBySellerId(sellerId: string): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            where: { seller_id: sellerId },
            include: { sellers: true, contracts: true },
        });
        return notifications.map((notification) =>
            this.notificationMapper.toResponseDto(notification),
        );
    }

    async findByStatus(status: ENotificationStatus): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            where: { status: mapNotificationStatusToPrisma(status) },
            include: { sellers: true, contracts: true },
        });
        return notifications.map((notification) =>
            this.notificationMapper.toResponseDto(notification),
        );
    }

    async findPending(): Promise<NotificationResponseDto[]> {
        const notifications = await this.prisma.notifications.findMany({
            where: { status: notification_status.PENDING },
            include: { sellers: true, contracts: true },
        });
        return notifications.map((notification) =>
            this.notificationMapper.toResponseDto(notification),
        );
    }

    async getSellerByNotificationId(
        notificationId: string,
    ): Promise<{ id: string; razao_social: string; telefone: string }> {
        this.logger.debug(
            `[getSellerByNotificationId] Buscando vendedor para notificação ${notificationId}`,
        );

        const notification = await this.prisma.notifications.findUnique({
            where: { id: notificationId },
            include: {
                sellers: {
                    select: {
                        id: true,
                        razao_social: true,
                        telefone: true,
                    },
                },
            },
        });

        this.logger.debug(
            `[getSellerByNotificationId] Notificação encontrada: ${JSON.stringify(notification)}`,
        );

        if (!notification) {
            throw new Error(`Notificação não encontrada: ${notificationId}`);
        }

        if (!notification.sellers) {
            throw new Error(`Vendedor não encontrado para a notificação: ${notificationId}`);
        }

        this.logger.debug(
            `[getSellerByNotificationId] Vendedor encontrado: ${JSON.stringify(notification.sellers)}`,
        );
        return notification.sellers;
    }

    async getContractByNotificationId(
        notificationId: string,
    ): Promise<{ id: string; signing_url: string }> {
        this.logger.debug(
            `[getContractByNotificationId] Buscando contrato para notificação ${notificationId}`,
        );

        const notification = await this.prisma.notifications.findUnique({
            where: { id: notificationId },
            include: {
                contracts: {
                    select: {
                        id: true,
                        signing_url: true,
                    },
                },
            },
        });

        this.logger.debug(
            `[getContractByNotificationId] Notificação encontrada: ${JSON.stringify(notification)}`,
        );

        if (!notification) {
            throw new Error(`Notificação não encontrada: ${notificationId}`);
        }

        if (!notification.contracts) {
            throw new Error(`Contrato não encontrado para a notificação: ${notificationId}`);
        }

        this.logger.debug(
            `[getContractByNotificationId] Contrato encontrado: ${JSON.stringify(notification.contracts)}`,
        );
        return notification.contracts;
    }

    async updateStatus(id: string, status: ENotificationStatus): Promise<void> {
        await this.prisma.notifications.update({
            where: { id },
            data: {
                status: status as notification_status,
                delivered_at: status === ENotificationStatus.DELIVERED ? new Date() : undefined,
            },
        });
    }

    async markAsSent(id: string, externalId?: string | null): Promise<NotificationResponseDto> {
        const notification = await this.prisma.notifications.update({
            where: { id },
            data: {
                status: notification_status.SENT,
                sent_at: new Date(),
                external_id: externalId,
            },
            include: { sellers: true, contracts: true },
        });
        return this.notificationMapper.toResponseDto(notification);
    }

    async markAsDelivered(id: string): Promise<NotificationResponseDto> {
        const notification = await this.prisma.notifications.update({
            where: { id },
            data: { status: notification_status.DELIVERED },
            include: { sellers: true, contracts: true },
        });
        return this.notificationMapper.toResponseDto(notification);
    }

    async markAsFailed(id: string): Promise<NotificationResponseDto> {
        const notification = await this.prisma.notifications.update({
            where: { id },
            data: { status: notification_status.FAILED },
            include: { sellers: true, contracts: true },
        });
        return this.notificationMapper.toResponseDto(notification);
    }

    async sendWhatsAppNotification(notification: Notification): Promise<void> {
        try {
            this.logger.debug(
                `[sendWhatsAppNotification] Iniciando envio da notificação ${notification.id}`,
            );

            // Se for uma notificação de contrato, usa o método específico
            if (notification.type === ENotificationType.SIGNATURE_REMINDER) {
                this.logger.debug(
                    `[sendWhatsAppNotification] Buscando dados do vendedor ${notification.seller_id}`,
                );
                const seller = await this.prisma.sellers.findUnique({
                    where: { id: notification.seller_id },
                    select: {
                        id: true,
                        razao_social: true,
                        telefone: true,
                    },
                });

                if (!seller) {
                    throw new Error(`Vendedor não encontrado: ${notification.seller_id}`);
                }
                this.logger.debug(
                    `[sendWhatsAppNotification] Vendedor encontrado: ${JSON.stringify(seller)}`,
                );

                this.logger.debug(
                    `[sendWhatsAppNotification] Buscando dados do contrato ${notification.contract_id}`,
                );
                const contract = await this.prisma.contracts.findUnique({
                    where: { id: notification.contract_id },
                    select: {
                        id: true,
                        signing_url: true,
                    },
                });

                if (!contract) {
                    throw new Error(`Contrato não encontrado: ${notification.contract_id}`);
                }

                if (!contract.signing_url) {
                    throw new Error(
                        `URL de assinatura não encontrada para o contrato: ${notification.contract_id}`,
                    );
                }
                this.logger.debug(
                    `[sendWhatsAppNotification] Contrato encontrado: ${JSON.stringify(contract)}`,
                );

                this.logger.debug(
                    `[sendWhatsAppNotification] Enviando notificação via WhatsApp para ${seller.telefone}`,
                );

                // Verificação adicional do conteúdo da mensagem
                this.logger.log(
                    `[sendWhatsAppNotification] INSPEÇÃO DETALHADA DA MENSAGEM:
                    ID da notificação: ${notification.id}
                    Conteúdo original: "${notification.content}"
                    Tamanho: ${notification.content ? notification.content.length : 0} caracteres
                    Tipo: ${notification.type}
                    Tentativa: ${notification.attempt_number}
                    `,
                );

                const result = await (this.messagingService as any).sendContractNotification(
                    seller.telefone,
                    {
                        razaoSocial: seller.razao_social,
                        contractUrl: contract.signing_url,
                        sellerId: seller.id,
                        notificationAttempts: notification.attempt_number,
                        messageContent: notification.content,
                    },
                );

                this.logger.debug(
                    `[sendWhatsAppNotification] Resultado do envio: ${JSON.stringify(result)}`,
                );

                if (!result.success) {
                    throw new Error(result.error || 'Erro ao enviar notificação de contrato');
                }

                this.logger.debug(`[sendWhatsAppNotification] Marcando notificação como enviada`);
                await this.markAsSent(notification.id);
                this.logger.debug(
                    `[sendWhatsAppNotification] Mensagem de contrato enviada com ID: ${result.messageId}`,
                );
            } else {
                this.logger.debug(`[sendWhatsAppNotification] Enviando notificação padrão`);
                const result = await this.messagingService.sendMessage(notification);
                this.logger.debug(
                    `[sendWhatsAppNotification] Resultado do envio: ${JSON.stringify(result)}`,
                );
                await this.markAsSent(notification.id);
                this.logger.debug(
                    `[sendWhatsAppNotification] Mensagem enviada com ID: ${result.messageId}`,
                );
            }
        } catch (error) {
            this.logger.error(
                `[sendWhatsAppNotification] Erro ao enviar notificação: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    private async getNotificationById(id: string) {
        const notification = await this.prisma.notifications.findUnique({
            where: { id },
            include: {
                sellers: {
                    select: {
                        id: true,
                        telefone: true,
                    },
                },
            },
        });

        if (!notification) {
            throw new NotFoundException(`Notificação com ID ${id} não encontrada`);
        }

        return notification;
    }

    async remove(id: string): Promise<void> {
        await this.prisma.notifications.delete({ where: { id } });
    }
}
