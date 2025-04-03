# Sistema de Gerenciamento de Contratos

Sistema para gerenciamento de contratos com integração de assinatura digital e notificações via WhatsApp.

## 🚀 Visão Geral

O sistema é composto por três módulos principais:

1. **Gerenciamento de Contratos**
   - Cadastro e gerenciamento de vendedores
   - Criação e gestão de contratos
   - Templates de contrato
   - Notificações automáticas
   - Webhooks para integração

2. **Integrações**
   - Autentique (assinatura digital)
   - Brasil API (validação de CNPJ)
   - WhatsApp (notificações)
   - Redis (cache e filas)

3. **Segurança**
   - Autenticação e autorização
   - Validação de dados
   - Rate limiting

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL
- Redis
- Docker (opcional)

## 🔧 Instalação

1. Clone o repositório
```bash
git clone [url-do-repositorio]
```

2. Instale as dependências
```bash
npm install
```

3. Configure as variáveis de ambiente
```bash
cp .env.example .env
```

4. Execute as migrações do banco de dados
```bash
npm run prisma:migrate
```

5. Inicie o servidor
```bash
npm run start:dev
```

## 🏗️ Arquitetura

### Módulos Principais

#### Contract Management
- **Seller**: Gerenciamento de vendedores
- **Contract**: Gestão de contratos
- **Template**: Templates de contrato
- **Notification**: Sistema de notificações
- **Webhook**: Integrações externas

#### Integration
- **Autentique**: Assinatura digital
- **Brasil API**: Validação de CNPJ
- **WhatsApp**: Notificações
- **Redis**: Cache e filas

### Tecnologias Utilizadas

- **Backend**: NestJS
- **Banco de Dados**: PostgreSQL com Prisma
- **Cache e Filas**: Redis com Bull
- **Autenticação**: JWT
- **Documentação**: Swagger

## 📝 Fluxos Principais

### 1. Criação de Contrato
1. Cadastro do vendedor
2. Validação de CNPJ
3. Criação do contrato
4. Envio para assinatura
5. Notificação via WhatsApp

### 2. Notificações
1. Enfileiramento de notificações
2. Processamento assíncrono
3. Retry automático
4. Tracking de status

### 3. Assinatura Digital
1. Upload do contrato
2. Envio para assinatura
3. Webhook de atualização
4. Atualização de status

## 🔐 Segurança

- Validação de CNPJ
- Rate limiting
- Autenticação JWT
- Autorização por roles
- Sanitização de dados

## 📊 Monitoramento

- Logs estruturados
- Métricas de performance
- Alertas de erro
- Tracking de notificações

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para suporte, envie um email para [email-de-suporte]
