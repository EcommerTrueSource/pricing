import { Module } from '@nestjs/common';
import { SystemSettingsService } from '../services/system-settings.service';
import { PrismaModule } from './prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [SystemSettingsService],
    exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
