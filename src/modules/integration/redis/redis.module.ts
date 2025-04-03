import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './services/redis.service';
import { Logger } from '@nestjs/common';

@Module({
    imports: [
        ConfigModule,
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const logger = new Logger('RedisModule');

                const host = configService.get<string>('REDIS_HOST');
                const password = configService.get<string>('REDIS_PASSWORD');

                logger.log(`Configurando BullModule com Redis Upstash em ${host}`);

                return {
                    redis: {
                        host,
                        port: 6379,
                        password,
                        tls: {
                            rejectUnauthorized: false,
                        },
                        connectTimeout: 10000,
                        enableReadyCheck: true,
                        autoResendUnfulfilledCommands: true,
                        lazyConnect: true,
                    },
                };
            },
            inject: [ConfigService],
        }),
    ],
    providers: [RedisService],
    exports: [BullModule, RedisService],
})
export class RedisModule {}
