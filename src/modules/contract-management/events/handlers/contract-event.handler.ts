import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ContractService } from '../../contract/services/contract.service';
import { NotificationService } from '../../notification/services/notification.service';
import { ENotificationType } from '../../notification/enums/notification-type.enum';
import { ENotificationChannel } from '../../notification/enums/notification-channel.enum';
import { PrismaService } from '../../../../shared/services/prisma.service';
import {
    ContractSignedEvent,
    ContractExpiredEvent,
    ContractCancelledEvent,
    ContractReminderEvent,
    ContractSentToSignatureEvent,
} from '../contract.events';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateNotificationDto } from '../../notification/dtos/create-notification.dto';
import { CONTRACT_NOTIFICATION_TEMPLATES } from '../../../integration/whatsapp/templates/contract-notification.templates';

@Injectable()
export class ContractEventHandler {
    private readonly logger = new Logger(ContractEventHandler.name);

    constructor(
        private readonly contractService: ContractService,
        private readonly notificationService: NotificationService,
        private readonly prisma: PrismaService,
        private eventEmitter: EventEmitter2,
    ) {}

    private async getSellerData(sellerId: string) {
        return this.prisma.sellers.findUnique({
            where: { id: sellerId },
        });
    }

    @OnEvent('contract.sent_to_signature')
    async handleContractSentToSignature(event: ContractSentToSignatureEvent) {
        this.logger.log(
            `[handleContractSent] ⚡ EVENTO RECEBIDO: contract.sent_to_signature para contrato ${event.contractId}`,
        );

        try {
            this.logger.log(`[handleContractSent] Buscando seller ID: ${event.sellerId}`);
            const seller = await this.getSellerData(event.sellerId);
            if (!seller) {
                this.logger.error(
                    `[handleContractSent] Vendedor não encontrado para ID: ${event.sellerId}`,
                );
                return;
            }
            this.logger.log(
                `[handleContractSent] Dados do vendedor: ${seller.razao_social}, ${seller.telefone}`,
            );

            this.logger.log(
                `[handleContractSent] Dados recebidos no evento: Contrato ID=${event.contractId}, URL=${event.signingUrl}`,
            );

            // Usa o template da primeira tentativa
            const mensagem = CONTRACT_NOTIFICATION_TEMPLATES.FIRST_ATTEMPT(
                seller.razao_social,
                event.signingUrl,
            );

            this.logger.log(
                `[handleContractSent] 📱 Chamando notificationService.create para o contrato ${event.contractId} com a mensagem personalizada.`,
            );

            const notificationResult = await this.notificationService.create({
                contractId: event.contractId,
                sellerId: event.sellerId,
                type: ENotificationType.SIGNATURE_REMINDER,
                channel: ENotificationChannel.WHATSAPP,
                content: mensagem,
                attemptNumber: 1,
            });

            this.logger.log(
                `[handleContractSent] ✅ Chamada para notificationService.create concluída para ${seller.razao_social}`,
                {
                    notificationId: notificationResult.id,
                    statusRetornado: notificationResult.status,
                },
            );
        } catch (error) {
            this.logger.error(
                `❌ [handleContractSent] Erro ao processar evento contract.sent_to_signature: ${error.message}`,
                error.stack,
            );
        }
    }

    @OnEvent('contract.signed')
    async handleContractSignedEvent(event: ContractSignedEvent) {
        const seller = await this.getSellerData(event.sellerId);
        const notification: CreateNotificationDto = {
            contractId: event.contractId,
            sellerId: event.sellerId,
            type: ENotificationType.CONTRACT_SIGNED,
            channel: ENotificationChannel.WHATSAPP,
            content: `Olá ${seller.razao_social}, seu contrato foi assinado com sucesso!`,
            attemptNumber: 1,
        };

        this.eventEmitter.emit('notification.created', notification);
    }

    @OnEvent('contract.expired')
    async handleContractExpiredEvent(event: ContractExpiredEvent) {
        const seller = await this.getSellerData(event.sellerId);
        await this.notificationService.create({
            contractId: event.contractId,
            sellerId: event.sellerId,
            type: ENotificationType.CONTRACT_EXPIRED,
            channel: ENotificationChannel.WHATSAPP,
            content: `Olá ${seller.razao_social}, seu contrato expirou. Por favor, entre em contato conosco.`,
            attemptNumber: 1,
        });
    }

    @OnEvent('contract.cancelled')
    async handleContractCancelledEvent(event: ContractCancelledEvent) {
        const seller = await this.getSellerData(event.sellerId);
        const notification: CreateNotificationDto = {
            contractId: event.contractId,
            sellerId: event.sellerId,
            type: ENotificationType.CONTRACT_EXPIRED,
            channel: ENotificationChannel.WHATSAPP,
            content: `Olá ${seller.razao_social}, seu contrato foi cancelado. Por favor, entre em contato conosco.`,
            attemptNumber: 1,
        };

        this.eventEmitter.emit('notification.created', notification);
    }

    @OnEvent('contract.reminder')
    async handleContractReminderEvent(event: ContractReminderEvent) {
        const seller = await this.getSellerData(event.sellerId);
        const contract = await this.contractService.findOne(event.contractId);

        // Obtém o número da tentativa atual e o máximo de tentativas
        const tentativaAtual = event.tentativaAtual || 1;
        const maximoTentativas = event.maximoTentativas || 3;

        // Valida o número da tentativa
        if (tentativaAtual < 1 || tentativaAtual > 3) {
            this.logger.error(
                `[handleContractReminderEvent] Tentativa inválida: ${tentativaAtual}. Deve ser entre 1 e 3.`,
            );
            throw new Error(`Tentativa inválida: ${tentativaAtual}. Deve ser entre 1 e 3.`);
        }

        // Usa o template apropriado baseado na tentativa atual
        let mensagem: string;
        switch (tentativaAtual) {
            case 1:
                mensagem = CONTRACT_NOTIFICATION_TEMPLATES.FIRST_ATTEMPT(
                    seller.razao_social,
                    contract.signingUrl,
                );
                break;
            case 2:
                mensagem = CONTRACT_NOTIFICATION_TEMPLATES.SECOND_ATTEMPT(
                    seller.razao_social,
                    contract.signingUrl,
                );
                break;
            case 3:
                mensagem = CONTRACT_NOTIFICATION_TEMPLATES.THIRD_ATTEMPT(
                    seller.razao_social,
                    contract.signingUrl,
                );
                break;
        }

        this.logger.log(
            `[handleContractReminderEvent] Enviando mensagem personalizada ${tentativaAtual}ª notificação (primeiros 50 caracteres): ${mensagem.substring(0, 50)}...`,
        );

        // Verificação adicional da mensagem
        this.logger.log(
            `[handleContractReminderEvent] Tamanho total da mensagem: ${mensagem.length} caracteres`,
        );

        await this.notificationService.create({
            contractId: event.contractId,
            sellerId: event.sellerId,
            type: ENotificationType.SIGNATURE_REMINDER,
            channel: ENotificationChannel.WHATSAPP,
            content: mensagem,
            attemptNumber: tentativaAtual,
        });

        this.logger.log(
            `✅ Lembrete #${tentativaAtual}/${maximoTentativas} enviado para ${seller.razao_social}`,
        );
    }
}
