export class NotificationSentEvent {
    constructor(
        public readonly notificationId: string,
        public readonly contractId: string,
        public readonly sellerId: string,
        public readonly channel: string,
        public readonly sentAt: Date,
        public readonly externalId: string,
    ) {}
}

export class NotificationDeliveredEvent {
    constructor(
        public readonly notificationId: string,
        public readonly contractId: string,
        public readonly sellerId: string,
        public readonly channel: string,
        public readonly deliveredAt: Date,
    ) {}
}

export class NotificationFailedEvent {
    constructor(
        public readonly notificationId: string,
        public readonly contractId: string,
        public readonly sellerId: string,
        public readonly channel: string,
        public readonly error: string,
        public readonly attemptNumber: number,
    ) {}
}

export class NotificationRetryEvent {
    constructor(
        public readonly notificationId: string,
        public readonly contractId: string,
        public readonly sellerId: string,
        public readonly channel: string,
        public readonly attemptNumber: number,
    ) {}
}
