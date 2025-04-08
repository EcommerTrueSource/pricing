import { Controller, Get } from '@nestjs/common';
import {
    HealthCheck,
    HealthCheckService,
    HttpHealthIndicator,
    PrismaHealthIndicator,
    HealthCheckResult,
    DiskHealthIndicator,
    MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../services/prisma.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../modules/security/decorators/public.decorator';

@ApiTags('Health Check')
@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private http: HttpHealthIndicator,
        private prisma: PrismaHealthIndicator,
        private prismaService: PrismaService,
        private disk: DiskHealthIndicator,
        private memory: MemoryHealthIndicator,
    ) {}

    @Get()
    @Public()
    @HealthCheck()
    @ApiOperation({ summary: 'Verificar a saúde da aplicação' })
    @ApiResponse({
        status: 200,
        description: 'Aplicação está saudável',
        schema: {
            type: 'object',
            properties: {
                status: { type: 'string', example: 'ok' },
                info: {
                    type: 'object',
                    properties: {
                        database: {
                            type: 'object',
                            properties: {
                                status: { type: 'string', example: 'up' },
                            },
                        },
                        memory_heap: {
                            type: 'object',
                            properties: {
                                status: { type: 'string', example: 'up' },
                            },
                        },
                        disk: {
                            type: 'object',
                            properties: {
                                status: { type: 'string', example: 'up' },
                            },
                        },
                        custom: {
                            type: 'object',
                            properties: {
                                status: { type: 'string', example: 'up' },
                                details: {
                                    type: 'object',
                                    properties: {
                                        uptime: { type: 'number', example: 1234 },
                                        timestamp: {
                                            type: 'string',
                                            example: '2024-04-08T17:50:43.000Z',
                                        },
                                        environment: { type: 'string', example: 'production' },
                                    },
                                },
                            },
                        },
                    },
                },
                error: {
                    type: 'object',
                    properties: {
                        database: {
                            type: 'object',
                            properties: {
                                status: { type: 'string', example: 'down' },
                                message: {
                                    type: 'string',
                                    example: 'could not connect to database',
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({
        status: 503,
        description: 'Aplicação está com problemas',
    })
    async check(): Promise<HealthCheckResult> {
        return this.health.check([
            // Verifica a conexão com o banco de dados
            async () => this.prisma.pingCheck('database', this.prismaService),

            // Verifica o uso de memória
            async () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB

            // Verifica o espaço em disco
            async () =>
                this.disk.checkStorage('disk', {
                    thresholdPercent: 0.9, // 90%
                    path: '/',
                }),

            // Adiciona informações extras
            async () => ({
                custom: {
                    status: 'up',
                    details: {
                        uptime: process.uptime(),
                        timestamp: new Date().toISOString(),
                        environment: process.env.NODE_ENV || 'development',
                    },
                },
            }),
        ]);
    }
}
