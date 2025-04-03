import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import * as Bull from 'bull';

module.exports = async () => {
    // Carrega as variáveis de ambiente do .env.local
    ConfigModule.forRoot({
        envFilePath: '.env.local',
    });

    // Limpa a fila de notificações antes de iniciar os testes
    try {
        const queue = Bull('notifications', {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
                tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
            },
        });

        await queue.clean(0, 'completed');
        await queue.clean(0, 'failed');
        await queue.clean(0, 'delayed');
        await queue.clean(0, 'wait');
        await queue.clean(0, 'active');

        await queue.close();
    } catch (error) {
        console.error('Erro ao limpar filas do Redis:', error);
    }

    // Configura o BullModule para usar Redis em memória para testes
    await BullModule.forRoot({
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
        },
    });
};
