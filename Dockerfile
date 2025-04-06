# Estágio de build
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# Estágio de produção
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

# Criar diretório para secrets
RUN mkdir -p /app/secrets

# Configurar permissões
RUN chown -R node:node /app
USER node

# Expor porta
EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["node", "dist/main"]
