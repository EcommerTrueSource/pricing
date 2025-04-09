# Módulo de Integração

## 📋 Visão Geral

O módulo de integração é responsável por gerenciar as conexões com serviços externos, incluindo:
- Autentique (assinatura digital)
- Brasil API (validação de CNPJ)
- WhatsApp via Z-API (notificações)
- Redis (cache e filas)

## 🏗️ Arquitetura

### Componentes Principais

1. **AutentiqueService**
   - Upload de documentos
   - Criação de assinaturas
   - Webhook de status
   - Download de documentos

2. **BrasilApiService**
   - Consulta de CNPJ
   - Validação de dados
   - Cache de resultados
   - Tratamento de erros

3. **WhatsAppService**
   - Envio de mensagens via Z-API
   - Verificação de status de entrega
   - Formatação de conteúdo e templates
   - Rate limiting e controle de tentativas
   - Suporte a texto simples e links

4. **RedisService**
   - Cache de dados
   - Gerenciamento de filas
   - Pub/Sub
   - Persistência

### Fluxos Principais

1. **Assinatura Digital**
   - Upload do documento
   - Criação da assinatura
   - Envio para signatário
   - Tracking de status

2. **Validação de CNPJ**
   - Consulta na API
   - Cache de resultados
   - Validação de dados
   - Tratamento de erros

3. **Notificações**
   - Formatação de mensagem
   - Envio via WhatsApp
   - Verificação de status
   - Retry automático

## 🔧 Configuração

### Variáveis de Ambiente

```env
# Autentique
AUTENTIQUE_API_KEY=sua-chave
AUTENTIQUE_API_URL=https://api.autentique.com.br/v2

# Brasil API
BRASIL_API_URL=https://brasilapi.com.br/api/cnpj/v1

# Z-API (WhatsApp)
ZAPI_BASE_URL=https://api.z-api.io
ZAPI_INSTANCE_ID=seu-id
ZAPI_TOKEN=seu-token
ZAPI_CLIENT_TOKEN=seu-token-cliente

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=sua-senha
```

### Configuração de Serviços

```typescript
// Autentique
AutentiqueModule.register({
    apiKey: process.env.AUTENTIQUE_API_KEY,
    apiUrl: process.env.AUTENTIQUE_API_URL,
});

// Brasil API
BrasilApiModule.register({
    apiUrl: process.env.BRASIL_API_URL,
});

// WhatsApp
WhatsAppModule.register({
    apiKey: process.env.WHATSAPP_API_KEY,
    apiUrl: process.env.WHATSAPP_API_URL,
});

// Redis
RedisModule.register({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
});
```

## 📝 Uso

### Assinatura Digital

```typescript
// Upload de documento
const document = await autentiqueService.uploadDocument({
    file: Buffer,
    name: string,
    type: string,
});

// Criar assinatura
const signature = await autentiqueService.createSignature({
    documentId: string,
    signer: {
        name: string,
        email: string,
    },
});
```

### Validação de CNPJ

```typescript
// Consulta de CNPJ
const cnpjData = await brasilApiService.getCnpj(cnpj);

// Validação
const isValid = await brasilApiService.validateCnpj(cnpj);
```

### Envio de Mensagem

```typescript
// Enviar mensagem simples
await whatsappService.sendMessage({
    to: string,
    message: string,
});

// Enviar notificação de contrato
await whatsappService.sendContractNotification(
    phoneNumber,
    {
        razaoSocial: string,
        contractUrl: string,
        sellerId: string,
        notificationAttempts: number,
        messageContent: string
    }
);

// Verificar status
const status = await whatsappService.checkMessageStatus(messageId);
```

## 🔍 Monitoramento

### Métricas

- Taxa de sucesso das APIs
- Tempo de resposta
- Cache hit/miss
- Erros por serviço

### Logs

- Requisições às APIs
- Respostas recebidas
- Erros e exceções
- Cache operations

## 🐛 Troubleshooting

### Problemas Comuns

1. **Falha na API**
   - Verificar status do serviço
   - Validar credenciais
   - Checar rate limit

2. **Cache Inconsistente**
   - Verificar TTL
   - Limpar cache
   - Monitorar uso

3. **Webhook Falho**
   - Verificar endpoint
   - Validar payload
   - Checar retry

### Soluções

1. **Reset de Cache**
```typescript
await redisService.flushAll();
```

2. **Forçar Atualização**
```typescript
await brasilApiService.forceUpdate(cnpj);
```

3. **Reprocessar Webhook**
```typescript
await autentiqueService.reprocessWebhook(webhookId);
```

## 📚 Referência da API

### AutentiqueService

```typescript
interface AutentiqueService {
    uploadDocument(data: UploadDocumentDto): Promise<Document>;
    createSignature(data: CreateSignatureDto): Promise<Signature>;
    getDocumentStatus(id: string): Promise<DocumentStatus>;
    downloadDocument(id: string): Promise<Buffer>;
}
```

### BrasilApiService

```typescript
interface BrasilApiService {
    getCnpj(cnpj: string): Promise<CnpjData>;
    validateCnpj(cnpj: string): Promise<boolean>;
    clearCache(cnpj?: string): Promise<void>;
}
```

### WhatsAppService

```typescript
interface WhatsAppService {
    sendMessage(data: SendMessageDto): Promise<Message>;
    checkMessageStatus(id: string): Promise<MessageStatus>;
    validateNumber(number: string): Promise<boolean>;
}
```

### RedisService

```typescript
interface RedisService {
    get(key: string): Promise<string>;
    set(key: string, value: string, ttl?: number): Promise<void>;
    del(key: string): Promise<void>;
    flushAll(): Promise<void>;
}
```
