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

# Copiar os arquivos gerados pelo Prisma
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma

COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

# Adicionar comando para gerar o cliente Prisma em tempo de execução
RUN npx prisma generate

# Configurar variável de ambiente para a porta
ENV PORT=8080

# Criar diretório para secrets
RUN mkdir -p /secrets
ENV DOTENV_PATH=/secrets/.env.local

# Configurar permissões
RUN chown -R node:node /app
RUN chown -R node:node /secrets
USER node

# Expor porta
EXPOSE 8080

# Comando para iniciar a aplicação
CMD ["node", "dist/main"]
