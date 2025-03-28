import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ContractService } from '../src/modules/contract-management/contract/services/contract.service';
import { SellerService } from '../src/modules/contract-management/seller/services/seller.service';
import { ContractTemplateService } from '../src/modules/contract-management/template/services/contract-template.service';
import { NotificationService } from '../src/modules/contract-management/notification/services/notification.service';
import { PrismaService } from '../src/shared/services/prisma.service';
import { ContractModule } from '../src/modules/contract-management/contract/contract.module';
import { SellerModule } from '../src/modules/contract-management/seller/seller.module';
import { TemplateModule } from '../src/modules/contract-management/template/template.module';
import { NotificationModule } from '../src/modules/contract-management/notification/notification.module';
import { IntegrationModule } from '../src/modules/integration/integration.module';
import { AutentiqueModule } from '../src/modules/integration/autentique/autentique.module';
import { PrismaModule } from '../src/shared/modules/prisma.module';
import { CreateSellerDto } from '../src/modules/contract-management/seller/dtos/create-seller.dto';
import { CreateTemplateDto } from '../src/modules/contract-management/template/dtos/create-template.dto';
import { CreateContractDto } from '../src/modules/contract-management/contract/dtos/create-contract.dto';
import { INestApplication } from '@nestjs/common';

describe('Contract Flow Integration Tests', () => {
    let app: INestApplication;
    let contractService: ContractService;
    let sellerService: SellerService;
    let templateService: ContractTemplateService;
    let notificationService: NotificationService;
    let prisma: PrismaService;

    const TEST_PHONE = '27992594304';
    const TEST_EMAIL = 'gabrielnfc@gmail.com';
    const TEST_CNPJ = '12345678901234';

    beforeAll(async () => {
        console.log('🔄 Iniciando setup do teste...');
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.local',
                }),
                ContractModule,
                SellerModule,
                TemplateModule,
                NotificationModule,
                IntegrationModule,
                AutentiqueModule,
                PrismaModule,
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        contractService = moduleFixture.get<ContractService>(ContractService);
        sellerService = moduleFixture.get<SellerService>(SellerService);
        templateService = moduleFixture.get<ContractTemplateService>(ContractTemplateService);
        notificationService = moduleFixture.get<NotificationService>(NotificationService);
        prisma = moduleFixture.get<PrismaService>(PrismaService);

        console.log('✅ Setup do teste concluído');
    });

    afterAll(async () => {
        console.log('🔄 Iniciando limpeza do teste...');
        await prisma.notifications.deleteMany();
        await prisma.status_history.deleteMany();
        await prisma.contracts.deleteMany();
        await prisma.templates.deleteMany();
        await prisma.sellers.deleteMany();
        await app.close();
        console.log('✅ Limpeza do teste concluída');
    });

    it('should complete the full contract flow', async () => {
        console.log('\n📝 Iniciando fluxo de teste...');

        // 1. Criar Seller
        console.log('\n1️⃣ Criando seller...');
        const sellerData: CreateSellerDto = {
            cnpj: TEST_CNPJ,
            razaoSocial: 'Empresa Teste',
            email: TEST_EMAIL,
            telefone: TEST_PHONE,
            endereco: 'Rua Teste, 123',
        };

        let sellerId: string;
        try {
            const seller = await sellerService.create(sellerData);
            sellerId = seller.id;
            console.log('✅ Seller criado com sucesso:', { id: seller.id, cnpj: seller.cnpj });
        } catch (error) {
            console.error('❌ Erro ao criar seller:', error);
            throw error;
        }

        // 2. Criar Template
        console.log('\n2️⃣ Criando template...');
        const templateData: CreateTemplateDto = {
            name: 'Template Teste',
            content: 'Conteúdo do contrato {{razaoSocial}}',
            version: '1.0',
            isActive: true,
        };

        let templateId: string;
        try {
            const template = await templateService.create(templateData);
            templateId = template.id;
            console.log('✅ Template criado com sucesso:', {
                id: template.id,
                name: template.name,
            });
        } catch (error) {
            console.error('❌ Erro ao criar template:', error);
            throw error;
        }

        // 3. Criar Contrato
        console.log('\n3️⃣ Criando contrato...');
        const contractData: CreateContractDto = {
            sellerId,
            templateId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
            content: 'Conteúdo do contrato',
        };

        let contractId: string;
        try {
            const contract = await contractService.create(contractData, {
                companyName: 'Empresa Teste',
                companyCnpj: TEST_CNPJ,
                companyAddress: 'Rua Teste, 123',
                contractNumber: '123456',
                contractDuration: 12,
                commissionRate: 10,
                paymentDay: 5,
                jurisdiction: 'Espírito Santo',
                city: 'Vila Velha',
            });
            contractId = contract.id;
            console.log('✅ Contrato criado com sucesso:', {
                id: contract.id,
                status: contract.status,
            });
        } catch (error) {
            console.error('❌ Erro ao criar contrato:', error);
            throw error;
        }

        // 4. Enviar para Assinatura
        console.log('\n4️⃣ Enviando contrato para assinatura...');
        try {
            await contractService.sendToSignature(contractId, sellerId);
            const contract = await contractService.findOne(contractId);
            console.log('✅ Contrato enviado para assinatura:', {
                id: contract.id,
                status: contract.status,
            });
        } catch (error) {
            console.error('❌ Erro ao enviar contrato para assinatura:', error);
            throw error;
        }

        // 5. Verificar Status do Contrato
        console.log('\n5️⃣ Verificando status do contrato...');
        try {
            const contract = await contractService.findOne(contractId);
            console.log('✅ Status do contrato:', { id: contract.id, status: contract.status });
        } catch (error) {
            console.error('❌ Erro ao verificar status do contrato:', error);
            throw error;
        }

        // 6. Verificar Histórico de Status
        console.log('\n6️⃣ Verificando histórico de status...');
        try {
            const history = await prisma.status_history.findMany({
                where: { contract_id: contractId },
                orderBy: { changed_at: 'asc' },
            });
            console.log(
                '✅ Histórico de status:',
                history.map((h) => ({
                    from: h.from_status,
                    to: h.to_status,
                    reason: h.reason,
                })),
            );
        } catch (error) {
            console.error('❌ Erro ao verificar histórico de status:', error);
            throw error;
        }

        // 7. Verificar Notificações
        console.log('\n7️⃣ Verificando notificações...');
        try {
            const notifications = await prisma.notifications.findMany({
                where: { contract_id: contractId },
                orderBy: { created_at: 'asc' },
            });
            console.log(
                '✅ Notificações:',
                notifications.map((n) => ({
                    type: n.type,
                    channel: n.channel,
                    status: n.status,
                })),
            );
        } catch (error) {
            console.error('❌ Erro ao verificar notificações:', error);
            throw error;
        }

        // 8. Verificar Métricas
        console.log('\n8️⃣ Verificando métricas...');
        try {
            const metrics = await notificationService.getMetrics();
            console.log('✅ Métricas:', metrics);
        } catch (error) {
            console.error('❌ Erro ao verificar métricas:', error);
            throw error;
        }

        console.log('\n✨ Fluxo de teste concluído com sucesso!');
    }, 30000);
});
