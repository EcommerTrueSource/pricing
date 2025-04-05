import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Logger,
    UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhookService } from '../services/webhook.service';
import { AutentiqueWebhookEventDto } from '../dtos/webhook-event.dto';
import { AutentiqueWebhookRateLimit } from '../decorators/rate-limit.decorator';
import { AutentiqueWebhookRateLimitInterceptor } from '../interceptors/rate-limit.interceptor';

@ApiTags('Autentique Webhook')
@Controller('autentique/webhook')
@UseInterceptors(AutentiqueWebhookRateLimitInterceptor)
export class WebhookController {
    private readonly logger = new Logger(WebhookController.name);

    constructor(private readonly webhookService: WebhookService) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    @AutentiqueWebhookRateLimit()
    @ApiOperation({
        summary: 'Endpoint para receber eventos da Autentique',
        description:
            'Recebe eventos de webhook da Autentique e processa as atualizações de status dos contratos.',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Evento processado com sucesso',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Payload inválido',
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: 'Erro interno do servidor',
    })
    async handleWebhookEvent(@Body() event: AutentiqueWebhookEventDto): Promise<void> {
        this.logger.log(`Recebido evento do webhook: ${event.event.type}`);
        await this.webhookService.handleWebhookEvent(event);
    }
}
