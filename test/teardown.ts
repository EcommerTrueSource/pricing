import * as Bull from 'bull';

module.exports = async () => {
    try {
        // Limpa a fila de notificações
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
};
