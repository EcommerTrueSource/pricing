import { Body, Controller, Delete, Get, Logger, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiBody,
} from '@nestjs/swagger';
import { InviteService } from '../services/invite.service';
import { CreateInviteDto } from '../dtos/create-invite.dto';
import { AcceptInviteDto } from '../dtos/accept-invite.dto';
import { AuthGuard } from '../guards/auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { RoleGuard } from '../guards/role.guard';
import { Public } from '../decorators/public.decorator';

@ApiTags('Convites')
@ApiBearerAuth()
@UseGuards(AuthGuard, RoleGuard)
@Controller('invites')
export class InviteController {
    private readonly logger = new Logger(InviteController.name);

    constructor(private readonly inviteService: InviteService) {}

    @Post()
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Criar novo convite (apenas ADMIN)' })
    @ApiBody({ type: CreateInviteDto })
    @ApiResponse({
        status: 201,
        description: 'Convite criado com sucesso',
        schema: {
            properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string' },
                token: { type: 'string' },
                expiresAt: { type: 'string', format: 'date-time' },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Dados inválidos' })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 409, description: 'Conflito: usuário ou convite já existe' })
    async createInvite(@Body() createInviteDto: CreateInviteDto, @Req() req) {
        this.logger.log(`Criando convite para ${createInviteDto.email}`);
        return this.inviteService.createInvite(createInviteDto, req.user.userId || req.user.sub);
    }

    @Get()
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Listar todos os convites ativos (apenas ADMIN)' })
    @ApiResponse({
        status: 200,
        description: 'Lista de convites ativos',
        schema: {
            type: 'array',
            items: {
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    email: { type: 'string' },
                    token: { type: 'string' },
                    expires_at: { type: 'string', format: 'date-time' },
                    sent_by: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            email: { type: 'string' },
                            first_name: { type: 'string' },
                            last_name: { type: 'string' },
                        },
                    },
                },
            },
        },
    })
    async findAllInvites() {
        return this.inviteService.findAllInvites();
    }

    @Get('validate/:token')
    @Public()
    @ApiOperation({ summary: 'Validar um token de convite (público)' })
    @ApiParam({ name: 'token', description: 'Token do convite' })
    @ApiResponse({
        status: 200,
        description: 'Convite válido',
        schema: {
            properties: {
                email: { type: 'string' },
                roles: { type: 'array', items: { type: 'string' } },
                expiresAt: { type: 'string', format: 'date-time' },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Convite inválido ou expirado' })
    @ApiResponse({ status: 404, description: 'Convite não encontrado' })
    async validateInvite(@Param('token') token: string) {
        return this.inviteService.validateInvite(token);
    }

    @Post('accept')
    @Public()
    @ApiOperation({ summary: 'Aceitar um convite e criar conta (público)' })
    @ApiBody({ type: AcceptInviteDto })
    @ApiResponse({
        status: 201,
        description: 'Convite aceito, conta criada com sucesso',
        schema: {
            properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                roles: { type: 'array', items: { type: 'string' } },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Dados inválidos ou convite expirado' })
    @ApiResponse({ status: 404, description: 'Convite não encontrado' })
    async acceptInvite(@Body() acceptInviteDto: AcceptInviteDto) {
        return this.inviteService.acceptInvite(acceptInviteDto);
    }

    @Delete(':id')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Cancelar um convite (apenas ADMIN)' })
    @ApiParam({ name: 'id', description: 'ID do convite' })
    @ApiResponse({
        status: 200,
        description: 'Convite cancelado com sucesso',
        schema: {
            properties: {
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Convite não encontrado' })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    async cancelInvite(@Param('id') id: string, @Req() req) {
        return this.inviteService.cancelInvite(id, req.user.userId || req.user.sub);
    }
}
