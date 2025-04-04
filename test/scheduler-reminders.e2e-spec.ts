import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/services/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ContractReminderScheduler } from '../src/modules/contract-management/scheduler/services/contract-reminder.scheduler';

describe('Scheduler de Lembretes (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let jwtService: JwtService;
    let scheduler: ContractReminderScheduler;
    let token: string;
    let testContractId: string;

    beforeAll(async () => {
        console.log('🚀 Iniciando teste do sistema de lembretes de contrato');
        console.log(`Node version: ${process.version}`);
        console.log(`Current directory: ${process.cwd()}`);

        try {
            console.log('Redis ENV:', {
                host: process.env.REDIS_HOST,
                port: process.env.REDIS_PORT,
            });
        } catch (error) {
            console.error('Erro ao ler variáveis Redis:', error);
        }

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        prisma = app.get(PrismaService);
        jwtService = app.get(JwtService);
        scheduler = app.get(ContractReminderScheduler);

        // Cria um token para autenticação
        token = jwtService.sign({ sub: 'test-user', roles: ['ADMIN'] });

        // Busca um contrato pendente para teste
        try {
            const pendingContract = await prisma.contracts.findFirst({
                where: {
                    status: 'PENDING_SIGNATURE',
                },
                select: { id: true },
            });

            if (pendingContract) {
                testContractId = pendingContract.id;
                console.log(`📝 Contrato para teste: ${testContractId}`);
            } else {
                console.warn('⚠️ Nenhum contrato pendente encontrado para teste');
            }
        } catch (error) {
            console.error('❌ Erro ao buscar contrato para teste:', error);
        }
    });

    afterAll(async () => {
        await app.close();
    });

    it('deve ter as configurações corretas para lembretes', () => {
        // Verifica se as configurações estão corretas
        expect(scheduler['DIAS_SEGUNDA_NOTIFICACAO']).toBe(3); // Segunda notificação após 3 dias
        expect(scheduler['DIAS_TERCEIRA_NOTIFICACAO']).toBe(7); // Terceira notificação após 7 dias
        expect(scheduler['MAX_NOTIFICACOES']).toBe(3); // Máximo de 3 tentativas
    });

    it('deve listar os contratos pendentes e enviar lembretes quando necessário', async () => {
        const result = await scheduler.triggerContractReminders();
        console.log('Resultado do scheduler:', result);
        expect(result).toBeDefined();
    });

    it('deve acionar o scheduler via endpoint', async () => {
        return request(app.getHttpServer())
            .post('/scheduler/trigger-contract-reminders')
            .set('Authorization', `Bearer ${token}`)
            .expect(201)
            .then((response) => {
                expect(response.body.success).toBe(true);
            });
    });

    it('deve enviar lembrete para um contrato específico', async () => {
        // Pulamos o teste se não encontramos nenhum contrato pendente
        if (!testContractId) {
            console.warn('⚠️ Teste pulado: nenhum contrato pendente encontrado');
            return;
        }

        // Antes de enviar lembrete, verifica quantas notificações já existem
        const notificacoesAntes = await prisma.notifications.count({
            where: {
                contract_id: testContractId,
                type: 'SIGNATURE_REMINDER',
            },
        });

        console.log(`🔍 Contrato já tem ${notificacoesAntes} notificações de lembrete`);

        // Se já tem 3 notificações, não esperamos que uma nova seja criada
        const expectNovaNotificacao = notificacoesAntes < 3;

        // Verifica diretamente pelo método do scheduler
        const result = await scheduler.checkSpecificContract(testContractId);
        console.log(`Resultado do lembrete para contrato ${testContractId}:`, result);

        if (expectNovaNotificacao) {
            // Se esperamos uma nova notificação, o resultado deve ser true
            expect(result).toBe(true);

            // Verifica se realmente foi criada uma nova notificação
            const notificacoesDepois = await prisma.notifications.count({
                where: {
                    contract_id: testContractId,
                    type: 'SIGNATURE_REMINDER',
                },
            });
            expect(notificacoesDepois).toBe(notificacoesAntes + 1);

            // Busca a nova notificação para verificar se o texto está correto
            const ultimaNotificacao = await prisma.notifications.findFirst({
                where: {
                    contract_id: testContractId,
                    type: 'SIGNATURE_REMINDER',
                },
                orderBy: {
                    created_at: 'desc',
                },
            });

            // Verifica se o número da tentativa está correto
            expect(ultimaNotificacao.attempt_number).toBe(notificacoesAntes + 1);

            // O texto da notificação deve ser diferente dependendo do número da tentativa
            if (notificacoesAntes + 1 === 2) {
                expect(ultimaNotificacao.content).toContain('gentilmente lembrá-lo');
                expect(ultimaNotificacao.content).toContain('📢');
                expect(ultimaNotificacao.content).toContain('🔗');
            } else if (notificacoesAntes + 1 === 3) {
                expect(ultimaNotificacao.content).toContain('⚠️ AVISO IMPORTANTE');
                expect(ultimaNotificacao.content).toContain('terceira e última comunicação');
                expect(ultimaNotificacao.content).toContain('*indispensável*');
            } else {
                // Caso seja a primeira tentativa
                expect(ultimaNotificacao.content).toContain('Olá *');
                expect(ultimaNotificacao.content).toContain('👋');
                expect(ultimaNotificacao.content).toContain('⏱️ *Prazo para assinatura:*');
            }
        } else {
            // Se não esperamos uma nova notificação, o resultado deve ser false
            expect(result).toBe(false);
        }
    });

    it('deve enviar lembrete para um contrato específico via endpoint com parâmetro de rota', async () => {
        // Pulamos o teste se não encontramos nenhum contrato pendente
        if (!testContractId) {
            console.warn('⚠️ Teste pulado: nenhum contrato pendente encontrado');
            return;
        }

        return request(app.getHttpServer())
            .post(`/scheduler/reminder/${testContractId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect((res) => {
                // Como não sabemos se o contrato vai aceitar mais um lembrete,
                // verificamos que recebemos uma resposta 201 (sucesso) ou 400 (limite atingido)
                const validStatuses = [201, 400];
                if (!validStatuses.includes(res.status)) {
                    throw new Error(`Status inválido: ${res.status}`);
                }
            })
            .then((response) => {
                console.log('Resposta do endpoint de rota:', response.body);
                // Se foi sucesso, verificamos o body
                if (response.status === 201) {
                    expect(response.body.success).toBe(true);
                }
            });
    });

    it('deve enviar lembrete para um contrato específico via endpoint com query param', async () => {
        // Pulamos o teste se não encontramos nenhum contrato pendente
        if (!testContractId) {
            console.warn('⚠️ Teste pulado: nenhum contrato pendente encontrado');
            return;
        }

        return request(app.getHttpServer())
            .post('/scheduler/trigger-contract-reminders')
            .query({ contractId: testContractId })
            .set('Authorization', `Bearer ${token}`)
            .expect((res) => {
                // Como não sabemos se o contrato vai aceitar mais um lembrete,
                // verificamos que recebemos uma resposta 201 (sucesso) ou 400 (limite atingido)
                const validStatuses = [201, 400];
                if (!validStatuses.includes(res.status)) {
                    throw new Error(`Status inválido: ${res.status}`);
                }
            })
            .then((response) => {
                console.log('Resposta do endpoint de query:', response.body);
                // Se foi sucesso, verificamos o body
                if (response.status === 201) {
                    expect(response.body.success).toBe(true);
                }
            });
    });
});
