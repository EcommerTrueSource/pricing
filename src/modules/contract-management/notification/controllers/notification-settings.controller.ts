import {
    Controller,
    Post,
    Body,
    Get,
    UseGuards,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { SystemSettingsService } from '../../../../shared/services/system-settings.service';
import { Roles } from '../../../security/decorators/roles.decorator';
import { AuthGuard } from '../../../security/guards/auth.guard';
import { RoleGuard } from '../../../security/guards/role.guard';

class PauseNotificationsDto {
    // Duração em dias para pausar as notificações
    days: number;
}

class NotificationPauseStatusDto {
    isPaused: boolean;
    pauseUntil: string | null;
    daysRemaining: number | null;
}

@ApiTags('notificações-configurações')
@ApiBearerAuth()
@UseGuards(AuthGuard, RoleGuard)
@Controller('notifications/settings')
export class NotificationSettingsController {
    private readonly logger = new Logger(NotificationSettingsController.name);

    constructor(private readonly systemSettingsService: SystemSettingsService) {}

    @Get('pause-status')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Verifica o status atual da pausa de notificações' })
    @ApiResponse({
        status: 200,
        description: 'Status da pausa de notificações',
        type: NotificationPauseStatusDto,
    })
    async getPauseStatus(): Promise<NotificationPauseStatusDto> {
        const isPaused = await this.systemSettingsService.areNotificationsPaused();
        const pauseDate = await this.systemSettingsService.getNotificationPauseDate();

        let daysRemaining = null;
        if (isPaused && pauseDate) {
            const now = new Date();
            const diffTime = Math.abs(pauseDate.getTime() - now.getTime());
            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        return {
            isPaused,
            pauseUntil: pauseDate ? pauseDate.toISOString() : null,
            daysRemaining,
        };
    }

    @Post('pause')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({
        summary: 'Pausa o envio de notificações por WhatsApp por um período específico',
    })
    @ApiResponse({ status: 200, description: 'Notificações pausadas com sucesso' })
    @ApiResponse({ status: 400, description: 'Parâmetros inválidos' })
    @ApiBody({ type: PauseNotificationsDto })
    async pauseNotifications(
        @Body() pauseDto: PauseNotificationsDto,
    ): Promise<{ message: string; pauseUntil: string }> {
        if (!pauseDto.days || pauseDto.days < 1 || pauseDto.days > 30) {
            throw new HttpException(
                'O número de dias deve estar entre 1 e 30',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Calcula a data até quando as notificações ficarão pausadas
        const pauseUntil = new Date();
        pauseUntil.setDate(pauseUntil.getDate() + pauseDto.days);

        // Define a data de pausa no serviço de configuração
        await this.systemSettingsService.pauseNotificationsUntil(pauseUntil);

        return {
            message: `Notificações pausadas por ${pauseDto.days} dias`,
            pauseUntil: pauseUntil.toISOString(),
        };
    }

    @Post('resume')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Retoma o envio de notificações por WhatsApp imediatamente' })
    @ApiResponse({ status: 200, description: 'Notificações retomadas com sucesso' })
    async resumeNotifications(): Promise<{ message: string }> {
        await this.systemSettingsService.resumeNotifications();
        return { message: 'Notificações retomadas com sucesso' };
    }
}
