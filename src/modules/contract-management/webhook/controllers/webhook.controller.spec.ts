import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from '../services/webhook.service';
import { WebhookDto } from '../dtos/webhook.dto';

describe('WebhookController', () => {
    let controller: WebhookController;

    const mockWebhookService = {
        processContractWebhook: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [WebhookController],
            providers: [
                {
                    provide: WebhookService,
                    useValue: mockWebhookService,
                },
            ],
        }).compile();

        controller = module.get<WebhookController>(WebhookController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('handleContractWebhook', () => {
        const webhookData: WebhookDto = {
            cnpj: '38.308.523/0001-72',
            email: 'gabrielnfc@gmail.com',
            telefone: '27992594304',
        };

        it('should process webhook successfully', async () => {
            // Arrange
            const expectedResponse = {
                success: true,
                message: 'Contrato criado e enviado para assinatura com sucesso',
                data: {
                    contractId: 'contract-id',
                    sellerId: 'seller-id',
                    signingUrl: 'https://example.com/sign',
                },
            };

            mockWebhookService.processContractWebhook.mockResolvedValue(expectedResponse);

            // Act
            const result = await controller.handleContractWebhook(webhookData);

            // Assert
            expect(result).toEqual(expectedResponse);
            expect(mockWebhookService.processContractWebhook).toHaveBeenCalledWith(webhookData);
        });

        it('should handle errors from service', async () => {
            // Arrange
            const error = new Error('Erro ao processar webhook');
            mockWebhookService.processContractWebhook.mockRejectedValue(error);

            // Act & Assert
            await expect(controller.handleContractWebhook(webhookData)).rejects.toThrow(error);
        });
    });
});
