import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TemplateService } from '../services/template.service';
import { CreateTemplateDto } from '../dtos/create-template.dto';
import { UpdateTemplateDto } from '../dtos/update-template.dto';
import { TemplateResponseDto } from '../dtos/template-response.dto';
import { ContractTemplateService } from '../services/contract-template.service';
import { GoogleDocsService } from '../services/google-docs.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('templates')
@Controller('templates')
export class TemplateController {
  private readonly logger = new Logger(TemplateController.name);
  private readonly documentId: string;

  constructor(
    private readonly templateService: TemplateService,
    private readonly contractTemplateService: ContractTemplateService,
    private readonly googleDocsService: GoogleDocsService,
    private readonly configService: ConfigService,
  ) {
    const docId = this.configService.get<string>('GOOGLE_DOC_ID');
    if (!docId) {
      throw new Error('ID do documento do Google Docs não configurado');
    }
    this.documentId = docId;
  }

  @Post('update')
  @ApiOperation({ summary: 'Atualizar template ativo do Google Docs' })
  @ApiResponse({ status: 200, description: 'Template atualizado com sucesso' })
  @ApiResponse({ status: 400, description: 'Erro ao atualizar template' })
  async updateTemplate() {
    try {
      this.logger.log('Iniciando atualização do template');
      await this.contractTemplateService.forceTemplateUpdate();
      return { message: 'Template atualizado com sucesso' };
    } catch (error: unknown) {
      this.logger.error('Erro ao atualizar template:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Erro ao atualizar template',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('test-connection')
  @ApiOperation({ summary: 'Testar conexão com Google Docs' })
  @ApiResponse({ status: 200, description: 'Conexão estabelecida com sucesso' })
  @ApiResponse({ status: 400, description: 'Erro ao conectar com Google Docs' })
  async testGoogleDocsConnection() {
    try {
      this.logger.log('Testando conexão com Google Docs');
      const content = await this.contractTemplateService.testGoogleDocsConnection(this.documentId);
      return {
        message: 'Conexão estabelecida com sucesso',
        preview: content.substring(0, 200) + '...',
      };
    } catch (error: unknown) {
      this.logger.error('Erro ao testar conexão:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Erro ao conectar com Google Docs',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post()
  @ApiOperation({ summary: 'Criar um novo template' })
  @ApiResponse({
    status: 201,
    description: 'Template criado com sucesso',
    type: TemplateResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos ou versão já existe' })
  async create(@Body() createTemplateDto: CreateTemplateDto): Promise<TemplateResponseDto> {
    return this.templateService.create(createTemplateDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os templates' })
  @ApiResponse({ status: 200, description: 'Lista de templates', type: [TemplateResponseDto] })
  async findAll(): Promise<TemplateResponseDto[]> {
    return this.templateService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Listar templates ativos' })
  @ApiResponse({
    status: 200,
    description: 'Lista de templates ativos',
    type: [TemplateResponseDto],
  })
  async findActive(): Promise<TemplateResponseDto[]> {
    return this.templateService.findActive();
  }

  @Get('latest')
  @ApiOperation({ summary: 'Buscar a versão mais recente do template' })
  @ApiResponse({ status: 200, description: 'Template mais recente', type: TemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Nenhum template ativo encontrado' })
  async findLatestVersion(): Promise<TemplateResponseDto> {
    return this.templateService.findLatestVersion();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar um template por ID' })
  @ApiResponse({ status: 200, description: 'Template encontrado', type: TemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  async findOne(@Param('id') id: string): Promise<TemplateResponseDto> {
    return this.templateService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar um template' })
  @ApiResponse({
    status: 200,
    description: 'Template atualizado com sucesso',
    type: TemplateResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  @ApiResponse({ status: 400, description: 'Versão já existe' })
  async update(
    @Param('id') id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ): Promise<TemplateResponseDto> {
    return this.templateService.update(id, updateTemplateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover um template' })
  @ApiResponse({ status: 200, description: 'Template removido com sucesso' })
  @ApiResponse({ status: 404, description: 'Template não encontrado' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.templateService.remove(id);
  }
}
