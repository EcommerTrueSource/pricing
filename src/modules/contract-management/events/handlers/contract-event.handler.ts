import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ContractService } from '../../contract/services/contract.service';
import { NotificationService } from '../../notification/services/notification.service';
import { ENotificationType } from '../../notification/enums/notification-type.enum';
import { ENotificationChannel } from '../../notification/enums/notification-channel.enum';
import { PrismaService } from '../../../../shared/services/prisma.service';
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
        private readonly prisma: PrismaService,
        private eventEmitter: EventEmitter2,
    ) {}

    private async getSellerData(sellerId: string) {
        return this.prisma.sellers.findUnique({
            where: { id: sellerId },
        });
    }

    @OnEvent('contract.created')
    async handleContractCreatedEvent(event: ContractCreatedEvent) {
        const seller = await this.getSellerData(event.sellerId);
        const contract = await this.contractService.findOne(event.contractId);

        await this.notificationService.create({
            contractId: event.contractId,
            sellerId: event.sellerId,
            type: ENotificationType.SIGNATURE_REMINDER,
            channel: ENotificationChannel.WHATSAPP,
            content: `Olá ${seller.razao_social}, seu contrato está aguardando assinatura. Por favor, acesse o link para assinar: ${contract.signingUrl}`,
            attemptNumber: 1,
        });
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

        await this.notificationService.create({
            contractId: event.contractId,
            sellerId: event.sellerId,
            type: ENotificationType.SIGNATURE_REMINDER,
            channel: ENotificationChannel.WHATSAPP,
            content: `Olá ${seller.razao_social}, seu contrato está aguardando assinatura. Por favor, acesse o link para assinar: ${contract.signingUrl}`,
            attemptNumber: 1,
        });
    }
}
