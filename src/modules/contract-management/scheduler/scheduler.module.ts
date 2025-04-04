import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ContractReminderScheduler } from './services/contract-reminder.scheduler';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SchedulerController } from './controllers/scheduler.controller';
import { SecurityModule } from '../../security/security.module';
import { ContractModule } from '../contract/contract.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        PrismaModule,
        EventEmitterModule,
        SecurityModule,
        ContractModule,
        NotificationModule,
    ],
    controllers: [SchedulerController],
    providers: [ContractReminderScheduler],
    exports: [ContractReminderScheduler],
})
export class SchedulerModule {}
