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
        });
    }

    async checkRateLimit(sellerId: string): Promise<boolean> {
        try {
            await this.rateLimiter.consume(sellerId);
            return true;
        } catch (error) {
            this.logger.warn(`Rate limit excedido para o vendedor ${sellerId}: ${error.message}`);
            return false;
        }
    }

    async resetRateLimit(sellerId: string): Promise<void> {
        try {
            await this.rateLimiter.delete(sellerId);
            this.logger.debug(`Rate limit resetado para o vendedor ${sellerId}`);
        } catch (error) {
            this.logger.error(
                `Erro ao resetar rate limit para o vendedor ${sellerId}: ${error.message}`,
            );
        }
    }

    private getRateLimitConfig(): RateLimitConfig {
        return {
            points: this.configService.get<number>('RATE_LIMIT_POINTS', this.defaultConfig.points),
            duration: this.configService.get<number>(
                'RATE_LIMIT_DURATION',
                this.defaultConfig.duration,
            ),
        };
    }
}
