/* eslint-disable prettier/prettier */
import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';
import * as dotenv from 'dotenv';

// Carrega as variáveis do .env.local
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function startStudio() {
    try {
        // Configura o timezone da sessão
        await prisma.$executeRaw`SET timezone TO 'America/Sao_Paulo'`;
        console.log('Timezone configurado para America/Sao_Paulo');

        // Inicia o Prisma Studio
        const studio = spawn('npx', ['dotenv', '-e', '.env.local', '--', 'prisma', 'studio'], {
            stdio: 'inherit',
            shell: true,
        });

        studio.on('error', (error) => {
            console.error('Erro ao iniciar Prisma Studio:', error);
        });
    } catch (error) {
        console.error('Erro ao configurar timezone:', error);
    } finally {
        await prisma.$disconnect();
    }
}

startStudio();
