import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Query,
    Put,
    Res,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiBody,
    ApiQuery,
} from '@nestjs/swagger';
import { ContractService } from '../services/contract.service';
import { CreateContractDto } from '../dtos/create-contract.dto';
import { UpdateContractDto } from '../dtos/update-contract.dto';
import { ContractResponseDto } from '../dtos/contract-response.dto';
import { ContractDataDto } from '../dtos/contract-data.dto';
import { EContractStatus } from '../enums/contract-status.enum';
import { EStatusChangeReason } from '../enums/status-change-reason.enum';
import { AuthGuard } from '../../../security/guards/auth.guard';
import { RoleGuard } from '../../../security/guards/role.guard';
import { Roles } from '../../../security/decorators/roles.decorator';
import { Response } from 'express';
import * as puppeteer from 'puppeteer';
import { ContractTemplateService } from '../../template/services/contract-template.service';
import { UpdateContractByCnpjDto } from '../dtos/update-contract-by-cnpj.dto';
import { SellerResponseDto } from '../../seller/dtos/seller-response.dto';
import { Logger } from '@nestjs/common';

@ApiTags('contratos')
@ApiBearerAuth()
@UseGuards(AuthGuard, RoleGuard)
@Controller('contracts')
export class ContractController {
    private readonly logger = new Logger(ContractController.name);

    constructor(
        private readonly contractService: ContractService,
        private readonly contractTemplateService: ContractTemplateService,
    ) {}

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
    async create(
        @Body() createContractDto: CreateContractDto,
        @Body() contractData: ContractDataDto,
    ): Promise<ContractResponseDto> {
        return this.contractService.create(createContractDto, contractData);
    }

    @Get()
    @Roles('ADMIN', 'MANAGER', 'USER')
    @ApiOperation({ summary: 'Listar todos os contratos' })
    @ApiQuery({ name: 'status', enum: EContractStatus, required: false })
    @ApiResponse({ status: 200, description: 'Lista de contratos', type: [ContractResponseDto] })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async findAll(@Query('status') status?: EContractStatus): Promise<ContractResponseDto[]> {
        if (status) {
            return this.contractService.findByStatus(status);
        }
        return this.contractService.findAll();
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
        return this.contractService.findBySeller(sellerId);
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
        return this.contractService.findOne(id);
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
        return this.contractService.update(id, updateContractDto);
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
        return this.contractService.sign(id);
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
        return this.contractService.cancel(id, reason);
    }

    @Put(':id/status')
    @Roles('ADMIN', 'MANAGER')
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

    @Get(':id/status-history')
    @Roles('ADMIN', 'MANAGER', 'USER')
    @ApiOperation({ summary: 'Buscar histórico de status do contrato' })
    @ApiParam({ name: 'id', description: 'ID do contrato' })
    @ApiResponse({ status: 200, description: 'Histórico de status do contrato' })
    @ApiResponse({ status: 404, description: 'Contrato não encontrado' })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async getStatusHistory(@Param('id') id: string) {
        return this.contractService.getStatusHistory(id);
    }

    @Get('status/pending-signature')
    @ApiOperation({ summary: 'Buscar contratos pendentes de assinatura' })
    async findPendingSignature() {
        return this.contractService.findPendingSignature();
    }

    @Get('status/expired')
    @ApiOperation({ summary: 'Buscar contratos expirados' })
    async findExpired() {
        return this.contractService.findExpired();
    }

    @Get(':id/view')
    @ApiOperation({ summary: 'Visualizar contrato em HTML' })
    @ApiResponse({ status: 200, description: 'Retorna o HTML do contrato' })
    async viewContract(@Param('id') id: string, @Res() res: Response) {
        const contract = await this.contractService.findOne(id);
        res.setHeader('Content-Type', 'text/html');
        res.send(contract.content);
    }

