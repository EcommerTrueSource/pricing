import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from '../services/notification.service';
import { CreateNotificationDto } from '../dtos/create-notification.dto';
import { UpdateNotificationDto } from '../dtos/update-notification.dto';
import { NotificationResponseDto } from '../dtos/notification-response.dto';
import { ENotificationStatus } from '../enums/notification-status.enum';
import { AuthGuard } from '../../../security/guards/auth.guard';
import { RoleGuard } from '../../../security/guards/role.guard';
import { Roles } from '../../../security/decorators/roles.decorator';

@ApiTags('notificações')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(AuthGuard, RoleGuard)
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}

    @Post()
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Criar uma nova notificação' })
    @ApiResponse({
        status: 201,
        description: 'Notificação criada com sucesso',
        type: NotificationResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Dados inválidos' })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async create(
        @Body() createNotificationDto: CreateNotificationDto,
    ): Promise<NotificationResponseDto> {
        return await this.notificationService.create(createNotificationDto);
    }

    @Get()
    @Roles('ADMIN', 'MANAGER', 'USER')
    @ApiOperation({ summary: 'Listar todas as notificações' })
    @ApiResponse({
        status: 200,
        description: 'Lista de notificações',
        type: [NotificationResponseDto],
    })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async findAll(): Promise<NotificationResponseDto[]> {
        return await this.notificationService.findAll();
    }

    @Get('contract/:contractId')
    @Roles('ADMIN', 'MANAGER', 'USER')
    @ApiOperation({ summary: 'Listar notificações por contrato' })
    @ApiResponse({
        status: 200,
        description: 'Lista de notificações do contrato',
        type: [NotificationResponseDto],
    })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async findByContractId(
        @Param('contractId') contractId: string,
    ): Promise<NotificationResponseDto[]> {
        return await this.notificationService.findByContractId(contractId);
    }

    @Get('seller/:sellerId')
    @Roles('ADMIN', 'MANAGER', 'USER')
    @ApiOperation({ summary: 'Listar notificações por vendedor' })
    @ApiResponse({
        status: 200,
        description: 'Lista de notificações do vendedor',
        type: [NotificationResponseDto],
    })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async findBySellerId(@Param('sellerId') sellerId: string): Promise<NotificationResponseDto[]> {
        return await this.notificationService.findBySellerId(sellerId);
    }

    @Get('status')
    @Roles('ADMIN', 'MANAGER', 'USER')
    @ApiOperation({ summary: 'Listar notificações por status' })
    @ApiResponse({
        status: 200,
        description: 'Lista de notificações filtrada por status',
        type: [NotificationResponseDto],
    })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async findByStatus(
        @Query('status') status: ENotificationStatus,
    ): Promise<NotificationResponseDto[]> {
        return await this.notificationService.findByStatus(status);
    }

    @Get('pending')
    @Roles('ADMIN', 'MANAGER', 'USER')
    @ApiOperation({ summary: 'Listar notificações pendentes' })
    @ApiResponse({
        status: 200,
        description: 'Lista de notificações pendentes',
        type: [NotificationResponseDto],
    })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async findPending(): Promise<NotificationResponseDto[]> {
        return await this.notificationService.findPending();
    }

    @Get(':id')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Buscar notificação por ID' })
    @ApiResponse({
        status: 200,
        description: 'Notificação encontrada',
        type: NotificationResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Notificação não encontrada' })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async findOne(@Param('id') id: string): Promise<NotificationResponseDto> {
        return await this.notificationService.findById(id);
    }

    @Patch(':id')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Atualizar notificação' })
    @ApiResponse({
        status: 200,
        description: 'Notificação atualizada com sucesso',
        type: NotificationResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Notificação não encontrada' })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async update(
        @Param('id') id: string,
        @Body() updateNotificationDto: UpdateNotificationDto,
    ): Promise<NotificationResponseDto> {
        return await this.notificationService.update(id, updateNotificationDto);
    }

    @Delete(':id')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Remover notificação' })
    @ApiResponse({ status: 200, description: 'Notificação removida com sucesso' })
    @ApiResponse({ status: 404, description: 'Notificação não encontrada' })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async remove(@Param('id') id: string): Promise<void> {
        await this.notificationService.remove(id);
    }

    @Patch(':id/mark-as-sent')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Marcar notificação como enviada' })
    @ApiResponse({
        status: 200,
        description: 'Notificação marcada como enviada',
        type: NotificationResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Notificação não encontrada' })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async markAsSent(@Param('id') id: string): Promise<NotificationResponseDto> {
        return await this.notificationService.markAsSent(id);
    }

    @Patch(':id/mark-as-delivered')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Marcar notificação como entregue' })
    @ApiResponse({
        status: 200,
        description: 'Notificação marcada como entregue',
        type: NotificationResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Notificação não encontrada' })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async markAsDelivered(@Param('id') id: string): Promise<NotificationResponseDto> {
        return await this.notificationService.markAsDelivered(id);
    }

    @Patch(':id/failed')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Marcar notificação como falha' })
    @ApiResponse({
        status: 200,
        description: 'Notificação marcada como falha',
        type: NotificationResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Notificação não encontrada' })
    @ApiResponse({ status: 400, description: 'Número máximo de tentativas excedido' })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async markAsFailed(@Param('id') id: string): Promise<NotificationResponseDto> {
        return await this.notificationService.markAsFailed(id);
    }
}
