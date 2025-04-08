# Sistema de Gerenciamento de Contratos e Pricing

Um sistema robusto e escalável para gerenciamento de contratos e vendedores, com integração de assinatura digital, notificações automatizadas e validação de dados empresariais.

## 🚀 Visão Geral

O sistema foi desenvolvido utilizando arquitetura limpa (Clean Architecture) e princípios SOLID, com ênfase em manutenibilidade e escalabilidade. A aplicação é composta por módulos independentes e bem definidos:

### Módulos Principais

1. **Gerenciamento de Contratos**
   - Cadastro e gerenciamento de vendedores com validação de CNPJ
   - Criação, atualização e monitoramento de contratos
   - Templates personalizáveis para documentos
   - Histórico de status e alterações
   - Sistema avançado de notificações e lembretes

2. **Integrações Externas**
   - **Autentique**: Assinatura digital de contratos
   - **Brasil API** e **CNPJWS**: Validação e enriquecimento de dados de CNPJ
   - **Z-API/WhatsApp**: Envio de notificações via WhatsApp
   - **Google Docs**: Geração de documentos a partir de templates
   - **Google OAuth**: Autenticação de usuários

3. **Segurança e Infraestrutura**
   - Autenticação com Google OAuth e JWT
   - Controle de acesso baseado em funções (RBAC)
   - Rate limiting para proteção contra abuso
   - Validação rigorosa de dados de entrada
   - Sistema de filas para processamento assíncrono

## 📋 Requisitos Técnicos

- **Node.js 18+**
- **PostgreSQL** (Cloud SQL em produção)
- **Redis** (para filas e rate limiting)
- **Google Cloud Platform**:
  - Cloud Run
  - Secret Manager
  - Cloud SQL
  - IAM & Admin

## 🔧 Configuração e Instalação

### Desenvolvimento Local

1. **Clone o repositório**
```bash
git clone https://github.com/EcommerTrueSource/pricing.git
cd pricing
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env.local
```
Edite o arquivo `.env.local` com suas credenciais e configurações.

4. **Gere os clientes Prisma**
```bash
npm run prisma:generate
```

5. **Execute as migrações**
```bash
npm run prisma:migrate
```

6. **Inicie o servidor de desenvolvimento**
```bash
npm run start:dev
```

7. **Acesse a documentação da API**
```
http://localhost:3000/api
```

### Produção com Google Cloud Run

1. **Configuração do Google Cloud**
   - Crie um projeto no Google Cloud
   - Configure o Cloud SQL (PostgreSQL)
   - Configure o Secret Manager para armazenar as variáveis de ambiente
   - Configure as permissões IAM necessárias

2. **Deploy**
```bash
gcloud builds submit --config=cloudbuild.yaml
```

3. **Variáveis de Ambiente (Secret Manager)**
   - DATABASE_URL: URL de conexão com o PostgreSQL
   - GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET: Credenciais OAuth
   - JWT_SECRET: Chave para assinatura de tokens
   - FRONTEND_URL: URL do frontend da aplicação
   - Outras variáveis específicas de integração

## 🏗️ Arquitetura

A aplicação segue uma arquitetura modular com clara separação de responsabilidades:

```
src/
├── modules/                      # Módulos principais da aplicação
│   ├── contract-management/      # Gerenciamento de contratos
│   │   ├── contract/             # Contratos
│   │   ├── seller/               # Vendedores
│   │   ├── template/             # Templates de documentos
│   │   ├── notification/         # Sistema de notificações
│   │   ├── webhook/              # Webhooks e integrações
│   │   └── events/               # Sistema de eventos
│   ├── integration/              # Integrações com serviços externos
│   │   ├── autentique/           # Assinatura digital
│   │   ├── brasil-api/           # Validação de dados empresariais
│   │   ├── cnpjws/               # Consulta de CNPJ alternativa
│   │   ├── whatsapp/             # Notificações via WhatsApp
│   │   └── redis/                # Configuração do Redis e filas
│   └── security/                 # Autenticação e autorização
│       ├── controllers/          # Controladores de auth
│       ├── strategies/           # Estratégias de autenticação
│       └── guards/               # Guards de autorização
└── shared/                       # Código compartilhado
    ├── modules/                  # Módulos compartilhados
    └── services/                 # Serviços compartilhados
```

### Tecnologias Principais

- **Backend Framework**: NestJS
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Queuing**: Bull/Redis
- **Authentication**: Passport.js com Google OAuth e JWT
- **Documentation**: Swagger/OpenAPI
- **Cloud**: Google Cloud Run, Cloud SQL, Secret Manager
- **Container**: Docker

## 🔄 Fluxos Principais

### Ciclo de Vida do Contrato

1. **Criação do Vendedor**
   - Validação e enriquecimento de dados via APIs externas
   - Armazenamento de informações completas do CNPJ

2. **Criação do Contrato**
   - Seleção de template
   - Preenchimento automático de dados do vendedor
   - Geração de documento a partir do template

3. **Envio para Assinatura**
   - Integração com Autentique
   - Geração de URL para assinatura
   - Atualização de status via webhook

4. **Notificações**
   - Envio de lembretes via WhatsApp
   - Tentativas programadas (até 5)
   - Monitoramento de entregas

5. **Finalização**
   - Arquivamento do contrato assinado
   - Atualização de status
   - Notificação de conclusão

## 🧪 Testes

O projeto inclui testes unitários, de integração e end-to-end:

```bash
# Testes unitários
npm run test

# Testes e2e
npm run test:e2e

# Testes de integração específicos
npm run test:whatsapp
```

## 🚢 Continuous Integration/Deployment

O sistema utiliza Google Cloud Build para CI/CD:

- **Ambiente de Desenvolvimento**: Deploy automático a partir da branch `develop`
- **Ambiente de Produção**: Deploy a partir da branch `main`
- **Migrations**: Executadas automaticamente antes de cada deploy

## 📚 Documentação da API

A documentação da API está disponível via Swagger UI:

- **Ambiente de Desenvolvimento**: http://localhost:3000/api
- **Ambiente de Produção**: https://pricing-460815276546.southamerica-east1.run.app/api

## 🛡️ Segurança

- **Autenticação**: Google OAuth 2.0 + JWT
- **Autorização**: Sistema de roles (ADMIN, MANAGER, USER)
- **Proteção de Dados**: Mascaramento de credenciais em logs
- **Rate Limiting**: Proteção contra abuso de API
- **Validação**: Class-validator para validação de entrada

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch de feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📞 Suporte

Para suporte, envie um email para gabriel.nascimento@truebrands.com.br

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
