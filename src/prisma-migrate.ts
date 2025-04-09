import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runMigration() {
    console.log('==== INICIANDO PROCESSO DE MIGRAÇÃO DO BANCO DE DADOS ====');

    try {
        // Executar a migração usando o CLI do Prisma
        console.log('Executando migração do Prisma...');
        const { stdout, stderr } = await execAsync('npx prisma migrate deploy');

        console.log('Saída da migração:');
        console.log(stdout);

        if (stderr) {
            console.error('Erros durante a migração:');
            console.error(stderr);
        }

        // Verificar que a migração funcionou tentando conectar ao banco
        console.log('Verificando conexão com o banco após a migração...');
        const prisma = new PrismaClient();
        await prisma.$connect();

        // Executar uma query simples para verificar a conexão
        const result = await prisma.$queryRaw`SELECT 1 as connection_test`;
        console.log('Conexão verificada com sucesso:', result);

        await prisma.$disconnect();

        console.log('✅ Migração completada com sucesso');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro durante a migração:');
        console.error(error);
        process.exit(1);
    }
}

// Executar a migração se PRISMA_MIGRATE=true
if (process.env.PRISMA_MIGRATE === 'true') {
    runMigration();
}
