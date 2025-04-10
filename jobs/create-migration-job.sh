#!/bin/bash

# Define variáveis
PROJECT_ID="truebrands-warehouse"
REGION="southamerica-east1"
SERVICE_NAME="pricing"

# Obter a imagem mais recente do serviço
IMAGE_NAME=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --format "value(spec.template.spec.containers[0].image)" | cut -d'@' -f1)

echo "Imagem que será usada: $IMAGE_NAME"

# Substituir a variável de imagem no arquivo de job
sed "s|\${IMAGE_NAME}|$IMAGE_NAME|g" jobs/prisma-migration-job.yaml > jobs/prisma-migration-job-temp.yaml

# Criar ou atualizar o job
if gcloud run jobs describe prisma-migration-job --region $REGION &>/dev/null; then
  echo "Atualizando job existente..."
  gcloud run jobs update prisma-migration-job \
    --region $REGION \
    --image $IMAGE_NAME \
    --command "npx" \
    --args "prisma,migrate,deploy" \
    --set-cloudsql-instances $PROJECT_ID:$REGION:pricing \
    --service-account=pricing-contract@$PROJECT_ID.iam.gserviceaccount.com \
    --set-secrets DATABASE_URL=pricing-database-url:latest
else
  echo "Criando novo job..."
  gcloud run jobs create prisma-migration-job \
    --region $REGION \
    --image $IMAGE_NAME \
    --command "npx" \
    --args "prisma,migrate,deploy" \
    --set-cloudsql-instances $PROJECT_ID:$REGION:pricing \
    --service-account=pricing-contract@$PROJECT_ID.iam.gserviceaccount.com \
    --set-secrets DATABASE_URL=pricing-database-url:latest
fi

# Executar o job
echo "Executando job de migração..."
gcloud run jobs execute prisma-migration-job --region $REGION --wait

# Limpar arquivos temporários
rm jobs/prisma-migration-job-temp.yaml