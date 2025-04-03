# Módulo de Notificação

## 📋 Visão Geral

O módulo de notificação é responsável por gerenciar o envio de mensagens para vendedores, utilizando o WhatsApp como canal principal. O sistema implementa um processamento assíncrono com retry automático e tracking de status.

## 🏗️ Arquitetura

### Componentes Principais

1. **NotificationService**
   - Gerenciamento de notificações
   - Persistência de dados
   - Integração com filas

2. **NotificationProcessor**
   - Processamento assíncrono
   - Retry automático
   - Tratamento de erros

3. **NotificationQueueService**
   - Gerenciamento de filas
   - Enfileiramento de jobs
   - Configuração de retry

4. **WhatsAppService**
   - Integração com API do WhatsApp
   - Formatação de mensagens
   - Tratamento de erros

### Fluxo de Notificação

1. **Criação**
   - Recebe dados da notificação
   - Valida informações
   - Persiste no banco
   - Enfileira para processamento

2. **Processamento**
   - Recupera dados do vendedor
   - Formata mensagem
   - Envia via WhatsApp
   - Atualiza status

3. **Retry**
   - Verifica falhas
   - Agenda nova tentativa
   - Incrementa contador
   - Máximo 5 tentativas

4. **Tracking**
   - Registra status
   - Armazena erros
   - Logs detalhados

## 🔧 Configuração

### Variáveis de Ambiente

```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# WhatsApp
WHATSAPP_API_KEY=sua-chave
WHATSAPP_API_URL=https://api.whatsapp.com/v1

# Bull Queue
QUEUE_PREFIX=notifications
MAX_ATTEMPTS=5
BACKOFF_DELAY=5000
```

### Configuração da Fila

```typescript
BullModule.registerQueue({
    name: 'notifications',
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
})
```

## 📝 Uso

### Enviando Notificação

```typescript
// Criar notificação
const notification = await notificationService.create({
    contractId: 'uuid',
    sellerId: 'uuid',
    type: 'CONTRACT_PENDING',
    channel: 'WHATSAPP',
});

// Enfileirar para processamento
await notificationQueueService.enqueueNotification(notification.id);
```

### Verificando Status

```typescript
// Obter status
const status = await notificationService.getStatus(notificationId);

// Verificar tentativas
const attempts = await notificationService.getAttempts(notificationId);
```

## 🔍 Monitoramento

### Métricas

- Total de notificações
- Taxa de sucesso
- Tempo médio de processamento
- Tentativas por notificação

### Logs

- Criação de notificação
- Início do processamento
- Sucesso no envio
- Falhas e erros
- Tentativas de retry

## 🐛 Troubleshooting

### Problemas Comuns

1. **Falha no Envio**
   - Verificar conexão com WhatsApp
   - Validar formato do número
   - Checar rate limit

2. **Retry Excessivo**
   - Verificar configuração de backoff
   - Analisar logs de erro
   - Checar status do vendedor

3. **Fila Parada**
   - Verificar status do Redis
   - Checar workers ativos
   - Analisar logs do Bull

### Soluções

1. **Reset de Status**
```typescript
await notificationService.resetStatus(notificationId);
```

2. **Forçar Retry**
```typescript
await notificationQueueService.forceRetry(notificationId);
```

3. **Limpar Fila**
```typescript
await notificationQueueService.cleanQueue();
```

## 📚 Referência da API

### NotificationService

```typescript
interface NotificationService {
    create(data: CreateNotificationDto): Promise<Notification>;
    getStatus(id: string): Promise<NotificationStatus>;
    getAttempts(id: string): Promise<number>;
    resetStatus(id: string): Promise<void>;
}
```

### NotificationQueueService

```typescript
interface NotificationQueueService {
    enqueueNotification(id: string): Promise<void>;
    forceRetry(id: string): Promise<void>;
    cleanQueue(): Promise<void>;
}
```

### WhatsAppService

```typescript
interface WhatsAppService {
    sendMessage(notification: Notification): Promise<void>;
    checkMessageStatus(messageId: string): Promise<MessageStatus>;
}
```
