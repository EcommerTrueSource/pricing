export class ContractCreatedEvent {
    constructor(
        public readonly contractId: string,
        public readonly sellerId: string,
        public readonly createdAt: Date,
    ) {}
}

export class ContractSignedEvent {
    constructor(
        public readonly contractId: string,
        public readonly sellerId: string,
        public readonly signedAt: Date,
    ) {}
}

export class ContractExpiredEvent {
    constructor(
        public readonly contractId: string,
        public readonly sellerId: string,
        public readonly expiredAt: Date,
    ) {}
}

export class ContractCancelledEvent {
    constructor(
        public readonly contractId: string,
        public readonly sellerId: string,
        public readonly cancelledAt: Date,
        public readonly reason: string,
    ) {}
}

export class ContractSentToSignatureEvent {
    constructor(
        public readonly contractId: string,
        public readonly sellerId: string,
        public readonly signingUrl: string,
        public readonly sentAt: Date,
    ) {}
}

/**
 * Evento disparado quando um contrato precisa de um lembrete de assinatura
 * - A primeira notificação é enviada na criação do contrato
 * - A segunda notificação é enviada 3 dias após a criação do contrato
 * - A terceira notificação é enviada 7 dias após a criação do contrato
 * - Notificações são enviadas apenas em dias úteis, às 12h00
 */
export class ContractReminderEvent {
    constructor(
        public readonly contractId: string,
        public readonly sellerId: string,
        public readonly reason: string,
        public readonly timestamp: Date,
        public readonly tentativaAtual: number,
        public readonly maximoTentativas: number,
    ) {}
}
