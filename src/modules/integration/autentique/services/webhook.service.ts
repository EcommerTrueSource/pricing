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

        // Log mais detalhado do payload completo
        this.logger.debug('Payload completo recebido:', JSON.stringify(event, null, 2));

        try {
            // Extrair o ID do documento diretamente
            const documentId = this.extractDocumentId(event);

            if (documentId) {
                this.logger.log(`🔍 Documento identificado: ${documentId}`);

                switch (event.event.type) {
                    case EAutentiqueEventType.SIGNATURE_ACCEPTED:
                        await this.processDocumentEvent(
                            documentId,
                            EContractStatus.SIGNED,
                            'Assinatura aceita',
                        );
                        break;
                    case EAutentiqueEventType.SIGNATURE_REJECTED:
                        const reason = this.extractReasonFromEvent(event) || 'Não especificado';
                        await this.processDocumentEvent(
                            documentId,
                            EContractStatus.CANCELLED,
                            `Assinatura rejeitada. Motivo: ${reason}`,
                        );
                        break;
                    case EAutentiqueEventType.DOCUMENT_FINISHED:
                        await this.processDocumentEvent(
                            documentId,
                            EContractStatus.SIGNED,
                            'Documento finalizado',
                        );
                        break;
                    default:
                        this.logger.debug(`Evento não tratado: ${event.event.type}`);
                }
            } else {
                this.logger.error('❌ ID do documento não encontrado no payload');
            }
        } catch (error) {
            this.logger.error(
                `❌ Erro ao processar evento do webhook: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    // Método para extrair o ID do documento de qualquer local possível no payload
    private extractDocumentId(event: any): string | null {
        try {
            // Lista de caminhos possíveis para o ID do documento
            const possiblePaths = [
                // Caminho direto no evento principal
                event.event?.data?.document,

                // Caminho na propriedade objeto
                event.event?.data?.object?.document,
                event.event?.data?.object?.id,

                // Caminhos em eventos dentro do objeto
                ...(Array.isArray(event.event?.data?.events)
                    ? event.event.data.events.map((evt) => evt.document)
                    : []),

                // Propriedade externa
                event.document,
            ];

            // Filtrar valores nulos e retornar o primeiro válido
            const documentId = possiblePaths.find((path) => path && typeof path === 'string');

            // Log detalhado para debugging
            this.logger.debug(
                `🔍 Caminhos possíveis para o ID: ${JSON.stringify(possiblePaths.map((p) => p || 'null'))}`,
            );
            this.logger.debug(`🔍 ID do documento encontrado: ${documentId || 'não encontrado'}`);

            return documentId || null;
        } catch (error) {
            this.logger.error(`❌ Erro ao extrair ID do documento: ${error.message}`);
            return null;
        }
    }

    // Método para extrair a razão de rejeição
    private extractReasonFromEvent(event: any): string | null {
        try {
            return (
                event.event?.data?.reason ||
                event.event?.data?.object?.reason ||
                (Array.isArray(event.event?.data?.events) &&
                    event.event.data.events.find((evt) => evt.reason)?.reason) ||
                null
            );
        } catch (error) {
            return null;
        }
    }

    // Método centralizado para processar eventos de documento
    private async processDocumentEvent(
        documentId: string,
        newStatus: EContractStatus,
        message: string,
    ): Promise<void> {
        this.logger.log(`📄 ${message} para o documento: ${documentId}`);

        // Buscar o contrato pelo ID do documento na Autentique
        const contract = await this.prisma.contracts.findFirst({
            where: { external_id: documentId },
            include: { sellers: true },
        });

        if (!contract) {
            this.logger.warn(`⚠️ Contrato não encontrado para o documento: ${documentId}`);
            return;
        }

        // Verificar se o contrato já está no estado desejado
        if (contract.status === newStatus) {
            this.logger.log(
                `ℹ️ Contrato ${contract.id} já está com status ${newStatus}. Ignorando evento.`,
            );
            return;
        }

        // Atualizar o status do contrato
        await this.prisma.contracts.update({
            where: { id: contract.id },
            data: {
                status: newStatus,
                ...(newStatus === EContractStatus.SIGNED ? { signed_at: new Date() } : {}),
            },
        });

        this.logger.log(`✅ Contrato ${contract.id} atualizado para status ${newStatus}`);

        // Criar notificação apropriada
        try {
            const notificationType =
                newStatus === EContractStatus.SIGNED
                    ? ENotificationType.CONTRACT_SIGNED
                    : ENotificationType.CONTRACT_EXPIRED;

            const content =
                newStatus === EContractStatus.SIGNED
                    ? `Contrato assinado com sucesso! Obrigado por sua colaboração.`
                    : `${message}`;

            const notificationDto: CreateNotificationDto = {
                contractId: contract.id,
                sellerId: contract.seller_id,
                type: notificationType,
                channel: ENotificationChannel.WHATSAPP,
                content,
                attemptNumber: 1,
            };

            await this.notificationService.create(notificationDto);
            this.logger.log(
                `✅ Notificação de ${notificationType} criada para o contrato ${contract.id}`,
            );
        } catch (error) {
            this.logger.warn(
                `⚠️ Não foi possível criar notificação para o contrato ${contract.id}: ${error.message}`,
            );
        }
    }
}
