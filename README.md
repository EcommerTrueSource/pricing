# Sistema de Gerenciamento de Contratos

Sistema de gerenciamento de contratos com integração Autentique para assinatura digital.

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- NPM ou Yarn

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/contract-management.git
cd contract-management
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
- Copie o arquivo `.env.example` para `.env`
- Preencha as variáveis necessárias:
  - `AUTENTIQUE_API_URL`: URL da API do Autentique
  - `AUTENTIQUE_API_KEY`: Chave de API do Autentique
  - `DATABASE_URL`: URL de conexão com o banco de dados

4. Execute as migrações do banco de dados:
```bash
npm run migration:run
```

## Executando o Projeto

1. Em desenvolvimento:
```bash
npm run start:dev
```

2. Em produção:
```bash
npm run build
npm run start
```

## Estrutura do Projeto

```
src/
├── modules/
│   ├── contract-management/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── entities/
│   │   └── dtos/
│   └── integration/
│       └── autentique/
│           ├── services/
│           ├── interfaces/
│           └── autentique.module.ts
├── config/
└── main.ts
```

## Funcionalidades

- Gerenciamento de contratos
- Integração com Autentique para assinatura digital
- Rate limiting para chamadas à API
- Validação de dados
- Logging de erros

## Testes

```bash
# Testes unitários
npm run test

# Testes e2e
npm run test:e2e
```

## Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🚀 Funcionalidades

- **Gestão de Contratos**

  - Criação, atualização e remoção de contratos
  - Controle de status e versões
  - Assinatura digital
  - Cancelamento com motivo

- **Gestão de Vendedores**

  - Cadastro completo de vendedores
  - Validação de CNPJ via Brasil API
  - Histórico de contratos

- **Templates de Contrato**

  - Versionamento de templates
  - Controle de versões ativas/inativas
  - Histórico de alterações

- **Sistema de Notificações**

  - Múltiplos canais (WhatsApp, Email, SMS)
  - Controle de status de envio
  - Retry automático
  - Histórico de tentativas

- **Segurança**
  - Autenticação JWT
  - Controle de acesso baseado em roles
  - Proteção de rotas
  - Validação de dados

## 🛠️ Tecnologias

- NestJS
- Prisma ORM
- PostgreSQL (Cloud SQL)
- JWT
- Swagger/OpenAPI
- Docker
- Brasil API

## 📋 Pré-requisitos

- Node.js (v16 ou superior)
- PostgreSQL (v12 ou superior)
- npm ou yarn
- Docker e Docker Compose (opcional)
- Conta Google Cloud Platform (para Cloud SQL)

## 🔧 Instalação

### Usando Docker (Recomendado)

1. Clone o repositório:

```bash
git clone https://github.com/seu-usuario/contract-management.git
cd contract-management
```

2. Configure as variáveis de ambiente:

```bash
cp .env.example .env.local
```

3. Inicie os containers:

```bash
docker-compose up -d
```

4. Execute as migrações do Prisma:

```bash
docker-compose exec api npx prisma migrate deploy
```

5. Acesse a aplicação:

```
http://localhost:3000/api
```

### Instalação Local

1. Clone o repositório:

```bash
git clone https://github.com/seu-usuario/contract-management.git
cd contract-management
```

2. Instale as dependências:

```bash
npm install
# ou
yarn install
```

3. Configure as variáveis de ambiente:

```bash
cp .env.example .env.local
```

4. Configure as variáveis no arquivo `.env.local`:

```env
# Ambiente
NODE_ENV=development

# Banco de Dados (Cloud SQL)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=pricing_db
INSTANCE_CONNECTION_NAME=seu-projeto:regiao:instancia

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRATION=1d

# APIs Externas
WHATSAPP_API_KEY=your-whatsapp-api-key
WHATSAPP_API_URL=https://api.whatsapp.com/v1

EMAIL_API_KEY=your-email-api-key
EMAIL_API_URL=https://api.email-service.com/v1

SMS_API_KEY=your-sms-api-key
SMS_API_URL=https://api.sms-service.com/v1

SIGNATURE_API_KEY=your-signature-api-key
SIGNATURE_API_URL=https://api.signature-service.com/v1

# Application
PORT=3000
API_PREFIX=api
```

5. Inicie o Cloud SQL Proxy:

```bash
npm run start:proxy
```

6. Em outro terminal, execute as migrações do Prisma:

```bash
npx prisma migrate deploy
```

7. Inicie o servidor:

```
