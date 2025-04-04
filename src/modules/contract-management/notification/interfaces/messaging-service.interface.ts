import { Notification } from '../entities/notification.entity';

/**
 * Parâmetros para o método sendContractNotification
 */
export interface ContractNotificationParams {
    razaoSocial: string;
    contractUrl: string;
    sellerId: string;
    notificationAttempts: number;
    messageContent?: string; // Conteúdo personalizado da mensagem
}

/**
 * Interface para serviços de mensageria (ex: WhatsApp, Email)
 */
export interface IMessagingService {
    /**
     * Retorna o nome único do serviço (ex: WHATSAPP, EMAIL)
     */
    getServiceName(): string;

    /**
     * Envia uma notificação usando o serviço específico.
     * @param notification Objeto de notificação
     * @returns Promise com o ID da mensagem enviada ou null se não disponível
     */
    sendMessage(notification: Notification): Promise<{ messageId: string | null }>;

    /**
     * Envia uma notificação de contrato com link para assinatura
     * @param phoneNumber Número de telefone do destinatário
     * @param params Parâmetros contendo dados do contrato e do vendedor
     * @returns Promise com status de sucesso, ID da mensagem e possível erro
     */
    sendContractNotification(
        phoneNumber: string,
        params: ContractNotificationParams,
    ): Promise<{ success: boolean; messageId?: string | null; error?: string }>;
}
