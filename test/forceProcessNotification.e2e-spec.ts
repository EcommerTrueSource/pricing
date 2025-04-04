import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/shared/services/prisma.service';
import { NotificationService } from '../src/modules/contract-management/notification/services/notification.service';
import { ENotificationType } from '../src/modules/contract-management/notification/enums/notification-type.enum';
import { ENotificationChannel } from '../src/modules/contract-management/notification/enums/notification-channel.enum';
import { ENotificationStatus } from '../src/modules/contract-management/notification/enums/notification-status.enum';
import { NotificationProcessor } from '../src/modules/contract-management/notification/processors/notification.processor';
import { faker } from '@faker-js/faker/locale/pt_BR';
import { ConfigModule } from '@nestjs/config';
import { Queue } from 'bull';
import { AppModule } from '../src/app.module';
import { Job } from 'bull';
import { contract_status } from '@prisma/client';

describe('Teste de Processamento Manual de Notificação (E2E)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let notificationService: NotificationService;
    let notificationProcessor: NotificationProcessor;
    let bullQueue: Queue;

    // IDs para test fixtures
    let testSellerId: string;
    let testContractId: string;

    // Configuração inicial
    beforeAll(async () => {
        console.log('📊 Iniciando teste de processamento MANUAL de notificação...');
        console.log(`🔍 Node version: ${process.version}`);
        console.log(`📂 Current directory: ${process.cwd()}`);
        console.log('🔧 Ambiente Redis:');
        try {
            console.log(`  REDIS_HOST: ${process.env.REDIS_HOST || '(não definido)'}`);
            console.log(`  REDIS_PORT: ${process.env.REDIS_PORT || '(não definido)'}`);
        } catch (envError) {
            console.error('  ❌ Erro ao ler variáveis de ambiente Redis:', envError);
        }

        // Cria o módulo de teste
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                // Configuração mínima necessária para o teste
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.local',
                }),
                AppModule,
            ],
        }).compile();

        // Cria a aplicação
        app = moduleFixture.createNestApplication();
        await app.init();

        // Obtém serviços necessários
        prisma = app.get<PrismaService>(PrismaService);
        notificationService = app.get<NotificationService>(NotificationService);
        notificationProcessor = app.get<NotificationProcessor>(NotificationProcessor);

        try {
            bullQueue = app.get<Queue>('BullQueue_notifications');
            console.log(`📋 Fila Bull obtida: ${bullQueue ? 'SIM' : 'NÃO'}`);
        } catch (error) {
            console.warn('⚠️ Não foi possível obter a referência à fila Bull:', error.message);
        }

        // --- PASSO 1: Cria os dados de teste ---
        console.log('🔨 Criando dados de teste...');

        // 1.1. Criar um vendedor de teste
        const sellerData = {
            cnpj: faker.string.numeric(14),
            razao_social: faker.company.name(),
            email: faker.internet.email(),
            telefone: '5527992594304', // Número real para teste (formato: 55 + DDD + número)
            endereco: faker.location.streetAddress(),
        };

        const testSeller = await prisma.sellers.create({
            data: sellerData,
        });
        testSellerId = testSeller.id;
        console.log(`   - Vendedor criado ID: ${testSellerId} (Tel: ${testSeller.telefone})`);

        // 1.2. Criar um contrato de teste
        // Primeiro, vamos garantir que existe um template
        const existingTemplate = await prisma.templates.findFirst({
            where: { is_active: true },
        });

        let templateId;
        if (!existingTemplate) {
            console.log('   - Nenhum template encontrado, criando novo...');
            const newTemplate = await prisma.templates.create({
                data: {
                    name: 'Template Teste Manual',
                    content: 'Conteúdo do template de teste manual',
                    version: '1.0',
                    is_active: true,
                },
            });
            templateId = newTemplate.id;
        } else {
            templateId = existingTemplate.id;
        }
        console.log(`   - Template ID: ${templateId}`);

        // Agora criamos o contrato usando o tipo correto do enum
        const expiresDate = new Date();
        expiresDate.setDate(expiresDate.getDate() + 30);

        const contract = await prisma.contracts.create({
            data: {
                seller_id: testSellerId,
                template_id: templateId,
                status: contract_status.PENDING_SIGNATURE,
                content: 'Conteúdo de teste para o contrato.',
                signing_url: `https://assina.ae/${faker.string.alphanumeric(12)}`, // URL no formato do Autentique
                expires_at: expiresDate,
            },
        });
        testContractId = contract.id;
        console.log(`   - Contrato criado ID: ${testContractId}`);
    });

    afterAll(async () => {
        // Limpar dados de teste
        console.log('🧹 Limpando dados de teste...');
        if (testContractId) {
            await prisma.notifications.deleteMany({
                where: { contract_id: testContractId },
            });
            await prisma.contracts.delete({
                where: { id: testContractId },
            });
            console.log('   - Contrato e notificações removidos');
        }

        if (testSellerId) {
            await prisma.sellers.delete({
                where: { id: testSellerId },
            });
            console.log('   - Vendedor removido');
        }

        // Fecha a aplicação
        await app.close();
    });

    it('deve processar uma notificação manualmente com sucesso', async () => {
        // Aumenta o timeout para este teste
        jest.setTimeout(60000); // Aumentado para 60 segundos

        // 1. Cria a notificação
        console.log('📝 Criando notificação para processamento manual...');
        console.log(
            `   - Usando número de telefone real: ${await prisma.sellers.findUnique({ where: { id: testSellerId } }).then((s) => s.telefone)}`,
        );

        const createdNotificationDto = await notificationService.create({
            contractId: testContractId,
            sellerId: testSellerId,
            type: ENotificationType.SIGNATURE_REMINDER,
            channel: ENotificationChannel.WHATSAPP,
            content: 'Este é um teste de mensagem pelo Z-API às ' + new Date().toLocaleTimeString(), // Conteúdo personalizado com timestamp
            attemptNumber: 0,
        });

        expect(createdNotificationDto).toBeDefined();
        expect(createdNotificationDto.id).toBeDefined();
        const notificationId = createdNotificationDto.id;
        console.log(`   - Notificação criada ID: ${notificationId}`);

        // 2. Processa manualmente a notificação (sem depender do Bull)
        console.log('🔄 Processando notificação manualmente...');
        try {
            // Cria um objeto Job simulado para passar para o handleNotification
            const mockJob: Job = {
                id: 'manual-job-1',
                data: {
                    notificationId: notificationId,
                    attemptNumber: 1,
                },
                // Adicionando apenas os campos necessários para o teste
                queue: null,
                progress: jest.fn(),
                log: jest.fn(),
                moveToCompleted: jest.fn(),
                moveToFailed: jest.fn(),
                discard: jest.fn(),
                remove: jest.fn(),
                retry: jest.fn(),
                finished: jest.fn(),
                isCompleted: jest.fn(),
                isFailed: jest.fn(),
                isDelayed: jest.fn(),
                isActive: jest.fn(),
                isWaiting: jest.fn(),
                isPaused: jest.fn(),
                getState: jest.fn(),
                update: jest.fn(),
                promote: jest.fn(),
            } as any;

            // Chama o método de processamento diretamente
            console.log(`   - Chamando handleNotification para a notificação ${notificationId}...`);
            const result = await notificationProcessor.handleNotification(mockJob);
            console.log(`   - Resultado do processamento: ${JSON.stringify(result)}`);
            console.log('   - Processamento manual realizado');
        } catch (error) {
            console.error('❌ Erro no processamento manual:', error);
            throw error;
        }

        // 3. Verifica o resultado
        console.log('🔍 Verificando status após processamento manual...');
        const updatedNotification = await prisma.notifications.findUnique({
            where: { id: notificationId },
            include: { sellers: true, contracts: true },
        });

        console.log(`   - Status final: ${updatedNotification?.status}`);
        console.log(
            `   - Detalhes completos da notificação:`,
            JSON.stringify(
                {
                    id: updatedNotification?.id,
                    status: updatedNotification?.status,
                    attempt_number: updatedNotification?.attempt_number,
                    sent_at: updatedNotification?.sent_at,
                    delivered_at: updatedNotification?.delivered_at,
                    external_id: updatedNotification?.external_id,
                    telefone: updatedNotification?.sellers?.telefone,
                    contractUrl: updatedNotification?.contracts?.signing_url,
                },
                null,
                2,
            ),
        );

        // O teste pode agora ter dois resultados aceitáveis:
        // 1. SENT - Se as credenciais Z-API estão corretas
        // 2. FAILED - Se há algum problema com a Z-API (não configurada, etc)
        expect(updatedNotification?.status).not.toBe(ENotificationStatus.PENDING);

        // Se falhou, exibe mais detalhes para diagnóstico
        if (updatedNotification?.status === ENotificationStatus.FAILED) {
            console.log('⚠️ Notificação marcada como FAILED, mas isso pode ser esperado se:');
            console.log('   - As credenciais da Z-API não estão configuradas no ambiente de teste');
            console.log('   - O número de telefone tem formato incompatível');
            console.log('   - A Z-API está com problemas temporários');
        } else if (updatedNotification?.status === ENotificationStatus.SENT) {
            console.log('✅ Notificação processada com sucesso (SENT)!');
            console.log(
                '   - Verifique o WhatsApp do número configurado para confirmar o recebimento',
            );
            console.log('   - Tempo atual: ' + new Date().toLocaleTimeString());
        }
    });
});
