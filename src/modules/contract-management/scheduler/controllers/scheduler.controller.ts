import { Controller, Post, UseGuards, Param, BadRequestException, Query } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiResponse,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { ContractReminderScheduler } from '../services/contract-reminder.scheduler';
import { AuthGuard } from '../../../security/guards/auth.guard';
import { RoleGuard } from '../../../security/guards/role.guard';
import { Roles } from '../../../security/decorators/roles.decorator';

@ApiTags('scheduler')
@ApiBearerAuth()
@UseGuards(AuthGuard, RoleGuard)
@Controller('scheduler')
export class SchedulerController {
    constructor(private readonly contractReminderScheduler: ContractReminderScheduler) {}

    @Post('trigger-contract-reminders')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({
        summary: 'Aciona manualmente o scheduler de lembretes de contrato',
        description:
            'Verifica todos os contratos pendentes de assinatura e envia lembretes ' +
            'conforme as regras configuradas. A segunda notificação é enviada 3 dias ' +
            'após a criação do contrato, e a terceira 7 dias após a criação. ' +
            'O job automático é executado todos os dias úteis às 12h00.',
    })
    @ApiQuery({
        name: 'contractId',
        required: false,
        description:
            'ID específico de contrato (opcional). Se informado, processa apenas este contrato.',
    })
    @ApiResponse({
        status: 200,
        description: 'Processo de envio de lembretes iniciado com sucesso',
    })
    async triggerContractReminders(@Query('contractId') contractId?: string) {
        // Se foi informado um ID específico, processa apenas esse contrato
        if (contractId) {
            const result = await this.contractReminderScheduler.checkSpecificContract(contractId);

            if (!result) {
                throw new BadRequestException(
                    'Não foi possível enviar lembrete para o contrato especificado.',
                );
            }

            return {
                success: true,
                message: `Lembrete enviado com sucesso para o contrato ${contractId}`,
            };
        }

        // Caso contrário, processa todos os contratos pendentes
        await this.contractReminderScheduler.triggerContractReminders();
        return {
            success: true,
            message: 'Verificação de contratos pendentes para envio de lembretes iniciada',
        };
    }

    @Post('reminder/:contractId')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({
        summary: 'Envia um lembrete para um contrato específico',
        description:
            'Força o envio de um lembrete para um contrato específico, ignorando ' +
            'as regras de intervalo, mas respeitando o limite máximo de 3 notificações. ' +
            'Útil para testes ou processamento manual.',
    })
    @ApiParam({ name: 'contractId', description: 'ID do contrato' })
    @ApiResponse({ status: 200, description: 'Lembrete enviado com sucesso' })
    @ApiResponse({
        status: 400,
        description:
            'Contrato não encontrado, não elegível para lembrete ou já atingiu o limite de 3 tentativas',
    })
    async sendReminderToSpecificContract(@Param('contractId') contractId: string) {
        const result = await this.contractReminderScheduler.checkSpecificContract(contractId);

        if (!result) {
            throw new BadRequestException(
                'Não foi possível enviar lembrete para o contrato especificado. Verifique os logs para mais detalhes.',
            );
        }

        return {
            success: true,
            message: `Lembrete enviado com sucesso para o contrato ${contractId}`,
        };
    }
}
