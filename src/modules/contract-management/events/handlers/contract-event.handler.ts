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

            const mensagem = `Olá *${seller.razao_social}*! 👋

Esperamos que esteja tudo bem com você.

Somos da *True Source* e gostaríamos de informá-lo(a) sobre uma atualização importante na nossa política de preço mínimo autorizado.

📝 Segue o link do contrato para assinatura: ${event.signingUrl}

⏱️ *Prazo para assinatura:* 15 dias a partir do recebimento desta mensagem.

Além disso, pedimos gentilmente que nos informe:
• URLs dos sites onde vende nossos produtos
• Marketplaces onde atua
• Nome da loja utilizado

🔗 O envio deve ser feito através do formulário:
https://forms.gle/A7y4JjwpA71tjoko7

Estamos à disposição para esclarecer qualquer dúvida!

Agradecemos sua parceria e atenção! 🙏

Cordialmente,
*Equipe True Source*`;

            this.logger.log(
                `[handleContractSent] Mensagem personalizada gerada (tamanho: ${mensagem.length})`,
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

        // Texto personalizado com base na tentativa atual
        let mensagem = '';

        if (tentativaAtual === 1) {
            // Primeira tentativa - Mensagem padrão
            mensagem = `Olá *${seller.razao_social}*! 👋

Esperamos que esteja tudo bem com você.

Somos da *True Source* e gostaríamos de informá-lo(a) sobre uma atualização importante na nossa política de preço mínimo autorizado.

📝 Segue o link do contrato para assinatura: ${contract.signingUrl}

⏱️ *Prazo para assinatura:* 15 dias a partir do recebimento desta mensagem.

Além disso, pedimos gentilmente que nos informe:
• URLs dos sites onde vende nossos produtos
• Marketplaces onde atua
• Nome da loja utilizado

🔗 O envio deve ser feito através do formulário:
https://forms.gle/A7y4JjwpA71tjoko7

Estamos à disposição para esclarecer qualquer dúvida!

Agradecemos sua parceria e atenção! 🙏

Cordialmente,
*Equipe True Source*`;
        } else if (tentativaAtual === 2) {
            // Segunda tentativa - Indica que é a 2ª tentativa (3 dias depois)
            mensagem = `Olá *${seller.razao_social}*! 👋

Esperamos encontrá-lo(a) bem.

📢 Gostaríamos de gentilmente lembrá-lo(a) sobre a *atualização da nossa política de preço mínimo autorizado*.

Notamos que o contrato enviado há 3 dias ainda aguarda sua assinatura:
🔗 ${contract.signingUrl}

⏱️ *Lembramos que o prazo para assinatura é de 15 dias* a partir do primeiro contato.

Também aguardamos as informações sobre:
• Sites onde comercializa nossos produtos
• Marketplaces onde atua
• Nome da sua loja

📋 Preencha essas informações no formulário:
https://forms.gle/A7y4JjwpA71tjoko7

Nossa equipe está à disposição para ajudá-lo(a) com o processo de assinatura ou esclarecer dúvidas.

Agradecemos sua atenção e parceria contínua! 🤝

Atenciosamente,
*Equipe True Source*`;
        } else {
            // Terceira tentativa - Enfatiza que é a ÚLTIMA tentativa (7 dias depois)
            mensagem = `Olá *${seller.razao_social}*! 👋

*⚠️ AVISO IMPORTANTE*

Esperamos que esteja bem. Esta é nossa *terceira e última comunicação* referente à atualização da política de preço mínimo autorizado da True Source.

O contrato enviado há 7 dias ainda aguarda sua assinatura, e o prazo está se esgotando:
🔗 ${contract.signingUrl}

⏱️ Para mantermos nossa parceria comercial ativa, é *indispensável* a assinatura deste documento dentro do prazo estabelecido de 15 dias.

Lembramos também da importância de nos informar:
• Sites onde comercializa nossos produtos
• Marketplaces onde atua
• Nome da sua loja

📋 Através do formulário:
https://forms.gle/A7y4JjwpA71tjoko7

Nossa equipe está inteiramente à disposição para auxiliá-lo(a) no processo de assinatura.

Contamos com sua compreensão e resposta para continuarmos com nossa parceria comercial. 🤝

Atenciosamente,
*Equipe True Source*`;
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
