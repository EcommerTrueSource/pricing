# Sistema de Gestão de Contratos

Sistema desenvolvido em NestJS para gerenciamento de contratos, integração com serviços externos e automação de fluxos de assinatura.

## 🚀 Tecnologias

- **Framework**: NestJS
- **Linguagem**: TypeScript
- **Banco de Dados**: PostgreSQL
- **ORM**: Prisma
- **Documentação**: Swagger
- **Integrações**:
  - Brasil API (consulta de CNPJ)
  - Autentique (assinatura digital)
  - Google Docs (templates)
  - WhatsApp (notificações)

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL 14+
- Google Cloud Platform (para Google Docs)
- Conta Autentique
- Conta WhatsApp Business

## 🔧 Configuração

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/pricing.git
cd pricing
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

4. Configure as seguintes variáveis no arquivo `.env`:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/pricing?schema=public"

# Brasil API
BRASIL_API_URL="https://brasilapi.com.br/api/cnpj/v1"

# Autentique
AUTENTIQUE_API_KEY="sua-chave-api"
AUTENTIQUE_API_URL="https://api.autentique.com.br/v2"

# Google Docs
GOOGLE_DOC_ID="id-do-documento-template"
GOOGLE_CREDENTIALS="credenciais-do-google"

# WhatsApp
WHATSAPP_API_KEY="sua-chave-api"
WHATSAPP_API_URL="https://api.whatsapp.com/v1"
```

5. Execute as migrações do banco de dados:
```bash
npx prisma migrate dev
```

## 🏗️ Arquitetura

O projeto segue uma arquitetura modular com os seguintes componentes principais:

### Módulos

1. **Contract Management**
   - Gerenciamento de contratos
   - Templates de contrato
   - Notificações
   - Webhooks

2. **Integration**
   - Brasil API
   - Autentique
   - Google Docs
   - WhatsApp

3. **Security**
   - Autenticação
   - Autorização
   - Rate Limiting

### Estrutura de Diretórios

```
src/
├── modules/
│   ├── contract-management/
│   │   ├── contract/
│   │   ├── template/
│   │   ├── notification/
│   │   └── webhook/
│   ├── integration/
│   │   ├── brasil-api/
│   │   ├── autentique/
│   │   ├── google-docs/
│   │   └── whatsapp/
│   └── security/
├── shared/
│   ├── services/
│   └── modules/
└── app.module.ts
```

## 📊 Banco de Dados

### Schema

#### Sellers
```prisma
model sellers {
  id            String     @id @default(uuid())
  cnpj          String     @unique
  razao_social  String
  email         String
  telefone      String
  endereco      String
  created_at    DateTime   @default(now())
  updated_at    DateTime   @updatedAt
  contracts     contracts[]
}
```

#### Contracts
```prisma
model contracts {
  id                    String         @id @default(uuid())
  seller_id            String
  template_id          String
  status               contract_status
  content              String
  external_id          String
  signing_url          String
  notification_attempts Int            @default(0)
  last_notification_at DateTime
  signed_at            DateTime?
  expires_at           DateTime
  created_at           DateTime        @default(now())
  updated_at           DateTime        @updatedAt
  seller               sellers         @relation(fields: [seller_id], references: [id])
  template             contract_templates @relation(fields: [template_id], references: [id])
}
```

#### Contract Templates
```prisma
model contract_templates {
  id        String     @id @default(uuid())
  name      String
  content   String
  version   String
  is_active Boolean    @default(true)
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  contracts contracts[]
}
```

#### Notifications
```prisma
model notifications {
  id           String           @id @default(uuid())
  contract_id  String
  seller_id    String
  type         notification_type
  channel      notification_channel
  content      String
  status       notification_status
  attempt_number Int
  external_id  String
  sent_at      DateTime
  delivered_at DateTime?
  created_at   DateTime        @default(now())
  contract     contracts       @relation(fields: [contract_id], references: [id])
  seller       sellers         @relation(fields: [seller_id], references: [id])
}
```

## 🔄 Fluxos

### 1. Criação de Contrato via Webhook

1. Recebe webhook com dados do vendedor (CNPJ, email, telefone)
2. Valida os dados recebidos
3. Busca dados na Brasil API
4. Verifica se o vendedor já existe:
   - Se não existe: cria novo vendedor
   - Se existe: atualiza email e telefone
5. Verifica se o vendedor já tem contrato assinado:
   - Se tem: retorna mensagem
   - Se não tem: continua o fluxo
6. Obtém o template ativo
7. Cria uma cópia do template com dados do seller
8. Cria o contrato
9. Envia para assinatura
10. Retorna dados do contrato criado

### 2. Notificações

1. Contrato criado e enviado para assinatura
2. Sistema agenda primeira notificação
3. Envia notificação via WhatsApp
4. Se não assinar em 5 dias:
   - Agenda nova notificação
   - Incrementa contador de tentativas
5. Máximo de 5 tentativas de notificação

## 🧪 Testes

O projeto possui três níveis de testes:

1. **Unitários**
   - Testam componentes isolados
   - Mocks para dependências
   - Cobertura mínima de 80%

2. **Integração**
   - Testam integrações com serviços externos
   - Validação de respostas
   - Tratamento de erros

3. **E2E**
   - Testam fluxos completos
   - Simulação de cenários reais
   - Validação de resultados

Para executar os testes:
```bash
# Unitários
npm run test

# Integração
npm run test:e2e

# Cobertura
npm run test:cov
```

## 📚 Documentação

A documentação da API está disponível via Swagger em:
```
http://localhost:3000/api
```

## 🔒 Segurança

- Validação de inputs
- Sanitização de outputs
- Autenticação JWT
- RBAC (Role-Based Access Control)
- Rate Limiting
- Proteção contra ataques comuns (OWASP)

## 🚀 Deploy

1. Build do projeto:
```bash
npm run build
```

2. Executar migrações:
```bash
npx prisma migrate deploy
```

3. Iniciar aplicação:
```bash
npm run start:prod
```

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
