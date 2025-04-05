import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiterService } from '../../../../shared/services/rate-limiter.service';
import { AUTENTIQUE_WEBHOOK_RATE_LIMIT } from '../decorators/rate-limit.decorator';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WebhookRateLimiterGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly rateLimiterService: RateLimiterService,
        private readonly configService: ConfigService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Se estiver em ambiente de teste, permite todas as requisições
        if (this.configService.get('NODE_ENV') === 'test') {
            return true;
        }

        const isWebhook = this.reflector.get<boolean>(
            AUTENTIQUE_WEBHOOK_RATE_LIMIT,
            context.getHandler(),
        );

        if (!isWebhook) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const ip = request.ip;
        const key = `autentique-webhook:${ip}`;

        return this.rateLimiterService.checkRateLimit(key);
    }
}
