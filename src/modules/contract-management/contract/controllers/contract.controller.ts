import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Put } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { ContractService } from '../services/contract.service';
import { CreateContractDto } from '../dtos/create-contract.dto';
import { UpdateContractDto } from '../dtos/update-contract.dto';
import { ContractResponseDto } from '../dtos/contract-response.dto';
import { EContractStatus } from '../enums/contract-status.enum';
import { EStatusChangeReason } from '../enums/status-change-reason.enum';
import { AuthGuard } from '../../../security/guards/auth.guard';
import { RoleGuard } from '../../../security/guards/role.guard';
import { Roles } from '../../../security/decorators/roles.decorator';

@ApiTags('contratos')
@ApiBearerAuth()
@Controller('contracts')
@UseGuards(AuthGuard, RoleGuard)
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Criar um novo contrato' })
  @ApiResponse({
    status: 201,
    description: 'Contrato criado com sucesso',
    type: ContractResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiBody({ type: CreateContractDto })
  async create(@Body() createContractDto: CreateContractDto): Promise<ContractResponseDto> {
    return await this.contractService.create(createContractDto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'USER')
  @ApiOperation({ summary: 'Listar todos os contratos' })
  @ApiResponse({ status: 200, description: 'Lista de contratos', type: [ContractResponseDto] })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  async findAll(): Promise<ContractResponseDto[]> {
    return await this.contractService.findAll();
  }

  @Get('seller/:sellerId')
  @Roles('ADMIN', 'MANAGER', 'USER')
  @ApiOperation({ summary: 'Listar contratos por vendedor' })
  @ApiParam({ name: 'sellerId', description: 'ID do vendedor' })
  @ApiResponse({
    status: 200,
    description: 'Lista de contratos do vendedor',
    type: [ContractResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  async findBySeller(@Param('sellerId') sellerId: string): Promise<ContractResponseDto[]> {
    return await this.contractService.findBySeller(sellerId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'USER')
  @ApiOperation({ summary: 'Buscar contrato por ID' })
  @ApiParam({ name: 'id', description: 'ID do contrato' })
  @ApiResponse({ status: 200, description: 'Contrato encontrado', type: ContractResponseDto })
  @ApiResponse({ status: 404, description: 'Contrato não encontrado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  async findOne(@Param('id') id: string): Promise<ContractResponseDto> {
    return await this.contractService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Atualizar contrato' })
  @ApiParam({ name: 'id', description: 'ID do contrato' })
  @ApiResponse({
    status: 200,
    description: 'Contrato atualizado com sucesso',
    type: ContractResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Contrato não encontrado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiBody({ type: UpdateContractDto })
  async update(
    @Param('id') id: string,
    @Body() updateContractDto: UpdateContractDto,
  ): Promise<ContractResponseDto> {
    return await this.contractService.update(id, updateContractDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remover contrato' })
  @ApiParam({ name: 'id', description: 'ID do contrato' })
  @ApiResponse({ status: 200, description: 'Contrato removido com sucesso' })
  @ApiResponse({ status: 404, description: 'Contrato não encontrado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.contractService.remove(id);
  }

  @Post(':id/sign')
  @Roles('ADMIN', 'MANAGER', 'USER')
  @ApiOperation({ summary: 'Assinar contrato' })
  @ApiParam({ name: 'id', description: 'ID do contrato' })
  @ApiResponse({
    status: 200,
    description: 'Contrato assinado com sucesso',
    type: ContractResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Contrato não encontrado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  async sign(@Param('id') id: string): Promise<ContractResponseDto> {
    return await this.contractService.sign(id);
  }

  @Post(':id/cancel')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Cancelar contrato' })
  @ApiParam({ name: 'id', description: 'ID do contrato' })
  @ApiResponse({
    status: 200,
    description: 'Contrato cancelado com sucesso',
    type: ContractResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Contrato não encontrado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiBody({ schema: { properties: { reason: { type: 'string' } } } })
  async cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ): Promise<ContractResponseDto> {
    return await this.contractService.cancel(id, reason);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Atualizar o status de um contrato' })
  @ApiParam({ name: 'id', description: 'ID do contrato' })
  @ApiResponse({
    status: 200,
    description: 'Status atualizado com sucesso',
    type: ContractResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Transição de status inválida' })
  @ApiResponse({ status: 404, description: 'Contrato não encontrado' })
  @ApiResponse({ status: 401, description: 'Não autorizado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  @ApiBody({
    schema: {
      properties: {
        status: { type: 'string', enum: Object.values(EContractStatus) },
        reason: { type: 'string', enum: Object.values(EStatusChangeReason) },
        metadata: { type: 'object' },
      },
    },
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: EContractStatus,
    @Body('reason') reason: EStatusChangeReason,
    @Body('metadata') metadata?: Record<string, any>,
  ): Promise<ContractResponseDto> {
    return this.contractService.updateStatus(id, status, reason, metadata);
  }
}
