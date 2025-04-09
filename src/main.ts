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

// Carrega as variáveis de ambiente do caminho especificado na variável DOTENV_PATH ou usa .env.local por padrão
const envPath = process.env.DOTENV_PATH || path.resolve(process.cwd(), '.env.local');
console.log(`Carregando variáveis de ambiente de: ${envPath}`);
dotenv.config({ path: envPath });

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
      API para gerenciamento de contratos e vendedores.

      ## Funcionalidades
      - Gestão de vendedores
      - Gestão de contratos
      - Gestão de templates
      - Sistema de notificações
      - Integração com serviços externos

      ## Autenticação
      Todas as rotas protegidas requerem um token JWT no header:
      \`Authorization: Bearer seu-token-jwt\`

      ### Opções de Login:
      - Email/Senha: POST /api/auth/login
      - Google: GET /api/auth/google
      - Token para testes: GET /api/auth/token

      ## Roles
      - ADMIN: Acesso total ao sistema
      - MANAGER: Acesso a gestão de contratos e vendedores
      - USER: Acesso básico para visualização
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
bootstrap();
