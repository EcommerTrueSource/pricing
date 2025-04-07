/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
// import * as csurf from 'csurf';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Adiciona middleware de segurança
    app.use(helmet());
    app.use(cookieParser());

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
    SwaggerModule.setup('api', app, document, {
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

    // Configuração de validação global
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );

    // Configuração de CORS
    app.enableCors({
        origin: [
            'http://localhost:4200',
            'http://localhost:3000',
            process.env.FRONTEND_URL,
        ].filter(Boolean),
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });

    // Proteção CSRF - Ativar em rotas não-API que usam formulários
    // Esta proteção é desabilitada para APIs REST puras, mas é importante para apps com sessão
    // app.use(csurf({ cookie: true }));

    // Prefixo global para todas as rotas
    app.setGlobalPrefix('api');

    const port = process.env.PORT || 3000;
    await app.listen(port);
    console.log(`🚀 Aplicação rodando na porta ${port}`);
}
bootstrap();
