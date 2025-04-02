import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebhookService } from '../services/webhook.service';
import { WebhookDto } from '../dtos/webhook.dto';

@ApiTags('Webhook')
@Controller('webhook')
export class WebhookController {
    private readonly logger = new Logger(WebhookController.name);

    constructor(private readonly webhookService: WebhookService) {}

    @Post('contract')
    @ApiOperation({ summary: 'Recebe webhook para criação de contrato' })
    @ApiResponse({
        status: 201,
        description: 'Contrato criado e enviado para assinatura com sucesso',
        schema: {
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
                data: {
                    type: 'object',
                    properties: {
                        contractId: { type: 'string' },
                        sellerId: { type: 'string' },
                        signingUrl: { type: 'string' },
                    },
                },
            },
        },
    })
    async handleContractWebhook(@Body() data: WebhookDto) {
        this.logger.log('📥 Recebendo webhook para criação de contrato:', data);
        return this.webhookService.processContractWebhook(data);
    }
}
