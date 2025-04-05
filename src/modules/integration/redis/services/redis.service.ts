import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { IRedisService } from '../interfaces/redis-service.interface';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements IRedisService {
    private readonly logger = new Logger(RedisService.name);
    private readonly redis: Redis;
    private isConnected = false;

    constructor(private readonly configService: ConfigService) {
        const host = this.configService.get<string>('REDIS_HOST');
        const password = this.configService.get<string>('REDIS_PASSWORD');
        const isTest = this.configService.get<string>('NODE_ENV') === 'test';

        this.logger.log(`Iniciando conexão com Redis Upstash em ${host}`);

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
            connectTimeout: 30000,
            lazyConnect: !isTest,
        });

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.redis.on('error', (error) => {
            this.logger.error(`Redis connection error: ${error.message}`, error.stack);
            this.isConnected = false;
        });

        this.redis.on('connect', () => {
            this.logger.log('Redis connection established');
            this.isConnected = true;
        });

        this.redis.on('ready', () => {
            this.logger.log('Redis connection is ready');
            this.isConnected = true;
        });

        this.redis.on('close', () => {
            this.logger.log('Redis connection closed');
            this.isConnected = false;
        });

        this.redis.on('reconnecting', () => {
            this.logger.log('Redis reconnecting...');
        });
    }

    private async ensureConnection(): Promise<void> {
        if (!this.isConnected) {
            try {
                await this.redis.connect();
            } catch (error) {
                this.logger.error('Failed to connect to Redis', error);
                throw error;
            }
        }
    }

    async set(key: string, value: string, ttl?: number): Promise<void> {
        await this.ensureConnection();
        try {
            if (ttl) {
                await this.redis.set(key, value, 'EX', ttl);
            } else {
                await this.redis.set(key, value);
            }
        } catch (error) {
            this.logger.error(`Error setting key ${key}: ${error.message}`);
            throw error;
        }
    }

    async get(key: string): Promise<string | null> {
        await this.ensureConnection();
        try {
            return await this.redis.get(key);
        } catch (error) {
            this.logger.error(`Error getting key ${key}: ${error.message}`);
            throw error;
        }
    }

    async del(key: string): Promise<void> {
        await this.ensureConnection();
        try {
            await this.redis.del(key);
        } catch (error) {
            this.logger.error(`Error deleting key ${key}: ${error.message}`);
            throw error;
        }
    }

    async lpush(key: string, value: string): Promise<void> {
        await this.ensureConnection();
        try {
            await this.redis.lpush(key, value);
        } catch (error) {
            this.logger.error(`Error pushing to list ${key}: ${error.message}`);
            throw error;
        }
    }

    async rpop(key: string): Promise<string | null> {
        await this.ensureConnection();
        try {
            return await this.redis.rpop(key);
        } catch (error) {
            this.logger.error(`Error popping from list ${key}: ${error.message}`);
            throw error;
        }
    }

    async exists(key: string): Promise<boolean> {
        await this.ensureConnection();
        try {
            const result = await this.redis.exists(key);
            return result === 1;
        } catch (error) {
            this.logger.error(`Error checking existence of key ${key}: ${error.message}`);
            throw error;
        }
    }

    async llen(key: string): Promise<number> {
        await this.ensureConnection();
        try {
            return await this.redis.llen(key);
        } catch (error) {
            this.logger.error(`Error getting list length for ${key}: ${error.message}`);
            throw error;
        }
    }
}
