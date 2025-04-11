#!/bin/bash

# Define variáveis
PROJECT_ID="truebrands-warehouse"
REGION="southamerica-east1"
# SERVICE_NAME="pricing" # Não precisamos mais disso

# Obter a imagem mais recente do serviço
# IMAGE_NAME=$(gcloud run services describe $SERVICE_NAME \\
#  --region $REGION \\
#  --format "value(spec.template.spec.containers[0].image)" | cut -d\\'@\\' -f1)
#
# if [ -z "$IMAGE_NAME" ]; then
#  echo "ERRO: Não foi possível obter a imagem do serviço $SERVICE_NAME. Verifique se o serviço existe e se o nome está correto."
#  exit 1
# fi

# Usar diretamente a tag latest que o build principal deve ter criado
IMAGE_NAME="southamerica-east1-docker.pkg.dev/$PROJECT_ID/pricing-repo/pricing:latest"

echo "Imagem que será usada: $IMAGE_NAME"

# Comando original do Prisma
PRISMA_COMMAND="npx"
PRISMA_ARGS="prisma,migrate,deploy"

# Criar ou atualizar o job com comando Prisma
if gcloud run jobs describe prisma-migration-job --region $REGION &>/dev/null; then
  echo "Atualizando job existente com comando Prisma..."
  gcloud run jobs update prisma-migration-job \
    --region $REGION \
    --image $IMAGE_NAME \
    --command $PRISMA_COMMAND \
    --args="$PRISMA_ARGS" \
    --set-cloudsql-instances $PROJECT_ID:$REGION:pricing \
    --service-account=pricing-contract@$PROJECT_ID.iam.gserviceaccount.com \
    --set-secrets DATABASE_URL=pricing-database-url:latest \
    --memory=512Mi \
    --cpu=1 \
    --max-retries=3 \
    --task-timeout=10m
else
  echo "Criando novo job com comando Prisma..."
  gcloud run jobs create prisma-migration-job \
    --region $REGION \
    --image $IMAGE_NAME \
    --command $PRISMA_COMMAND \
    --args="$PRISMA_ARGS" \
    --set-cloudsql-instances $PROJECT_ID:$REGION:pricing \
    --service-account=pricing-contract@$PROJECT_ID.iam.gserviceaccount.com \
    --set-secrets DATABASE_URL=pricing-database-url:latest \
    --memory=512Mi \
    --cpu=1 \
    --max-retries=3 \
    --task-timeout=10m
fi

if [ $? -ne 0 ]; then
  echo "ERRO: Falha ao criar ou atualizar o Cloud Run Job."
  exit 1
fi

# Executar o job de migração
echo "Executando job de migração..."
gcloud run jobs execute prisma-migration-job --region $REGION --wait

if [ $? -ne 0 ]; then
  echo "ERRO: Falha ao executar o Cloud Run Job de migração."
  # Não sair com erro aqui necessariamente, pois o job pode ter falhado mas queremos que o build continue se integrado
  # A falha será visível nos logs do job.
  echo "Verifique os logs do Cloud Run Job para detalhes da falha."
fi

echo "✅ Execução do job de migração iniciada (ou tentada). Verifique os logs do Cloud Run Job para o status final."
