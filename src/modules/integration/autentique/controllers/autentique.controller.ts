import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AutentiqueService } from '../services/autentique.service';
import { CreateDocumentDto } from '../dtos/create-document.dto';
import { IAutentiqueDocument } from '../interfaces/autentique-document.interface';

@ApiTags('Autentique')
@Controller('autentique')
export class AutentiqueController {
  constructor(private readonly autentiqueService: AutentiqueService) {}

  @Get('documents/:documentId')
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

  @Get('documents/seller/:cnpj')
  @ApiOperation({ summary: 'Busca um documento pelo CNPJ do seller' })
  @ApiParam({ name: 'cnpj', description: 'CNPJ do seller' })
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
  async findDocumentBySellerCnpj(@Param('cnpj') cnpj: string) {
    return this.autentiqueService.findDocumentBySellerCnpj(cnpj);
  }

  @Post('documents')
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
            },
          },
        },
      },
    },
  })
  async createDocument(@Body() data: CreateDocumentDto) {
    return this.autentiqueService.createDocument(data.name, data.content, data.signers);
  }

  @Get('test/seller/:cnpj')
  @ApiOperation({ summary: 'Testa a integração com a Autentique buscando um documento por CNPJ' })
  @ApiResponse({ status: 200, description: 'Documento encontrado com sucesso' })
  async testSellerIntegration(@Param('cnpj') cnpj: string): Promise<IAutentiqueDocument[]> {
    return this.autentiqueService.findDocumentBySellerCnpj(cnpj);
  }

  @Post('sync/contracts')
  @ApiOperation({ summary: 'Sincroniza os contratos com a Autentique' })
  @ApiResponse({ status: 200, description: 'Sincronização concluída com sucesso' })
  async syncContracts() {
    return this.autentiqueService.syncContracts();
  }

  @Delete('documents/:documentId')
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
        message: { type: 'string', description: 'Mensagem descritiva do resultado da operação' },
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
