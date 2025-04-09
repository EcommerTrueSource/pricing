# Schema do Banco de Dados

## 📋 Visão Geral

O banco de dados utiliza PostgreSQL com Prisma como ORM. O schema é composto por entidades principais que gerenciam o ciclo de vida dos contratos e suas relações.

## 🏗️ Entidades

### Sellers

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
    notifications notifications[]
}
```

**Campos:**
- `id`: Identificador único (UUID)
- `cnpj`: CNPJ do vendedor (único)
- `razao_social`: Razão social da empresa
- `email`: Email de contato
- `telefone`: Telefone de contato
- `endereco`: Endereço completo
- `created_at`: Data de criação
- `updated_at`: Data da última atualização

**Relações:**
- `contracts`: Contratos associados
- `notifications`: Notificações enviadas

### Contracts

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
    notifications        notifications[]
}
```

**Campos:**
- `id`: Identificador único (UUID)
- `seller_id`: ID do vendedor
- `template_id`: ID do template
- `status`: Status do contrato
- `content`: Conteúdo do contrato
- `external_id`: ID externo (Autentique)
- `signing_url`: URL para assinatura
- `notification_attempts`: Tentativas de notificação
- `last_notification_at`: Última notificação
- `signed_at`: Data da assinatura
- `expires_at`: Data de expiração
- `created_at`: Data de criação
- `updated_at`: Data da última atualização

**Relações:**
- `seller`: Vendedor associado
- `template`: Template utilizado
- `notifications`: Notificações enviadas

### Contract Templates

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

**Campos:**
- `id`: Identificador único (UUID)
- `name`: Nome do template
- `content`: Conteúdo do template
- `version`: Versão do template
- `is_active`: Status de ativação
- `created_at`: Data de criação
- `updated_at`: Data da última atualização

**Relações:**
- `contracts`: Contratos criados

### Notifications

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

**Campos:**
- `id`: Identificador único (UUID)
- `contract_id`: ID do contrato
- `seller_id`: ID do vendedor
- `type`: Tipo de notificação
- `channel`: Canal de envio
- `content`: Conteúdo da mensagem
- `status`: Status da notificação
- `attempt_number`: Número da tentativa
- `external_id`: ID externo
- `sent_at`: Data de envio
- `delivered_at`: Data de entrega
- `created_at`: Data de criação

**Relações:**
- `contract`: Contrato associado
- `seller`: Vendedor associado

## 📊 Enums

### Contract Status

```prisma
enum contract_status {
    DRAFT
    PENDING_SIGNATURE
    SIGNED
    EXPIRED
    CANCELLED
}
```

### Notification Type

```prisma
enum notification_type {
    CONTRACT_PENDING
    CONTRACT_SIGNED
    CONTRACT_EXPIRED
    REMINDER
}
```

### Notification Channel

```prisma
enum notification_channel {
    WHATSAPP
}
```

### Notification Status

```prisma
enum notification_status {
    PENDING
    SENT
    DELIVERED
    FAILED
}
```

## 🔍 Índices

### Sellers
- `cnpj`: Índice único para busca rápida

### Contracts
- `seller_id`: Índice para relacionamento
- `template_id`: Índice para relacionamento
- `status`: Índice para filtros
- `expires_at`: Índice para expiração

### Notifications
- `contract_id`: Índice para relacionamento
- `seller_id`: Índice para relacionamento
- `status`: Índice para filtros
- `sent_at`: Índice para tracking

## 🔄 Migrações

### Criar Nova Migração
```bash
npx prisma migrate dev --name [nome-da-migracao]
```

### Aplicar Migrações
```bash
npx prisma migrate deploy
```

### Reverter Migração
```bash
npx prisma migrate reset
```

### Migrações em Produção (Cloud Run Jobs)

As migrações em ambiente de produção são executadas através de Cloud Run Jobs,
com um pipeline dedicado e isolado do deploy da aplicação.

#### Arquitetura de Migração
- **Job dedicado**: `pricing-migration-job`
- **Recursos**: 2GB de RAM, 2 CPUs
- **Retry automático**: até 3 tentativas
- **Timeout**: 30 minutos

#### Como funciona
1. O arquivo `cloudbuild-migration.yaml` define o pipeline específico para migrações
2. O script `src/prisma-migrate.ts` é executado quando a variável `PRISMA_MIGRATE=true`
3. O script realiza a migração e valida a conexão com o banco após a conclusão
4. Os logs são enviados para o Cloud Logging

#### Vantagens
- Separação de responsabilidades (migração ≠ deploy)
- Recursos dedicados para operações de banco
- Maior segurança e confiabilidade
- Melhor observabilidade do processo

#### Ativação do Trigger
O trigger de migração é ativado automaticamente quando há modificações em:
- Arquivos de schema Prisma (`prisma/**/*.prisma`)
- Outros arquivos na pasta prisma (`prisma/**/*`)
- Script de migração (`src/prisma-migrate.ts`)

## 📝 Boas Práticas

1. **Backup**
   - Backup diário automático
   - Retenção de 30 dias
   - Teste de restauração mensal

2. **Manutenção**
   - Vacuum semanal
   - Reindex mensal
   - Monitoramento de performance

3. **Segurança**
   - Criptografia em trânsito
   - Backup criptografado
   - Acesso restrito

4. **Monitoramento**
   - Métricas de performance
   - Alertas de erro
   - Logs de acesso