    @Get(':id/download')
    @ApiOperation({ summary: 'Baixar contrato em PDF' })
    @ApiResponse({ status: 200, description: 'Retorna o PDF do contrato' })
    async downloadContract(@Param('id') id: string, @Res() res: Response) {
        const contract = await this.contractService.findOne(id);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox'],
        });
        const page = await browser.newPage();

        await page.setContent(contract.content);
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px',
            },
        });

        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=contrato-${id}.pdf`);
        res.send(pdf);
    }

    @Post('template/preview')
    @ApiOperation({ summary: 'Visualizar template do contrato' })
    @ApiResponse({ status: 200, description: 'Retorna o HTML do template' })
    @ApiBody({
        type: ContractDataDto,
        examples: {
            example1: {
                value: {
                    contractNumber: '123',
                    companyName: 'Empresa Teste',
                    companyCnpj: '12345678901234',
                    companyAddress: 'Rua Teste, 123',
                    contractDuration: 12,
                    commissionRate: 5,
                    paymentDay: 5,
                    jurisdiction: 'São Paulo',
                    city: 'São Paulo',
                },
            },
        },
    })
    async previewTemplate(@Body() contractData: ContractDataDto, @Res() res: Response) {
        console.log('Preview template - Dados recebidos:', contractData);
        try {
            const content = await this.contractTemplateService.generateContract(contractData);
            console.log('Preview template - Conteúdo gerado com sucesso');
            res.setHeader('Content-Type', 'text/html');
            res.send(content);
        } catch (error) {
            console.error('Preview template - Erro:', error);
            throw error;
        }
    }

    @Post('template/download')
    @ApiOperation({ summary: 'Baixar template do contrato em PDF' })
    @ApiResponse({ status: 200, description: 'Retorna o PDF do template' })
    @ApiBody({
        type: ContractDataDto,
        examples: {
            example1: {
                value: {
                    contractNumber: '123',
                    companyName: 'Empresa Teste',
                    companyCnpj: '12345678901234',
                    companyAddress: 'Rua Teste, 123',
                    contractDuration: 12,
                    commissionRate: 5,
                    paymentDay: 5,
                    jurisdiction: 'São Paulo',
                    city: 'São Paulo',
                },
            },
        },
    })
    async downloadTemplate(@Body() contractData: ContractDataDto, @Res() res: Response) {
        console.log('Download template - Dados recebidos:', contractData);
        try {
            const content = await this.contractTemplateService.generateContract(contractData);
            console.log('Download template - Conteúdo gerado com sucesso');

            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox'],
            });
            const page = await browser.newPage();

            await page.setContent(content);
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px',
                },
            });

            await browser.close();
            console.log('Download template - PDF gerado com sucesso');

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=template-contrato.pdf');
            res.send(pdf);
        } catch (error) {
            console.error('Download template - Erro:', error);
            throw error;
        }
    }

    @Post('update-by-cnpj')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Atualiza os dados de um contrato pelo CNPJ do seller' })
    @ApiResponse({
        status: 200,
        description: 'Contrato atualizado com sucesso',
        schema: {
            properties: {
                contractsDeleted: { type: 'number' },
                hasMultipleContracts: { type: 'boolean' },
            },
        },
    })
    @ApiResponse({
        status: 404,
        description: 'Seller ou contrato não encontrado',
    })
    @ApiResponse({
        status: 403,
        description: 'Acesso negado - Necessário role ADMIN ou MANAGER',
    })
    async updateContractByCnpj(
        @Body() updateContractByCnpjDto: UpdateContractByCnpjDto,
    ): Promise<{ contractsDeleted: number; hasMultipleContracts: boolean }> {
        return this.contractService.updateContractByCnpj(updateContractByCnpjDto.cnpj);
    }

    @Post(':id/send-to-signature')
    @Roles('ADMIN', 'MANAGER', 'USER')
    @ApiOperation({ summary: 'Enviar contrato para assinatura' })
    @ApiParam({ name: 'id', description: 'ID do contrato' })
    @ApiResponse({
        status: 200,
        description: 'Contrato enviado para assinatura',
        type: ContractResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Contrato não encontrado' })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async sendToSignature(
        @Param('id') id: string,
        @Body() data?: { content: string; seller: SellerResponseDto },
    ): Promise<ContractResponseDto> {
        return this.contractService.sendToSignature(id, data);
    }

    @Post('expire-all-pending')
    @Roles('ADMIN')
    @ApiOperation({
        summary: 'Expirar todos os contratos pendentes de assinatura (somente para migração)',
    })
    @ApiResponse({
        status: 200,
        description: 'Total de contratos expirados',
        schema: {
            properties: {
                message: { type: 'string' },
                total: { type: 'number' },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Não autorizado' })
    @ApiResponse({ status: 403, description: 'Acesso negado' })
    async expireAllPending() {
        this.logger.log('Iniciando expiração de todos os contratos pendentes...');

        // Obter todos os contratos pendentes
        const pendingContracts = await this.contractService.findByStatus(
            EContractStatus.PENDING_SIGNATURE,
        );
        this.logger.log(`Encontrados ${pendingContracts.length} contratos pendentes para expirar`);

        let count = 0;

        for (const contract of pendingContracts) {
            try {
                await this.contractService.updateStatus(
                    contract.id,
                    EContractStatus.EXPIRED,
                    EStatusChangeReason.EXPIRED,
                    { reason: 'Migração para ambiente de produção' },
                );
                count++;
                this.logger.log(
                    `Contrato ${contract.id} expirado com sucesso (${count}/${pendingContracts.length})`,
                );
            } catch (error) {
                this.logger.error(`Erro ao expirar contrato ${contract.id}: ${error.message}`);
            }
        }

        this.logger.log(`Processo concluído. Total de contratos expirados: ${count}`);

        return {
            message: 'Processo concluído com sucesso',
            total: count,
        };
    }
}
