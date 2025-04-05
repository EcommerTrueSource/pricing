import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import Redis from 'ioredis-mock';
import { BullModuleOptions } from '@nestjs/bull';
import { RedisOptions } from 'ioredis';

@Module({
    imports: [
        ConfigModule,
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (): Promise<BullModuleOptions> => {
                const redisMock = new Redis();

                // Configura o Redis para não fechar a conexão automaticamente
                redisMock.on('error', (err) => {
                    console.error('Redis Mock Error:', err);
                });

                return {
                    redis: {
                        host: 'localhost',
                        port: 6379,
                        enableReadyCheck: false,
                        maxRetriesPerRequest: null,
                    } as RedisOptions,
                };
            },
        }),
    ],
    exports: [BullModule],
})
export class RedisTestModule {}
