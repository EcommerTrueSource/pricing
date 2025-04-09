import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente antes de iniciar a migração
const envPath = process.env.DOTENV_PATH || path.resolve(process.cwd(), '.env.local');
console.log(`Carregando variáveis de ambiente de: ${envPath}`);
dotenv.config({ path: envPath });

// Verificar DATABASE_URL
if (process.env.DATABASE_URL) {
    const maskedUrl = process.env.DATABASE_URL.replace(
        /(postgresql:\/\/)([^:]+):([^@]+)@/,
        '$1$2:****@',
    );
    console.log(`DATABASE_URL original: ${maskedUrl}`);
} else {
    console.error('❌ DATABASE_URL: NÃO DEFINIDA');
    process.exit(1);
}

// CORREÇÃO CRÍTICA: Ajustar DATABASE_URL para usar o socket do Cloud SQL
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('host=/cloudsql/')) {
    const instanceName =
        process.env.INSTANCE_CONNECTION_NAME || 'truebrands-warehouse:southamerica-east1:pricing';
    const socketPath = `/cloudsql/${instanceName}`;

    // Adicionar parâmetro host se não existir
    if (process.env.DATABASE_URL.includes('?')) {
        process.env.DATABASE_URL += `&host=${socketPath}`;
    } else {
        process.env.DATABASE_URL += `?host=${socketPath}`;
    }

    const maskedUrlAjustada = process.env.DATABASE_URL.replace(
        /(postgresql:\/\/)([^:]+):([^@]+)@/,
        '$1$2:****@',
    );
    console.log(`URL do banco ajustada para usar socket Cloud SQL: ${instanceName}`);
    console.log(`DATABASE_URL ajustada: ${maskedUrlAjustada}`);
}

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
