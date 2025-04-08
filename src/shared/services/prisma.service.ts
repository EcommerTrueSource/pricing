import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        // Inicializa o PrismaClient primeiro para evitar erros
        super({
            log: ['query', 'info', 'warn', 'error'],
        });

        // Verifica se estamos no Cloud Run com Cloud SQL
        const dbUrl = process.env.DATABASE_URL;
        const instanceConnectionName =
            process.env.INSTANCE_CONNECTION_NAME ||
            'truebrands-warehouse:southamerica-east1:pricing';

        // Se estamos no Cloud Run (detectado pela variável K_SERVICE)
        if (process.env.K_SERVICE && dbUrl) {
            this.logger.log('Ambiente de Cloud Run detectado');

            // Extrai os componentes da URL do banco de dados
            try {
                // Usando regex para manipular a URL e manter todos os parâmetros existentes
                const dbRegex = /^(postgresql:\/\/)([^:]+):([^@]+)@([^\/]+)\/([^?]+)(\?.*)?$/;
                const match = dbUrl.match(dbRegex);

                if (match) {
                    const protocol = match[1]; // postgresql://
                    const username = match[2]; // pricing-system
                    const password = match[3]; // True%40%23012987
                    const host = match[4]; // localhost:5432
                    const database = match[5]; // contract-management
                    const queryParams = match[6] || ''; // ?param=value ou vazio

                    // Verifica se já temos o parâmetro host para socket
                    if (!queryParams.includes('host=/cloudsql')) {
                        const socketPath = `/cloudsql/${instanceConnectionName}`;

                        // Construa a nova URL com o parâmetro host
                        let newDbUrl = '';
                        if (queryParams) {
                            // Se já existem parâmetros, adicione host como mais um
                            newDbUrl = `${protocol}${username}:${password}@${host}/${database}${queryParams}&host=${socketPath}`;
                        } else {
                            // Se não há parâmetros, adicione host como o primeiro
                            newDbUrl = `${protocol}${username}:${password}@${host}/${database}?host=${socketPath}`;
                        }

                        process.env.DATABASE_URL = newDbUrl;
                        this.logger.log(
                            `URL do banco de dados ajustada para usar socket Unix do Cloud SQL`,
                        );
                    } else {
                        this.logger.log(`URL já está configurada para usar socket Unix`);
                    }
                } else {
                    this.logger.warn(
                        `Não foi possível analisar a URL do banco de dados: ${this.maskConnectionString(dbUrl)}`,
                    );
                }
            } catch (error) {
                this.logger.error(`Erro ao ajustar a URL do banco de dados: ${error.message}`);
            }
        }
    }

    async onModuleInit() {
        try {
            this.logger.log('Conectando ao banco de dados...');
            const dbUrl = process.env.DATABASE_URL || '';
            this.logger.log(`URL de conexão: ${this.maskConnectionString(dbUrl)}`);

            await this.$connect();
            this.logger.log('Conexão com o banco de dados estabelecida com sucesso');
        } catch (error) {
            this.logger.error(
                `Falha ao conectar com o banco de dados: ${error.message}`,
                error.stack,
            );

            // Exibe informações adicionais para diagnóstico
            if (error.message.includes('connect ECONNREFUSED')) {
                this.logger.error('Erro de conexão recusada. Verifique se:');
                this.logger.error('1. A instância do Cloud SQL está em execução');
                this.logger.error('2. O Cloud Run está configurado com --add-cloudsql-instances');
                this.logger.error('3. A conta de serviço tem permissões para acessar o Cloud SQL');
            }

            throw error;
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    // Método para mascarar credenciais em strings de conexão para logs seguros
    private maskConnectionString(connectionString: string): string {
        if (!connectionString) return 'URL não definida';
        try {
            // Mascara a senha na URL
            return connectionString.replace(/(:)([^@]+)(@)/g, '$1******$3');
        } catch (e) {
            return 'Erro ao mascarar URL';
        }
    }
}
