import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { AutentiqueWebhookEventDto, EAutentiqueEventType } from '../dtos/webhook-event.dto';
import { AutentiqueService } from './autentique.service';
import { NotificationService } from '../../../contract-management/notification/services/notification.service';
import { ENotificationType } from '../../../contract-management/notification/enums/notification-type.enum';
import { ENotificationChannel } from '../../../contract-management/notification/enums/notification-channel.enum';
import { EContractStatus } from '../../../contract-management/contract/enums/contract-status.enum';
import { CreateNotificationDto } from '../../../contract-management/notification/dtos/create-notification.dto';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly autentiqueService: AutentiqueService,
        private readonly notificationService: NotificationService,
    ) {}

    async handleWebhookEvent(event: AutentiqueWebhookEventDto): Promise<void> {
        this.logger.log(`Processando evento do webhook: ${event.event.type}`);

        try {
            switch (event.event.type) {
                case EAutentiqueEventType.SIGNATURE_ACCEPTED:
                    await this.handleSignatureAccepted(event);
                    break;
                case EAutentiqueEventType.SIGNATURE_REJECTED:
                    await this.handleSignatureRejected(event);
                    break;
                case EAutentiqueEventType.DOCUMENT_FINISHED:
                    await this.handleDocumentFinished(event);
                    break;
                default:
                    this.logger.debug(`Evento não tratado: ${event.event.type}`);
            }
        } catch (error) {
            this.logger.error(`Erro ao processar evento do webhook: ${error.message}`, error.stack);
            throw error;
        }
    }

    private async handleSignatureAccepted(event: AutentiqueWebhookEventDto): Promise<void> {
        const { document } = event.event.data.object;
        this.logger.log(`Assinatura aceita para o documento: ${document}`);

        // Buscar o contrato pelo ID do documento na Autentique
        const contract = await this.prisma.contracts.findFirst({
            where: { external_id: document },
            include: { sellers: true },
        });

        if (!contract) {
            this.logger.warn(`Contrato não encontrado para o documento: ${document}`);
            return;
        }

        // Atualizar o status do contrato para assinado
        await this.prisma.contracts.update({
            where: { id: contract.id },
            data: { status: EContractStatus.SIGNED },
        });

        // Criar notificação de confirmação de assinatura
        const notificationDto: CreateNotificationDto = {
            contractId: contract.id,
            sellerId: contract.seller_id,
            type: ENotificationType.CONTRACT_SIGNED,
            channel: ENotificationChannel.WHATSAPP,
            content: `Contrato assinado com sucesso! Obrigado por sua colaboração.`,
            attemptNumber: 1,
        };

        await this.notificationService.create(notificationDto);
    }

    private async handleSignatureRejected(event: AutentiqueWebhookEventDto): Promise<void> {
        const { document, reason } = event.event.data.object;
        this.logger.log(`Assinatura rejeitada para o documento: ${document}, motivo: ${reason}`);

        // Buscar o contrato pelo ID do documento na Autentique
        const contract = await this.prisma.contracts.findFirst({
            where: { external_id: document },
            include: { sellers: true },
        });

        if (!contract) {
            this.logger.warn(`Contrato não encontrado para o documento: ${document}`);
            return;
        }

        // Atualizar o status do contrato para cancelado
        await this.prisma.contracts.update({
            where: { id: contract.id },
            data: { status: EContractStatus.CANCELLED },
        });

        // Criar notificação de rejeição de assinatura
        const notificationDto: CreateNotificationDto = {
            contractId: contract.id,
            sellerId: contract.seller_id,
            type: ENotificationType.CONTRACT_EXPIRED,
            channel: ENotificationChannel.WHATSAPP,
            content: `O contrato foi rejeitado. Motivo: ${reason || 'Não especificado'}.`,
            attemptNumber: 1,
        };

        await this.notificationService.create(notificationDto);
    }

    private async handleDocumentFinished(event: AutentiqueWebhookEventDto): Promise<void> {
        const { document } = event.event.data.object;
        this.logger.log(`Documento finalizado: ${document}`);

        // Buscar o contrato pelo ID do documento na Autentique
        const contract = await this.prisma.contracts.findFirst({
            where: { external_id: document },
            include: { sellers: true },
        });

        if (!contract) {
            this.logger.warn(`Contrato não encontrado para o documento: ${document}`);
            return;
        }

        // Verificar se todas as assinaturas foram concluídas
        const autentiqueDocument = await this.autentiqueService.getDocument(document);
        if (autentiqueDocument.signed_count === autentiqueDocument.signatures.length) {
            // Atualizar o status do contrato para assinado
            await this.prisma.contracts.update({
                where: { id: contract.id },
                data: { status: EContractStatus.SIGNED },
            });

            // Criar notificação de conclusão do contrato
            const notificationDto: CreateNotificationDto = {
                contractId: contract.id,
                sellerId: contract.seller_id,
                type: ENotificationType.CONTRACT_SIGNED,
                channel: ENotificationChannel.WHATSAPP,
                content: `Contrato assinado com sucesso! Obrigado por sua colaboração.`,
                attemptNumber: 1,
            };

            await this.notificationService.create(notificationDto);
        }
    }
}
