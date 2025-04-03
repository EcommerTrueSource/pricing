import { Notification } from '../entities/notification.entity';

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
}
