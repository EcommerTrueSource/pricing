# Módulo de Gerenciamento de Contratos

## 📋 Visão Geral

O módulo de gerenciamento de contratos é o core do sistema, responsável por:
- Cadastro e gestão de vendedores
- Criação e acompanhamento de contratos
- Templates de contrato
- Fluxo de assinatura
- Notificações automáticas

## 🏗️ Arquitetura

### Componentes Principais

1. **SellerService**
   - Cadastro de vendedores
   - Validação de CNPJ
   - Atualização de dados
   - Histórico de alterações

2. **ContractService**
   - Criação de contratos
   - Gestão de status
   - Integração com assinatura
   - Tracking de prazos

3. **TemplateService**
   - Gerenciamento de templates
   - Versionamento
   - Substituição de variáveis
   - Validação de conteúdo

4. **NotificationService**
   - Envio de notificações
   - Agendamento
   - Retry automático
   - Tracking de status

### Fluxos Principais

1. **Cadastro de Vendedor**
   - Validação de CNPJ
   - Criação do registro
   - Notificação de boas-vindas
   - Histórico de alterações

2. **Criação de Contrato**
   - Seleção do template
   - Substituição de variáveis
   - Upload do documento
   - Envio para assinatura

3. **Fluxo de Assinatura**
   - Notificação inicial
   - Lembretes periódicos
   - Tracking de status
   - Download do documento

## 🔧 Configuração

### Variáveis de Ambiente

```env
# Banco de Dados
DATABASE_URL=postgresql://user:password@localhost:5432/pricing

# Autentique
AUTENTIQUE_API_KEY=sua-chave
AUTENTIQUE_API_URL=https://api.autentique.com.br/v2

# WhatsApp
WHATSAPP_API_KEY=sua-chave
WHATSAPP_API_URL=https://api.whatsapp.com/v1
```

### Configuração do Módulo

```typescript
@Module({
    imports: [
        PrismaModule,
        SecurityModule,
        SellerModule,
        ContractModule,
        TemplateModule,
        NotificationModule,
        IntegrationModule,
    ],
    providers: [
        SellerService,
        ContractService,
        TemplateService,
        NotificationService,
    ],
})
export class ContractManagementModule {}
```

## 📝 Uso

### Cadastro de Vendedor

```typescript
// Criar vendedor
const seller = await sellerService.create({
    cnpj: string,
    razaoSocial: string,
    email: string,
    telefone: string,
    endereco: string,
});

// Atualizar dados
const updated = await sellerService.update(sellerId, {
    email: string,
    telefone: string,
});
```

### Gerenciamento de Contrato

```typescript
// Criar contrato
const contract = await contractService.create({
    sellerId: string,
    templateId: string,
    content: string,
});

// Enviar para assinatura
const signature = await contractService.sendForSignature(contractId);

// Verificar status
const status = await contractService.getStatus(contractId);
```

### Templates

```typescript
// Criar template
const template = await templateService.create({
    name: string,
    content: string,
    version: string,
});

// Atualizar template
const updated = await templateService.update(templateId, {
    content: string,
    version: string,
});
```

## 🔍 Monitoramento

### Métricas

- Total de vendedores
- Contratos ativos
- Taxa de assinatura
- Tempo médio de assinatura

### Logs

- Criação de vendedor
- Alteração de dados
- Criação de contrato
- Mudanças de status
- Notificações enviadas

## 🐛 Troubleshooting

### Problemas Comuns

1. **Validação de CNPJ**
   - Verificar formato
   - Consultar Brasil API
   - Validar dados retornados

2. **Falha na Assinatura**
   - Verificar status do documento
   - Validar dados do signatário
   - Checar notificações

3. **Template Inválido**
   - Verificar variáveis
   - Validar formatação
   - Testar substituição

### Soluções

1. **Reset de Status**
```typescript
await contractService.resetStatus(contractId);
```

2. **Forçar Notificação**
```typescript
await notificationService.forceNotification(contractId);
```

3. **Validar Template**
```typescript
await templateService.validate(templateId);
```

## 📚 Referência da API

### SellerService

```typescript
interface SellerService {
    create(data: CreateSellerDto): Promise<Seller>;
    update(id: string, data: UpdateSellerDto): Promise<Seller>;
    getById(id: string): Promise<Seller>;
    validateCnpj(cnpj: string): Promise<boolean>;
}
```

### ContractService

```typescript
interface ContractService {
    create(data: CreateContractDto): Promise<Contract>;
    sendForSignature(id: string): Promise<Signature>;
    getStatus(id: string): Promise<ContractStatus>;
    resetStatus(id: string): Promise<void>;
}
```

### TemplateService

```typescript
interface TemplateService {
    create(data: CreateTemplateDto): Promise<Template>;
    update(id: string, data: UpdateTemplateDto): Promise<Template>;
    validate(id: string): Promise<boolean>;
    getActiveVersion(): Promise<Template>;
}
```

### NotificationService

```typescript
interface NotificationService {
    sendNotification(data: SendNotificationDto): Promise<Notification>;
    getStatus(id: string): Promise<NotificationStatus>;
    forceNotification(contractId: string): Promise<void>;
}
```
