import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class SystemSettingsService {
    private readonly logger = new Logger(SystemSettingsService.name);

    // Chaves de configuração disponíveis
    static readonly NOTIFICATION_PAUSE_UNTIL = 'notification_pause_until';

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Obtém um valor de configuração do sistema
     * @param key Chave da configuração
     * @param defaultValue Valor padrão caso a configuração não exista
     */
    async getValue(key: string, defaultValue: string = null): Promise<string> {
        try {
            const result = await this.prisma.$queryRaw`
                SELECT value FROM system_settings WHERE key = ${key} LIMIT 1
            `;

            if (result && Array.isArray(result) && result.length > 0) {
                return result[0].value;
            }
            return defaultValue;
        } catch (error) {
            this.logger.error(`Erro ao obter configuração ${key}: ${error.message}`);
            return defaultValue;
        }
    }

    /**
     * Define um valor de configuração do sistema
     * @param key Chave da configuração
     * @param value Valor da configuração
     * @param description Descrição opcional da configuração
     */
    async setValue(key: string, value: string, description?: string): Promise<void> {
        try {
            // Verifica se o registro já existe
            const exists = await this.prisma.$queryRaw`
                SELECT id FROM system_settings WHERE key = ${key} LIMIT 1
            `;

            if (exists && Array.isArray(exists) && exists.length > 0) {
                // Atualiza o registro existente
                await this.prisma.$executeRaw`
                    UPDATE system_settings
                    SET value = ${value},
                        description = ${description || null},
                        updated_at = NOW()
                    WHERE key = ${key}
                `;
            } else {
                // Cria um novo registro
                await this.prisma.$executeRaw`
                    INSERT INTO system_settings(id, key, value, description, created_at, updated_at)
                    VALUES (uuid_generate_v4(), ${key}, ${value}, ${description || null}, NOW(), NOW())
                `;
            }

            this.logger.log(`Configuração ${key} atualizada para: ${value}`);
        } catch (error) {
            this.logger.error(`Erro ao definir configuração ${key}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Pausa o envio de notificações até uma data específica
     * @param untilDate Data até quando as notificações devem ficar pausadas
     */
    async pauseNotificationsUntil(untilDate: Date): Promise<void> {
        const isoDate = untilDate.toISOString();
        await this.setValue(
            SystemSettingsService.NOTIFICATION_PAUSE_UNTIL,
            isoDate,
            'Data até quando as notificações via WhatsApp estão pausadas',
        );

        this.logger.log(`Notificações pausadas até ${isoDate}`);
    }

    /**
     * Retoma o envio de notificações imediatamente
     */
    async resumeNotifications(): Promise<void> {
        // Define a data de pausa para uma data passada (efetivamente retomando as notificações)
        const pastDate = new Date(0).toISOString();
        await this.setValue(
            SystemSettingsService.NOTIFICATION_PAUSE_UNTIL,
            pastDate,
            'Notificações retomadas',
        );

        this.logger.log('Notificações retomadas com sucesso');
    }

    /**
     * Verifica se as notificações estão pausadas atualmente
     * @returns true se as notificações estiverem pausadas, false caso contrário
     */
    async areNotificationsPaused(): Promise<boolean> {
        const pauseUntilStr = await this.getValue(
            SystemSettingsService.NOTIFICATION_PAUSE_UNTIL,
            null,
        );

        if (!pauseUntilStr) {
            return false;
        }

        try {
            const pauseUntil = new Date(pauseUntilStr);
            const now = new Date();

            return pauseUntil > now;
        } catch (error) {
            this.logger.error(`Erro ao verificar pausa de notificações: ${error.message}`);
            return false;
        }
    }

    /**
     * Obtém a data até quando as notificações estão pausadas
     * @returns Data até quando as notificações estão pausadas ou null se não estiverem pausadas
     */
    async getNotificationPauseDate(): Promise<Date | null> {
        const pauseUntilStr = await this.getValue(
            SystemSettingsService.NOTIFICATION_PAUSE_UNTIL,
            null,
        );

        if (!pauseUntilStr) {
            return null;
        }

        try {
            const pauseUntil = new Date(pauseUntilStr);
            const now = new Date();

            return pauseUntil > now ? pauseUntil : null;
        } catch (error) {
            this.logger.error(`Erro ao obter data de pausa de notificações: ${error.message}`);
            return null;
        }
    }
}
