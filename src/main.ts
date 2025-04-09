/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { Logger } from '@nestjs/common';
// import * as csurf from 'csurf';

// Importar o script de migração (será executado automaticamente se PRISMA_MIGRATE=true)
import './prisma-migrate';

// Carrega as variáveis de ambiente do caminho especificado na variável DOTENV_PATH ou usa .env.local por padrão
const envPath = process.env.DOTENV_PATH || path.resolve(process.cwd(), '.env.local');
console.log(`Carregando variáveis de ambiente de: ${envPath}`);
dotenv.config({ path: envPath });

// Se estamos no modo de migração, não iniciar o servidor web
if (process.env.PRISMA_MIGRATE === 'true') {
    console.log('Modo de migração ativado. O servidor web não será iniciado.');
    // A migração será executada pelo script importado acima
} else {
    // Iniciar o servidor web normalmente
    bootstrap();
}

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    console.log('Iniciando aplicação...');
    const app = await NestFactory.create(AppModule);

    // Configuração do prefixo global
    app.setGlobalPrefix('api', {
        exclude: [],
    });
    logger.log('Prefix global configurado para: /api');

    // Configuração do CORS
    app.enableCors({
        origin: [
            process.env.FRONTEND_URL || 'http://localhost:4200',
            'https://pricing-460815276546.southamerica-east1.run.app'
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    });
    logger.log('CORS configurado');

    // Middleware de segurança
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    connectSrc: ["'self'", 'https://accounts.google.com'],
                    frameSrc: ["'self'", 'https://accounts.google.com'],
                    imgSrc: ["'self'", 'https:', 'data:'],
                    scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                },
            },
        })
    );
    app.use(cookieParser());
    logger.log('Middleware de segurança configurado');

    // Configuração do Swagger
    const config = new DocumentBuilder()
        .setTitle('API de Gerenciamento de Contratos')
        .setDescription(
            `
      # Sistema de Gerenciamento de Contratos e Parceiros Comerciais

      ## 📋 Visão Geral

      API completa para automação do ciclo de vida de contratos comerciais, desde o cadastro de vendedores
      até a assinatura digital e notificações automáticas.

      ## 🏗️ Módulos Principais

      ### Vendedores (Sellers)
      - Cadastro completo com validação de CNPJ via Brasil API
      - Consulta e atualização de dados cadastrais
      - Histórico de alterações e contratos associados

      ### Contratos (Contracts)
      - Criação de contratos a partir de templates personalizáveis
      - Fluxo de aprovação e assinatura digital via Autentique
      - Monitoramento de status e prazos de validade
      - Histórico completo de alterações de status

      ### Templates
      - Gerenciamento de modelos de contrato com versionamento
      - Substituição automática de variáveis dinâmicas
      - Validação de conteúdo e formatação

      ### Notificações
      - Envio automático de lembretes para assinatura
      - Integração com WhatsApp via Z-API
      - Agendamento inteligente com retry automático
      - Monitoramento de entregas e leituras

      ### Webhooks e Integrações
      - Webhooks para integração com sistemas externos (Mercos)
      - Recebimento de eventos da Autentique (assinaturas/rejeições)
      - API Brasil para validação de dados empresariais
      - Z-API para comunicação via WhatsApp

      ## 🔐 Autenticação
      Todas as rotas protegidas requerem um token JWT no header:
      \`Authorization: Bearer seu-token-jwt\`

      ### Opções de Login:
      - Email/Senha: POST /api/auth/login
      - Google OAuth: GET /api/auth/google
      - Token para testes: GET /api/auth/token

      ## 👥 Controle de Acesso
      - **ADMIN**: Acesso completo ao sistema, incluindo gerenciamento de usuários
      - **MANAGER**: Gerenciamento de contratos, vendedores e notificações
      - **USER**: Visualização de dados com permissões restritas

      ## 📱 Fluxos Principais
      1. **Cadastro de Vendedor**: Validação de CNPJ → Armazenamento → Notificação de boas-vindas
      2. **Emissão de Contrato**: Seleção de template → Substituição de variáveis → Envio para assinatura
      3. **Fluxo de Assinatura**: Notificação por WhatsApp → Lembretes automáticos → Confirmação de assinatura
      4. **Integração via Webhook**: Recebimento de eventos externos → Processamento automático → Notificação de status
    `,
        )
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('vendedores', 'Endpoints para gestão de vendedores')
        .addTag('contratos', 'Endpoints para gestão de contratos')
        .addTag('templates', 'Endpoints para gestão de templates de contratos')
        .addTag('notificações', 'Endpoints para gestão de notificações')
        .addTag('Autentique', 'Endpoints para integração com o Autentique')
        .addTag('Autenticação', 'Endpoints para autenticação e autorização')
        .addTag('Convites', 'Endpoints para gestão de convites')
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
        customSiteTitle: 'API de Contratos - Documentação',
        customCss: '.swagger-ui .topbar { display: none }',
        swaggerOptions: {
            persistAuthorization: true,
            filter: true,
            showRequestDuration: true,
            syntaxHighlight: {
                theme: 'monokai',
            },
        },
    });
    logger.log('Swagger configurado em: /api/docs');

    // Configuração de validação global
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );
    logger.log('ValidationPipe configurado');

    // Proteção CSRF - Ativar em rotas não-API que usam formulários
    // Esta proteção é desabilitada para APIs REST puras, mas é importante para apps com sessão
    // app.use(csurf({ cookie: true }));

    // Prefixo global para todas as rotas
    console.log('ATENÇÃO: Todas as rotas estão com o prefixo "/api"');
    console.log('Exemplos de rotas corretas:');
    console.log('- Para autenticação com Google: /api/auth/google');
    console.log('- Para callback do Google: /api/auth/google/callback');
    console.log('- Para login com credenciais: /api/auth/login');

    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.log(`🚀 Aplicação rodando na porta ${port}`);
    logger.log(`URL base: http://localhost:${port}/api`);

    // Log para debug - URL de callback do Google
    const googleCallbackUrl = process.env.GOOGLE_CALLBACK_URL || 'não configurado';
    console.log(`GOOGLE_CALLBACK_URL configurado como: ${googleCallbackUrl}`);
    console.log('Certifique-se de que esta URL está autorizada no console do Google Cloud');

    // Log do endereço base da aplicação
    const appUrl = await app.getUrl();
    console.log(`Endereço base da aplicação: ${appUrl}`);
}
