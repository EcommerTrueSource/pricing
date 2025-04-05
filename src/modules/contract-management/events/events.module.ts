import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ContractEventHandler } from './handlers/contract-event.handler';
import { NotificationEventHandler } from './handlers/notification-event.handler';
import { IntegrationModule } from '../../integration/integration.module';
import { ContractModule } from '../contract/contract.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../../../shared/modules/prisma.module';

@Module({
    imports: [
        EventEmitterModule,
        IntegrationModule,
        ContractModule,
        NotificationModule,
        PrismaModule,
    ],
    providers: [ContractEventHandler, NotificationEventHandler],
})
export class EventsModule {}
