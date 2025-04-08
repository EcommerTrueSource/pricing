import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    HttpCode,
    HttpStatus,
    Delete,
    NotFoundException,
    UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { AutentiqueService } from '../services/autentique.service';
import { CreateDocumentDto } from '../dtos/create-document.dto';
import { AuthGuard } from '../../../security/guards/auth.guard';
import { RoleGuard } from '../../../security/guards/role.guard';
import { Roles } from '../../../security/decorators/roles.decorator';

@ApiTags('Autentique')
@ApiBearerAuth()
@UseGuards(AuthGuard, RoleGuard)
@Controller('autentique')
export class AutentiqueController {
    constructor(private readonly autentiqueService: AutentiqueService) {}

    @Get('documents/seller/:cnpj')
    @Roles('ADMIN', 'MANAGER', 'USER')
    @ApiOperation({
        summary: 'Busca documentos por CNPJ do vendedor',
        description:
            'Busca documentos na Autentique usando o CNPJ do vendedor. O CNPJ deve ser fornecido sem formatação (ex: 38308523000172). O sistema irá formatar automaticamente e buscar pelo nome do documento no padrão "Contrato PMA True Brands - XX.XXX.XXX/XXXX-XX".',
    })
    @ApiParam({
        name: 'cnpj',
        description: 'CNPJ do vendedor sem formatação (ex: 38308523000172)',
        example: '38308523000172',
    })
    @ApiResponse({
        status: 200,
        description: 'Documentos encontrados com sucesso',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    status: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    signedAt: { type: 'string', format: 'date-time', nullable: true },
                    expiresAt: { type: 'string', format: 'date-time', nullable: true },
                    signers: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                email: { type: 'string' },
                                status: { type: 'string' },
                                signedAt: { type: 'string', format: 'date-time', nullable: true },
                            },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Nenhum documento encontrado para este CNPJ' })
    async findDocumentsBySellerCnpj(@Param('cnpj') cnpj: string) {
        const documents = await this.autentiqueService.findDocumentBySellerCnpj(cnpj);
        if (!documents.length) {
            throw new NotFoundException('Nenhum documento encontrado para este CNPJ');
        }
        return documents;
    }

    @Get('documents/:documentId')
    @Roles('ADMIN', 'MANAGER', 'USER')
    @ApiOperation({ summary: 'Busca um documento por ID' })
    @ApiParam({ name: 'documentId', description: 'ID do documento no Autentique' })
    @ApiResponse({
        status: 200,
        description: 'Documento encontrado com sucesso',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
                signedAt: { type: 'string', format: 'date-time', nullable: true },
                expiresAt: { type: 'string', format: 'date-time', nullable: true },
                signers: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            email: { type: 'string' },
                            status: { type: 'string' },
                            signedAt: { type: 'string', format: 'date-time', nullable: true },
                        },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Documento não encontrado' })
    async getDocument(@Param('documentId') documentId: string) {
        return this.autentiqueService.getDocument(documentId);
    }

    @Post('documents')
    @Roles('ADMIN', 'MANAGER')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Cria um novo documento' })
    @ApiResponse({
        status: 201,
        description: 'Documento criado com sucesso',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
                signedAt: { type: 'string', format: 'date-time', nullable: true },
                expiresAt: { type: 'string', format: 'date-time', nullable: true },
                signers: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            email: { type: 'string' },
                            status: { type: 'string' },
                            signedAt: { type: 'string', format: 'date-time', nullable: true },
                            link: {
                                type: 'object',
                                properties: {
                                    short_link: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    async createDocument(@Body() data: CreateDocumentDto) {
        // Garante que os signatários tenham a ação SIGN
        const signers = data.signers.map((signer) => ({
            ...signer,
            action: signer.action || 'SIGN',
        }));

        // Garante que as opções incluam short_link: true por padrão
        const options = {
            ...data.options,
            short_link: data.options?.short_link ?? true,
        };

        return this.autentiqueService.createDocument(data.name, data.content, signers, options);
    }

    @Post('sync/contracts')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Sincroniza os contratos com a Autentique' })
    @ApiResponse({ status: 200, description: 'Sincronização concluída com sucesso' })
    async syncContracts() {
        return this.autentiqueService.syncContracts();
    }

    @Delete('documents/:documentId')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Deleta um documento do Autentique',
        description:
            'Remove permanentemente um documento da plataforma Autentique. Esta operação não pode ser desfeita.',
    })
    @ApiParam({ name: 'documentId', description: 'ID do documento no Autentique' })
    @ApiResponse({
        status: 200,
        description: 'Documento deletado com sucesso',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', description: 'Indica se a operação foi bem sucedida' },
                message: {
                    type: 'string',
                    description: 'Mensagem descritiva do resultado da operação',
                },
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Documento não encontrado',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Documento não encontrado na Autentique' },
            },
        },
    })
    @ApiResponse({
        status: 500,
        description: 'Erro interno do servidor',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: false },
                message: { type: 'string', example: 'Erro ao deletar documento na Autentique' },
            },
        },
    })
    async deleteDocument(@Param('documentId') documentId: string) {
        try {
            await this.autentiqueService.deleteDocument(documentId);
            return {
                success: true,
                message: 'Documento deletado com sucesso',
            };
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Erro ao deletar documento',
            };
        }
    }
}
