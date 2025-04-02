export enum ENotificationType {
    SIGNATURE_REMINDER = 'SIGNATURE_REMINDER',
    CONTRACT_EXPIRING = 'CONTRACT_EXPIRING',
    CONTRACT_SIGNED = 'CONTRACT_SIGNED',
    CONTRACT_EXPIRED = 'CONTRACT_EXPIRED',
}

// Mapeamento para o tipo do Prisma
export const mapNotificationTypeToPrisma = (
    type: ENotificationType,
): 'SIGNATURE_REMINDER' | 'CONTRACT_EXPIRING' | 'CONTRACT_SIGNED' | 'CONTRACT_EXPIRED' => {
    return type;
};
