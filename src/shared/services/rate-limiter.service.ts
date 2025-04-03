import { Injectable, Logger } from '@nestjs/common';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { ConfigService } from '@nestjs/config';

interface RateLimitConfig {
    points: number;
    duration: number;
}

@Injectable()
export class RateLimiterService {
    private readonly logger = new Logger(RateLimiterService.name);
    private readonly rateLimiter: RateLimiterMemory;
    private readonly defaultConfig: RateLimitConfig = {
        points: 5, // 5 mensagens
        duration: 24 * 60 * 60, // 24 horas
    };

    constructor(private readonly configService: ConfigService) {
        const config = this.getRateLimitConfig();
        this.rateLimiter = new RateLimiterMemory({
            points: config.points,
            duration: config.duration,
            blockDuration: config.duration * 2, // Bloqueia por 2x o tempo normal
            keyPrefix: 'rate-limit:', // Prefixo para as chaves no Redis
        });
    }

    async checkRateLimit(key: string): Promise<boolean> {
        try {
            const result = await this.rateLimiter.consume(key);
            this.logger.debug(
                `Rate limit check para ${key}: ${result.remainingPoints} pontos restantes`,
            );
            return result.remainingPoints > 0;
        } catch (error) {
            if (error instanceof Error) {
                this.logger.warn(`Rate limit excedido para ${key}: ${error.message}`);
            }
            return false;
        }
    }

    async resetRateLimit(key: string): Promise<void> {
        try {
            await this.rateLimiter.delete(key);
            this.logger.debug(`Rate limit resetado para ${key}`);
        } catch (error) {
            this.logger.error(`Erro ao resetar rate limit para ${key}: ${error.message}`);
            throw error;
        }
    }

    private getRateLimitConfig(): RateLimitConfig {
        const points = this.configService.get<number>('RATE_LIMIT_POINTS');
        const duration = this.configService.get<number>('RATE_LIMIT_DURATION');

        if (points && duration) {
            return { points, duration };
        }

        this.logger.warn(
            'Usando configuração padrão de rate limit. Configure RATE_LIMIT_POINTS e RATE_LIMIT_DURATION no .env',
        );
        return this.defaultConfig;
    }
}
