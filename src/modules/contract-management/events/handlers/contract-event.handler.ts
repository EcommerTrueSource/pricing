import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ContractService } from '../../contract/services/contract.service';
import { NotificationService } from '../../notification/services/notification.service';
import { ENotificationType } from '../../notification/enums/notification-type.enum';
import { ENotificationChannel } from '../../notification/enums/notification-channel.enum';
import {
    ContractCreatedEvent,
    ContractSignedEvent,
    ContractExpiredEvent,
    ContractCancelledEvent,
    ContractReminderEvent,
} from '../contract.events';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateNotificationDto } from '../../notification/dtos/create-notification.dto';

@Injectable()
export class ContractEventHandler {
    constructor(
        private readonly contractService: ContractService,
        private readonly notificationService: NotificationService,
        private eventEmitter: EventEmitter2,
    ) {}

    @OnEvent('contract.created')
    async handleContractCreatedEvent(event: ContractCreatedEvent) {
        // Criar notificação de assinatura pendente
        await this.notificationService.create({
            contractId: event.contractId,
            sellerId: event.sellerId,
            type: ENotificationType.SIGNATURE_PENDING,
            channel: ENotificationChannel.WHATSAPP,
            content: 'Você tem um novo contrato para assinar',
            attemptNumber: 1,
        });
    }

    @OnEvent('contract.signed')
    async handleContractSignedEvent(event: ContractSignedEvent) {
        const notification: CreateNotificationDto = {
            contractId: event.contractId,
            sellerId: event.sellerId,
            type: ENotificationType.SIGNED,
            channel: ENotificationChannel.WHATSAPP,
            content: 'Seu contrato foi assinado com sucesso',
            attemptNumber: 1,
        };

        this.eventEmitter.emit('notification.created', notification);
    }

    @OnEvent('contract.expired')
    async handleContractExpiredEvent(event: ContractExpiredEvent) {
        // Criar notificação de contrato expirado
        await this.notificationService.create({
            contractId: event.contractId,
            sellerId: event.sellerId,
            type: ENotificationType.EXPIRED,
            channel: ENotificationChannel.WHATSAPP,
            content: 'Seu contrato expirou',
            attemptNumber: 1,
        });
    }

    @OnEvent('contract.cancelled')
    async handleContractCancelledEvent(event: ContractCancelledEvent) {
        const notification: CreateNotificationDto = {
            contractId: event.contractId,
            sellerId: event.sellerId,
            type: ENotificationType.CANCELLED,
            channel: ENotificationChannel.WHATSAPP,
            content: `Seu contrato foi cancelado. Motivo: ${event.reason}`,
            attemptNumber: 1,
        };

        this.eventEmitter.emit('notification.created', notification);
    }

    @OnEvent('contract.reminder')
    async handleContractReminderEvent(event: ContractReminderEvent) {
        // Criar notificação de lembrete
        await this.notificationService.create({
            contractId: event.contractId,
            sellerId: event.sellerId,
            type: ENotificationType.SIGNATURE_PENDING,
            channel: ENotificationChannel.WHATSAPP,
            content: `Lembrete: ${event.reminderType}`,
            attemptNumber: 1,
        });
    }
}
