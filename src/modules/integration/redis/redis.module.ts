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
                const isTest = configService.get<string>('NODE_ENV') === 'test';

                logger.log(`Configurando BullModule com Redis Upstash em ${host}`);

                return {
                    redis: {
                        host,
                        port: 6379,
                        password,
                        tls: {
                            rejectUnauthorized: false,
                        },
                        connectTimeout: 30000,
                        lazyConnect: !isTest, // Não usar lazyConnect em testes
                        retryStrategy: (times) => {
                            const delay = Math.min(times * 50, 2000);
                            return delay;
                        },
                        maxRetriesPerRequest: 3,
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
