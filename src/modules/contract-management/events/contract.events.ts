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

export class ContractReminderEvent {
    constructor(
        public readonly contractId: string,
        public readonly sellerId: string,
        public readonly reminderType: string,
        public readonly reminderDate: Date,
    ) {}
}
