import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvironmentService } from '../services/environment.service';

@Module({
    imports: [ConfigModule],
    providers: [EnvironmentService],
    exports: [EnvironmentService],
})
export class EnvironmentModule {}
