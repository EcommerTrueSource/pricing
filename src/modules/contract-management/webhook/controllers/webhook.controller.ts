import { Body, Controller, Logger, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebhookService } from '../services/webhook.service';
import { WebhookDto } from '../dtos/webhook.dto';
import { Public } from '../../../security/decorators/public.decorator';

@ApiTags('Webhook')
@Controller('webhook')
export class WebhookController {
    private readonly logger = new Logger(WebhookController.name);

    constructor(private readonly webhookService: WebhookService) {}

    @Post('contract')
    @Public()
    @HttpCode(HttpStatus.CREATED)
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

    @Post('pedido-gerado-mercos')
    @Public()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Recebe webhook do Mercos quando um pedido é gerado' })
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
    async handleMercosWebhook(@Body() data: any) {
        try {
            this.logger.log('📥 Recebendo webhook do Mercos');
            this.logger.debug('Payload completo do Mercos:', JSON.stringify(data));

            // Verificar se o payload está no formato esperado (array)
            if (!Array.isArray(data) || data.length === 0) {
                this.logger.error('Formato inválido do webhook Mercos:', data);
                return {
                    success: false,
                    message: 'Formato inválido do webhook',
                };
            }

            const webhookItem = data[0];

            if (!webhookItem.body || !webhookItem.body.dados) {
                this.logger.error('Dados do cliente não encontrados no webhook:', webhookItem);
                return {
                    success: false,
                    message: 'Dados do cliente não encontrados',
                };
            }

            const clientData = webhookItem.body.dados;

            // Extrair e formatar os dados necessários
            const cnpj = clientData.cliente_cnpj;
            const email =
                Array.isArray(clientData.cliente_email) && clientData.cliente_email.length > 0
                    ? clientData.cliente_email[0]
                    : '';
            const telefone =
                Array.isArray(clientData.cliente_telefone) && clientData.cliente_telefone.length > 0
                    ? clientData.cliente_telefone[0].replace(/\D/g, '')
                    : '';

            if (!cnpj || !email || !telefone) {
                this.logger.error('Dados incompletos do cliente:', { cnpj, email, telefone });
                return {
                    success: false,
                    message: 'Dados do cliente incompletos',
                };
            }

            const webhookData: WebhookDto = {
                cnpj,
                email,
                telefone,
            };

            this.logger.log('Dados formatados para processamento:', webhookData);

            // Processar com o fluxo normal
            return this.webhookService.processContractWebhook(webhookData);
        } catch (error) {
            this.logger.error('Erro ao processar webhook do Mercos:', error);
            return {
                success: false,
                message: `Erro ao processar webhook: ${error.message}`,
            };
        }
    }
}
