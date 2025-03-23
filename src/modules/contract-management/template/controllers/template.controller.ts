import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TemplateService } from '../services/template.service';
import { CreateTemplateDto } from '../dtos/create-template.dto';
import { UpdateTemplateDto } from '../dtos/update-template.dto';
import { TemplateResponseDto } from '../dtos/template-response.dto';
import { ContractTemplateService } from '../services/contract-template.service';

@ApiTags('templates')
@Controller('templates')
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly contractTemplateService: ContractTemplateService,
  ) {}

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

  @Post('init')
  @ApiOperation({ summary: 'Inicializar template padrão' })
  @ApiResponse({ status: 201, description: 'Template inicializado com sucesso' })
  async initDefaultTemplate() {
    await this.contractTemplateService.createTemplate();
    return { message: 'Template inicializado com sucesso' };
  }
}
