import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/services/prisma.service';
import { EContractStatus } from '../src/modules/contract-management/contract/enums/contract-status.enum';
import { ENotificationStatus } from '../src/modules/contract-management/notification/enums/notification-status.enum';
import { ENotificationType } from '../src/modules/contract-management/notification/enums/notification-type.enum';
import { ENotificationChannel } from '../src/modules/contract-management/notification/enums/notification-channel.enum';
import { BrasilApiService } from '../src/modules/integration/brasil-api/services/brasil-api.service';
import { ContractTemplateService } from '../src/modules/contract-management/template/services/contract-template.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RateLimiterModule } from '../src/shared/modules/rate-limiter.module';
import { ValidationModule } from '../src/shared/modules/validation.module';
import { IntegrationModule } from '../src/modules/integration/integration.module';
import { GoogleDocsService } from '../src/modules/contract-management/template/services/google-docs.service';
import { ConfigModule } from '@nestjs/config';

describe('Contract Flow (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let brasilApiService: BrasilApiService;
    let contractTemplateService: ContractTemplateService;
    let jwtService: JwtService;
    let configService: ConfigService;
    let authToken: string;
    let signingUrl: string;
    let createContractDto: any;
    let sellerId: string;
    let contractId: string;
    let googleDocsService: GoogleDocsService;

    // Dados recebidos do webhook
    const webhookData = {
        cnpj: '38308523000172', // CNPJ válido da VIVO
        email: 'gabrielnfc@gmail.com',
        telefone: '27992594304',
    };

    // Função para formatar CNPJ
    const formatCnpj = (cnpj: string): string => {
        // Remove todos os caracteres não numéricos
        const cleanCnpj = cnpj.replace(/\D/g, '');
        // Aplica a formatação XX.XXX.XXX/XXXX-XX
        return cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    };

    // Função para formatar data por extenso
    const formatDate = (date: Date): string => {
        const months = [
            'janeiro',
            'fevereiro',
            'março',
            'abril',
            'maio',
            'junho',
            'julho',
            'agosto',
            'setembro',
            'outubro',
            'novembro',
            'dezembro',
        ];

        const day = date.getDate().toString().padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        return `${day} de ${month} de ${year}`;
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                AppModule,
                RateLimiterModule,
                ValidationModule,
                IntegrationModule,
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.local',
                }),
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        prisma = moduleFixture.get<PrismaService>(PrismaService);
        brasilApiService = moduleFixture.get<BrasilApiService>(BrasilApiService);
        contractTemplateService =
            moduleFixture.get<ContractTemplateService>(ContractTemplateService);
        googleDocsService = moduleFixture.get<GoogleDocsService>(GoogleDocsService);
        jwtService = moduleFixture.get<JwtService>(JwtService);
        configService = moduleFixture.get<ConfigService>(ConfigService);

        // Verificar configurações críticas
        console.log('🔧 Verificando configurações...');
        const googleDocId = configService.get('GOOGLE_DOC_ID');
        const brasilApiBaseUrl = configService.get('BRASIL_API_BASE_URL');
        const googleClientEmail = configService.get('GOOGLE_CLIENT_EMAIL');
        const googlePrivateKey = configService.get('GOOGLE_PRIVATE_KEY');

        console.log('Configurações encontradas:', {
            googleDocId: !!googleDocId,
            brasilApiBaseUrl: !!brasilApiBaseUrl,
            googleClientEmail: !!googleClientEmail,
            googlePrivateKey: !!googlePrivateKey,
        });

        if (!googleDocId || !brasilApiBaseUrl || !googleClientEmail || !googlePrivateKey) {
            throw new Error('Configurações necessárias não encontradas');
        }

        // Gerar token de autenticação
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('JWT_SECRET não configurado');
        }

        authToken = jwtService.sign({ sub: 'test-user', roles: ['ADMIN'] }, { secret });

        await app.init();
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    describe('Fluxo completo de contrato', () => {
        let brasilApiData: any;
        let autentiqueDocId: string;

        beforeAll(async () => {
            // Busca dados da Brasil API
            try {
                console.log('📄 Buscando dados na Brasil API para CNPJ:', webhookData.cnpj);
                brasilApiData = await brasilApiService.getSellerData(webhookData.cnpj);
                console.log(
                    '✅ Dados recebidos da Brasil API:',
                    JSON.stringify(brasilApiData, null, 2),
                );

                expect(brasilApiData).toBeDefined();
                expect(brasilApiData.razaoSocial).toBeDefined();
                expect(brasilApiData.endereco).toBeDefined();
            } catch (error) {
                console.error('❌ Erro detalhado ao buscar dados na Brasil API:', {
                    error: error instanceof Error ? error.message : 'Erro desconhecido',
                    stack: error instanceof Error ? error.stack : undefined,
                    response: error.response?.data,
                    status: error.response?.status,
                    cnpj: webhookData.cnpj,
                });
                throw error;
            }
        });

        it('deve buscar dados complementares na Brasil API', async () => {
            // Usa os dados já buscados no beforeAll
            expect(brasilApiData).toBeDefined();
            expect(brasilApiData.razaoSocial).toBeDefined();
            expect(brasilApiData.endereco).toBeDefined();
            expect(brasilApiData.endereco.logradouro).toBeDefined();
            expect(brasilApiData.endereco.numero).toBeDefined();
            expect(brasilApiData.endereco.bairro).toBeDefined();
            expect(brasilApiData.endereco.municipio).toBeDefined();
            expect(brasilApiData.endereco.uf).toBeDefined();
            expect(brasilApiData.endereco.cep).toBeDefined();

            console.log('✅ Dados da Brasil API validados');
        });

        it('deve criar ou atualizar um vendedor', async () => {
            const sellerData = {
                cnpj: webhookData.cnpj.replace(/[^\d]/g, ''),
                razaoSocial: brasilApiData.razaoSocial,
                email: webhookData.email,
                telefone: webhookData.telefone.replace(/[^\d]/g, ''),
                endereco: `${brasilApiData.endereco.logradouro}, ${brasilApiData.endereco.numero} - ${brasilApiData.endereco.bairro}, ${brasilApiData.endereco.municipio}/${brasilApiData.endereco.uf} - CEP: ${brasilApiData.endereco.cep}`,
            };

            console.log('🔍 Verificando se o vendedor já existe...');

            // Busca o seller pelo CNPJ
            const existingSeller = await prisma.sellers.findUnique({
                where: { cnpj: sellerData.cnpj },
                include: {
                    contracts: {
                        where: {
                            status: EContractStatus.SIGNED,
                        },
                    },
                },
            });

            if (existingSeller) {
                console.log('📄 Vendedor encontrado, verificando contratos assinados...');

                // Se tem contrato assinado, não faz nada
                if (existingSeller.contracts.length > 0) {
                    console.log('✅ Vendedor já possui contrato assinado, finalizando fluxo.');
                    return;
                }

                // Se não tem contrato assinado, atualiza apenas email e telefone
                console.log('📄 Atualizando dados do vendedor existente...');
                const updateResponse = await request(app.getHttpServer())
                    .patch(`/sellers/${existingSeller.id}`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        email: sellerData.email,
                        telefone: sellerData.telefone,
                    })
                    .expect(200);

                console.log('✅ Vendedor atualizado com sucesso:', {
                    id: updateResponse.body.id,
                    email: updateResponse.body.email,
                    telefone: updateResponse.body.telefone,
                });

                sellerId = existingSeller.id;
            } else {
                // Se não existe, cria novo
                console.log('📄 Criando novo vendedor...');
                const createResponse = await request(app.getHttpServer())
                    .post('/sellers')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(sellerData)
                    .expect(201);

                console.log('✅ Vendedor criado com sucesso:', {
                    id: createResponse.body.id,
                    email: createResponse.body.email,
                });

                expect(createResponse.body).toHaveProperty('id');
                expect(createResponse.body.cnpj).toBe(sellerData.cnpj);
                expect(createResponse.body.razaoSocial).toBe(sellerData.razaoSocial);
                expect(createResponse.body.email).toBe(sellerData.email);
                expect(createResponse.body.telefone).toBe(sellerData.telefone);
                sellerId = createResponse.body.id;
            }

            console.log('📄 ID do vendedor:', sellerId);
        });

        it('deve obter o template ativo do Google Docs', async () => {
            // Obtém o template ativo
            const template = await contractTemplateService.getActiveTemplate();
            expect(template).toBeDefined();
            expect(template.is_active).toBe(true);

            // Obtém o ID do documento do Google Docs
            const documentId = process.env.GOOGLE_DOC_ID;
            console.log('📄 ID do documento do Google Docs:', documentId);

            if (!documentId) {
                throw new Error('ID do documento do Google Docs não configurado');
            }

            // Cria uma cópia do template com dados do seller
            console.log('📄 Criando cópia do template com dados do seller...');
            const formattedCnpj = formatCnpj(webhookData.cnpj);
            const currentDate = new Date();
            const formattedDate = formatDate(currentDate);
            const filledDocId = await googleDocsService.createFilledTemplate(documentId, {
                seller: {
                    name: brasilApiData.razaoSocial,
                    cnpj: formattedCnpj,
                    address: `${brasilApiData.endereco.logradouro}, ${brasilApiData.endereco.numero} - ${brasilApiData.endereco.bairro}, ${brasilApiData.endereco.municipio}/${brasilApiData.endereco.uf} - CEP: ${brasilApiData.endereco.cep}`,
                },
                date: formattedDate,
            });
            console.log('📄 Cópia do template criada:', filledDocId);

            // Obtém o conteúdo do documento
            const content = await googleDocsService.getDocument(filledDocId);
            console.log('📄 Conteúdo do documento obtido');

            // Criar o DTO do contrato
            createContractDto = {
                sellerId,
                templateId: template.id,
                content: content.toString('base64'),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            };

            console.log('📄 DTO do contrato criado:', {
                ...createContractDto,
                content: 'BASE64_CONTENT', // Não loga o conteúdo completo
            });
        });

        it('deve criar um contrato com o template', async () => {
            console.log('📄 Criando contrato com dados:', {
                sellerId,
                templateId: createContractDto.templateId,
                expiresAt: createContractDto.expiresAt,
                contentLength: createContractDto.content.length,
            });

            try {
                const response = await request(app.getHttpServer())
                    .post('/contracts')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(createContractDto)
                    .expect(201);

                console.log('✅ Contrato criado com sucesso:', {
                    id: response.body.id,
                    status: response.body.status,
                });

                expect(response.body).toHaveProperty('id');
                expect(response.body.status).toBe(EContractStatus.DRAFT);
                expect(response.body.content).toBeDefined();
                contractId = response.body.id;

                // Garante que o contrato foi criado antes de prosseguir
                const contractCheck = await prisma.contracts.findUnique({
                    where: { id: contractId },
                });
                expect(contractCheck).toBeDefined();
                expect(contractCheck.status).toBe(EContractStatus.DRAFT);

                console.log('📄 Contrato criado com ID:', contractId);
            } catch (error) {
                console.error('❌ Erro ao criar contrato:', {
                    error: error instanceof Error ? error.message : 'Erro desconhecido',
                    stack: error instanceof Error ? error.stack : undefined,
                    response: error.response?.body,
                });
                throw error;
            }
        });

        it('deve enviar o contrato para assinatura na Autentique', async () => {
            // Garante que temos o contrato antes de enviar para assinatura
            const contract = await prisma.contracts.findUnique({
                where: { id: contractId },
                include: { sellers: true },
            });
            expect(contract).toBeDefined();
            expect(contract.sellers).toBeDefined();

            // 1. Obtém o ID do documento do Google Docs
            const googleDocId = process.env.GOOGLE_DOC_ID;
            console.log('📄 ID do documento do Google Docs:', googleDocId);

            if (!googleDocId) {
                throw new Error('ID do documento do Google Docs não configurado');
            }

            // 2. Cria uma cópia do template com dados do seller
            console.log('📄 Criando cópia do template com dados do seller...');
            const formattedCnpj = formatCnpj(contract.sellers.cnpj);
            const currentDate = new Date();
            const formattedDate = formatDate(currentDate);
            const sellerData = {
                name: contract.sellers.razao_social,
                cnpj: formattedCnpj,
                address: contract.sellers.endereco,
            };
            const filledDocId = await googleDocsService.createFilledTemplate(googleDocId, {
                seller: sellerData,
                date: formattedDate,
            });
            console.log('📄 Cópia do template criada:', filledDocId);

            // 3. Obtém o conteúdo do documento
            const content = await googleDocsService.getDocument(filledDocId);
            console.log('📄 Conteúdo do documento obtido');

            // 4. Cria o documento na Autentique
            console.log('📄 Criando documento na Autentique...');
            const createDocResponse = await request(app.getHttpServer())
                .post('/autentique/documents')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: `Contrato PMA True Brands - ${formattedCnpj}`,
                    content: content.toString('base64'),
                    signers: [
                        {
                            name: contract.sellers.razao_social,
                            email: contract.sellers.email,
                            action: 'SIGN',
                        },
                    ],
                    options: {
                        short_link: true,
                    },
                })
                .expect(201);

            console.log('📄 Documento criado:', {
                id: createDocResponse.body.id,
                name: createDocResponse.body.name,
                signatures: createDocResponse.body.signatures,
            });

            // 5. Valida o documento criado
            expect(createDocResponse.body.id).toBeDefined();
            expect(createDocResponse.body.name).toBe(`Contrato PMA True Brands - ${formattedCnpj}`);
            expect(createDocResponse.body.signatures).toHaveLength(1);
            expect(createDocResponse.body.signatures[0].action.name).toBe('SIGN');
            expect(createDocResponse.body.signatures[0].link.short_link).toBeDefined();
            expect(createDocResponse.body.signatures[0].link.short_link).toMatch(
                /^https:\/\/assina\.ae\/[A-Za-z0-9]+$/,
            );

            // 6. Atualiza o contrato com os dados do documento
            console.log('📝 Atualizando contrato com dados do documento...');
            const contractUpdateResponse = await request(app.getHttpServer())
                .put(`/contracts/${contractId}/status`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    status: EContractStatus.PENDING_SIGNATURE,
                    reason: 'SENT_TO_SIGNATURE',
                    metadata: {
                        external_id: createDocResponse.body.id,
                        signing_url: createDocResponse.body.signatures[0].link.short_link,
                    },
                })
                .expect(200);

            console.log('📋 Contrato atualizado:', contractUpdateResponse.body);

            // 7. Verifica se o contrato foi atualizado corretamente
            console.log('🔍 Verificando atualização do contrato...');
            const contractVerifyResponse = await request(app.getHttpServer())
                .get(`/contracts/${contractId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            console.log('📋 Status do contrato:', contractVerifyResponse.body.status);

            expect(contractVerifyResponse.body.status).toBe(EContractStatus.PENDING_SIGNATURE);
            expect(contractVerifyResponse.body.externalId).toBe(createDocResponse.body.id);
            expect(contractVerifyResponse.body.signingUrl).toBe(
                createDocResponse.body.signatures[0].link.short_link,
            );

            // 8. Guarda a URL de assinatura para os próximos testes
            signingUrl = createDocResponse.body.signatures[0].link.short_link;
            console.log('🔗 URL de assinatura:', signingUrl);
        });

        it('deve criar uma notificação inicial via WhatsApp com link de assinatura', async () => {
            // Garante que temos a URL de assinatura antes de criar a notificação
            expect(signingUrl).toBeDefined();

            const response = await request(app.getHttpServer())
                .post('/notifications')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    contractId,
                    sellerId,
                    type: ENotificationType.SIGNATURE_REMINDER,
                    channel: ENotificationChannel.WHATSAPP,
                    content: `Por favor, assine o contrato. Link de assinatura: ${signingUrl}`,
                    attemptNumber: 1,
                })
                .expect(201);

            expect(response.body.status).toBe(ENotificationStatus.PENDING);
            expect(response.body.attemptNumber).toBe(1);
            expect(response.body.content).toContain(signingUrl);

            // Garante que a notificação foi criada no banco
            const notification = await prisma.notifications.findFirst({
                where: { contract_id: contractId },
            });
            expect(notification).toBeDefined();
            expect(notification.status).toBe(ENotificationStatus.PENDING);
        });

        it('deve atualizar o status da notificação para enviada', async () => {
            const notifications = await prisma.notifications.findMany({
                where: { contract_id: contractId },
            });

            expect(notifications).toHaveLength(1);
            const notificationId = notifications[0].id;

            const response = await request(app.getHttpServer())
                .patch(`/notifications/${notificationId}/mark-as-sent`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ messageId: 'test-message-id' })
                .expect(200);

            expect(response.body.status).toBe(ENotificationStatus.SENT);
        });

        it('deve atualizar o status da notificação para entregue', async () => {
            const notifications = await prisma.notifications.findMany({
                where: { contract_id: contractId },
            });

            expect(notifications).toHaveLength(1);
            const notificationId = notifications[0].id;

            const response = await request(app.getHttpServer())
                .patch(`/notifications/${notificationId}/mark-as-delivered`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.status).toBe(ENotificationStatus.DELIVERED);
        });

        it('deve verificar o histórico de status do contrato', async () => {
            const response = await request(app.getHttpServer())
                .get(`/contracts/${contractId}/status-history`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveLength(2); // DRAFT -> PENDING_SIGNATURE
        });

        it('deve verificar as notificações do contrato', async () => {
            const response = await request(app.getHttpServer())
                .get(`/notifications/contract/${contractId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveLength(1); // Apenas a notificação inicial
        });

        it('deve verificar o status final do contrato', async () => {
            const response = await request(app.getHttpServer())
                .get(`/contracts/${contractId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.status).toBe(EContractStatus.PENDING_SIGNATURE);
            expect(response.body.signingUrl).toBeDefined();
            expect(response.body.externalId).toBeDefined();
        });

        // Log dos dados criados no teste
        console.log('Dados criados no teste:', {
            sellerId,
            contractId,
            autentiqueDocId,
            signingUrl,
        });
    });
});
