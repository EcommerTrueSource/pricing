import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { IRedisService } from '../interfaces/redis-service.interface';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements IRedisService {
    private readonly logger = new Logger(RedisService.name);
    private readonly redis: Redis;

    constructor(private readonly configService: ConfigService) {
        const host = this.configService.get<string>('REDIS_HOST');
        const password = this.configService.get<string>('REDIS_PASSWORD');

        this.logger.log(`Iniciando conexão com Redis Upstash em ${host}`);

        // Configuração do Redis para Upstash
        this.redis = new Redis({
            host,
            port: 6379,
            password,
            tls: {
                rejectUnauthorized: false,
            },
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
            connectTimeout: 10000,
            enableReadyCheck: true,
            autoResendUnfulfilledCommands: true,
            lazyConnect: true,
        });

        this.redis.on('error', (error) => {
            this.logger.error(`Redis connection error: ${error.message}`, error.stack);
        });

        this.redis.on('connect', () => {
            this.logger.log('Redis connection established');
        });

        this.redis.on('ready', () => {
            this.logger.log('Redis connection is ready');
        });

        this.redis.on('close', () => {
            this.logger.log('Redis connection closed');
        });
    }

    async set(key: string, value: string, ttl?: number): Promise<void> {
        try {
            if (ttl) {
                await this.redis.set(key, value, 'EX', ttl);
            } else {
                await this.redis.set(key, value);
            }
        } catch (error) {
            this.logger.error(`Failed to set key ${key}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async get(key: string): Promise<string | null> {
        try {
            return await this.redis.get(key);
        } catch (error) {
            this.logger.error(`Failed to get key ${key}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.redis.del(key);
        } catch (error) {
            this.logger.error(`Failed to delete key ${key}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async lpush(key: string, value: string): Promise<void> {
        try {
            await this.redis.lpush(key, value);
        } catch (error) {
            this.logger.error(`Failed to lpush to key ${key}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async rpop(key: string): Promise<string | null> {
        try {
            return await this.redis.rpop(key);
        } catch (error) {
            this.logger.error(`Failed to rpop from key ${key}: ${error.message}`, error.stack);
            throw error;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            return (await this.redis.exists(key)) === 1;
        } catch (error) {
            this.logger.error(
                `Failed to check existence of key ${key}: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }

    async llen(key: string): Promise<number> {
        try {
            return await this.redis.llen(key);
        } catch (error) {
            this.logger.error(`Failed to get length of list ${key}: ${error.message}`, error.stack);
            throw error;
        }
    }
}
