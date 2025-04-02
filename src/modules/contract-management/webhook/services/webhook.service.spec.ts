import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { BrasilApiService } from '../../../integration/brasil-api/services/brasil-api.service';
import { ContractService } from '../../contract/services/contract.service';
import { ContractTemplateService } from '../../template/services/contract-template.service';
import { GoogleDocsService } from '../../template/services/google-docs.service';
import { WebhookDto } from '../dtos/webhook.dto';
import { EContractStatus } from '../../contract/enums/contract-status.enum';

describe('WebhookService', () => {
    let service: WebhookService;

    const mockPrisma = {
        sellers: {
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        contracts: {
            findMany: jest.fn(),
        },
    };

    const mockBrasilApi = {
        getSellerData: jest.fn(),
    };

    const mockContractService = {
        create: jest.fn(),
        sendToSignature: jest.fn(),
    };

    const mockTemplateService = {
        getActiveTemplate: jest.fn(),
    };

    const mockGoogleDocs = {
        createFilledTemplate: jest.fn(),
        getDocument: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhookService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
                {
                    provide: BrasilApiService,
                    useValue: mockBrasilApi,
                },
                {
                    provide: ContractService,
                    useValue: mockContractService,
                },
                {
                    provide: ContractTemplateService,
                    useValue: mockTemplateService,
                },
                {
                    provide: GoogleDocsService,
                    useValue: mockGoogleDocs,
                },
            ],
        }).compile();

        service = module.get<WebhookService>(WebhookService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('processContractWebhook', () => {
        const webhookData: WebhookDto = {
            cnpj: '38.308.523/0001-72',
            email: 'gabrielnfc@gmail.com',
            telefone: '27992594304',
        };

        const brasilApiData = {
            razaoSocial: 'Empresa Teste',
            endereco: {
                logradouro: 'Rua Teste',
                numero: '123',
                bairro: 'Centro',
                municipio: 'São Paulo',
                uf: 'SP',
                cep: '01001-000',
            },
        };

        const template = {
            id: 'template-id',
            name: 'Template Teste',
            content: 'Conteúdo do template',
            version: '1.0',
            isActive: true,
        };

        const seller = {
            id: 'seller-id',
            cnpj: webhookData.cnpj,
            razao_social: brasilApiData.razaoSocial,
            email: webhookData.email,
            telefone: webhookData.telefone,
            endereco: 'Rua Teste, 123 - Centro, São Paulo/SP - CEP: 01001-000',
        };

        const contract = {
            id: 'contract-id',
            seller_id: seller.id,
            template_id: template.id,
            status: EContractStatus.PENDING_SIGNATURE,
            content: 'content',
            external_id: 'external-id',
            signing_url: 'https://example.com/sign',
            notification_attempts: 0,
            last_notification_at: new Date(),
            signed_at: null,
            expires_at: new Date(),
        };

        it('should create a new contract for a new seller', async () => {
            // Arrange
            mockBrasilApi.getSellerData.mockResolvedValue(brasilApiData);
            mockPrisma.sellers.findUnique.mockResolvedValue(null);
            mockPrisma.sellers.create.mockResolvedValue(seller);
            mockTemplateService.getActiveTemplate.mockResolvedValue(template);
            mockGoogleDocs.createFilledTemplate.mockResolvedValue('doc-id');
            mockGoogleDocs.getDocument.mockResolvedValue(Buffer.from('content'));
            mockContractService.create.mockResolvedValue(contract);
            mockContractService.sendToSignature.mockResolvedValue(contract);

            // Act
            const result = await service.processContractWebhook(webhookData);

            // Assert
            expect(result).toEqual({
                success: true,
                message: 'Contrato criado e enviado para assinatura com sucesso',
                data: {
                    contractId: contract.id,
                    sellerId: seller.id,
                    signingUrl: contract.signing_url,
                },
            });

            expect(mockBrasilApi.getSellerData).toHaveBeenCalledWith(webhookData.cnpj);
            expect(mockPrisma.sellers.findUnique).toHaveBeenCalledWith({
                where: { cnpj: webhookData.cnpj },
                include: {
                    contracts: {
                        where: {
                            status: EContractStatus.SIGNED,
                        },
                    },
                },
            });
            expect(mockPrisma.sellers.create).toHaveBeenCalledWith({
                data: {
                    cnpj: webhookData.cnpj,
                    razao_social: brasilApiData.razaoSocial,
                    email: webhookData.email,
                    telefone: webhookData.telefone,
                    endereco: expect.any(String),
                },
            });
            expect(mockTemplateService.getActiveTemplate).toHaveBeenCalled();
            expect(mockGoogleDocs.createFilledTemplate).toHaveBeenCalled();
            expect(mockGoogleDocs.getDocument).toHaveBeenCalled();
            expect(mockContractService.create).toHaveBeenCalled();
            expect(mockContractService.sendToSignature).toHaveBeenCalled();
        });

        it('should update existing seller and create contract if no signed contract exists', async () => {
            // Arrange
            mockBrasilApi.getSellerData.mockResolvedValue(brasilApiData);
            mockPrisma.sellers.findUnique.mockResolvedValue({
                ...seller,
                contracts: [],
            });
            mockPrisma.sellers.update.mockResolvedValue(seller);
            mockTemplateService.getActiveTemplate.mockResolvedValue(template);
            mockGoogleDocs.createFilledTemplate.mockResolvedValue('doc-id');
            mockGoogleDocs.getDocument.mockResolvedValue(Buffer.from('content'));
            mockContractService.create.mockResolvedValue(contract);
            mockContractService.sendToSignature.mockResolvedValue(contract);

            // Act
            const result = await service.processContractWebhook(webhookData);

            // Assert
            expect(result).toEqual({
                success: true,
                message: 'Contrato criado e enviado para assinatura com sucesso',
                data: {
                    contractId: contract.id,
                    sellerId: seller.id,
                    signingUrl: contract.signing_url,
                },
            });

            expect(mockPrisma.sellers.update).toHaveBeenCalledWith({
                where: { id: seller.id },
                data: {
                    email: webhookData.email,
                    telefone: webhookData.telefone,
                },
            });
        });

        it('should not create contract if seller already has a signed contract', async () => {
            // Arrange
            mockBrasilApi.getSellerData.mockResolvedValue(brasilApiData);
            mockPrisma.sellers.findUnique.mockResolvedValue({
                ...seller,
                contracts: [{ id: 'contract-id', status: EContractStatus.SIGNED }],
            });
            mockPrisma.sellers.update.mockResolvedValue(seller);

            // Act
            const result = await service.processContractWebhook(webhookData);

            // Assert
            expect(result).toEqual({
                success: true,
                message: 'Vendedor já possui contrato assinado',
            });

            expect(mockPrisma.sellers.update).toHaveBeenCalledWith({
                where: { id: seller.id },
                data: {
                    email: webhookData.email,
                    telefone: webhookData.telefone,
                },
            });
            expect(mockContractService.create).not.toHaveBeenCalled();
        });
    });
});
