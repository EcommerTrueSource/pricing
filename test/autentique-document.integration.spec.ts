import { Test, TestingModule } from '@nestjs/testing';
import { AutentiqueService } from '../src/modules/integration/autentique/services/autentique.service';
import { AutentiqueModule } from '../src/modules/integration/autentique/autentique.module';
import { ConfigModule } from '@nestjs/config';
import { ContractTemplateService } from '../src/modules/contract-management/template/services/contract-template.service';
import { ContractTemplateModule } from '../src/modules/contract-management/template/contract-template.module';
import { PrismaModule } from '../src/shared/modules/prisma.module';
import { GoogleDocsService } from '../src/modules/contract-management/template/services/google-docs.service';

describe('Autentique Document Integration Tests', () => {
    let autentiqueService: AutentiqueService;
    let contractTemplateService: ContractTemplateService;
    let googleDocsService: GoogleDocsService;

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
        console.log('🔄 Iniciando setup do teste...');
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    envFilePath: '.env.local',
                }),
                AutentiqueModule,
                ContractTemplateModule,
                PrismaModule,
            ],
        }).compile();

        autentiqueService = module.get<AutentiqueService>(AutentiqueService);
        contractTemplateService = module.get<ContractTemplateService>(ContractTemplateService);
        googleDocsService = module.get<GoogleDocsService>(GoogleDocsService);
    });

    it('should create a document in Autentique with correct name pattern', async () => {
        console.log('📄 Testando criação de documento na Autentique...');

        try {
            // Obtém o template ativo do banco
            const template = await contractTemplateService.getActiveTemplate();
            console.log('📄 Template obtido do banco:', template?.id);

            if (!template) {
                throw new Error('Template não encontrado');
            }

            // Obtém o ID do documento do Google Docs
            const documentId = process.env.GOOGLE_DOC_ID;
            console.log('📄 ID do documento do Google Docs:', documentId);

            if (!documentId) {
                throw new Error('ID do documento do Google Docs não configurado');
            }

            // Cria uma cópia do template com dados mockados
            console.log('📄 Criando cópia do template com dados mockados...');
            const rawCnpj = '38308523000172';
            const formattedCnpj = formatCnpj(rawCnpj);
            const currentDate = new Date();
            const formattedDate = formatDate(currentDate);
            const sellerData = {
                name: 'SAUDE & AMOR TESTE LTDA',
                cnpj: formattedCnpj,
                address: 'Rua Teste, 123, Bairro Teste, Cidade Teste/UF, CEP 12345-678',
            };
            const filledDocId = await googleDocsService.createFilledTemplate(documentId, {
                seller: sellerData,
                date: formattedDate,
            });
            console.log('📄 Cópia do template criada:', filledDocId);

            // Obtém o conteúdo do documento
            const content = await googleDocsService.getDocument(filledDocId);
            console.log('📄 Conteúdo do documento obtido');

            // Cria o documento na Autentique
            console.log('📄 Criando documento na Autentique...');
            const document = await autentiqueService.createDocument(
                `Contrato PMA True Brands - ${formattedCnpj}`,
                content.toString('base64'),
                [
                    {
                        name: 'Gabriel Nascimento',
                        email: 'gabrielnfc@gmail.com',
                    },
                ],
                { short_link: true },
            );

            // Validações
            expect(document).toBeDefined();
            expect(document.id).toBeDefined();
            expect(document.name).toBe(`Contrato PMA True Brands - ${formattedCnpj}`);

            // Encontra o signatário que criamos
            const testSigner = document.signatures.find((s) => s.email === 'gabrielnfc@gmail.com');
            expect(testSigner).toBeDefined();
            expect(testSigner.action.name).toBe('SIGN');

            // Verifica se o link de assinatura foi gerado
            expect(testSigner.link).toBeDefined();
            expect(testSigner.link.short_link).toBeDefined();
            expect(testSigner.link.short_link).toMatch(/^https:\/\/assina\.ae\/[A-Za-z0-9]+$/);

            // Log dos signatários para debug
            console.log('📄 Signatários do documento:', document.signatures);
        } catch (error) {
            console.error('❌ Erro ao criar documento:', error);
            throw error;
        }
    }, 30000); // Aumentando o timeout para 30 segundos

    afterAll(async () => {
        console.log('🔄 Finalizando teste...');
    });
});
