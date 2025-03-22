/* eslint-disable prettier/prettier */
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Carrega as variáveis do .env.local
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function configureTimezone() {
  try {
    // Configura o timezone do banco de dados
    await prisma.$executeRaw`
      ALTER DATABASE "contract-management" SET timezone TO 'America/Sao_Paulo'
    `;

    // Ajusta a coluna updated_at
    await prisma.$executeRaw`
      ALTER TABLE "sellers" 
      ALTER COLUMN "updated_at" TYPE timestamptz(6) 
      USING "updated_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'
    `;

    // Ajusta a coluna created_at
    await prisma.$executeRaw`
      ALTER TABLE "sellers" 
      ALTER COLUMN "created_at" TYPE timestamptz(6) 
      USING "created_at" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'
    `;

    // Configura a sessão atual
    await prisma.$executeRaw`SET timezone TO 'America/Sao_Paulo'`;

    console.log('Timezone configurado com sucesso!');
  } catch (error) {
    console.error('Erro ao configurar timezone:', error);
  } finally {
    await prisma.$disconnect();
  }
}

configureTimezone();
