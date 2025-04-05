import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { WebhookRateLimiterGuard } from '../guards/webhook-rate-limiter.guard';

export const AUTENTIQUE_WEBHOOK_RATE_LIMIT = 'autentique_webhook_rate_limit';

export function AutentiqueWebhookRateLimit() {
    return applyDecorators(
        SetMetadata(AUTENTIQUE_WEBHOOK_RATE_LIMIT, true),
        UseGuards(WebhookRateLimiterGuard),
    );
}
