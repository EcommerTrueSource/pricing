import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ContractService } from '../contract/services/contract.service';
import { NotificationService } from '../notification/services/notification.service';
import { ContractEventHandler } from './handlers/contract-event.handler';
import { NotificationEventHandler } from './handlers/notification-event.handler';

@Module({
    imports: [EventEmitterModule.forRoot()],
    providers: [
        ContractEventHandler,
        NotificationEventHandler,
        ContractService,
        NotificationService,
    ],
    exports: [EventEmitterModule],
})
export class EventsModule {}
