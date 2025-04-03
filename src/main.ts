/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

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
    app.enableCors();

    await app.listen(3000);
}
bootstrap();
