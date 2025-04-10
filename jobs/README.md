# Migrações de Banco de Dados com Cloud Run Jobs

Este diretório contém arquivos para executar migrações de banco de dados usando Cloud Run Jobs, que é a abordagem recomendada pelo Google Cloud para tarefas administrativas como migrações.

## Arquivos

- `prisma-migration-job.yaml`: Definição do job para Cloud Run
- `create-migration-job.sh`: Script para criar e executar o job

## Vantagens dessa abordagem

1. **Segurança**: Executa com as mesmas permissões e configurações do seu serviço
2. **Simplicidade**: Usa a mesma imagem do seu serviço Cloud Run
3. **Confiabilidade**: Retry automático e logs completos
4. **Isolamento**: Executa as migrações como um processo separado da aplicação

## Como usar

### Opção 1: Execução manual do job

```bash
# No ambiente local com acesso ao Google Cloud
bash jobs/create-migration-job.sh
```

### Opção 2: Pipeline de migração separado (Recomendado)

Mantenha o `cloudbuild-migration.yaml` como um pipeline separado para migrações:

1. Primeiro, faça o deploy normal da aplicação:
   ```bash
   gcloud builds submit --config=cloudbuild.yaml
   ```

2. Depois, execute o pipeline de migração separadamente:
   ```bash
   gcloud builds submit --config=cloudbuild-migration.yaml
   ```

### Opção 3: Configurar um gatilho separado para migrações

No Cloud Build, configure um gatilho específico para migrações:

1. Crie um gatilho que use o arquivo `cloudbuild-migration.yaml`
2. Configure para ser executado manualmente ou quando houver alterações em `/prisma/`

### Opção 4: Integração futura com pipeline principal (Após validação)

Após validar que o processo de migração é estável, você pode considerar integrar ao pipeline principal adicionando ao final do `cloudbuild.yaml`:

```yaml
# Executar migrações após o deploy bem-sucedido
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk:slim'
  id: 'executar-migracoes'
  waitFor: ['health-check']
  entrypoint: bash
  args:
    - '-c'
    - |
      gcloud run jobs execute prisma-migration-job --region=southamerica-east1 --wait || echo "Aviso: Migração não foi executada. Execute manualmente se necessário."
```

O uso do `|| echo...` garante que falhas na migração não impeçam o sucesso do deploy principal.

## Referências

- [Running database migrations with Cloud Run Jobs](https://cloud.google.com/blog/topics/developers-practitioners/running-database-migrations-cloud-run-jobs/)
- [Prisma Migrate in production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/production-and-testing)
