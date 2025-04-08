/* eslint-disable prettier/prettier */
import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SellerService } from '../services/seller.service';
import { CreateSellerDto } from '../dtos/create-seller.dto';
import { UpdateSellerDto } from '../dtos/update-seller.dto';
import { SellerResponseDto } from '../dtos/seller-response.dto';
import { AuthGuard } from '../../../security/guards/auth.guard';
import { RoleGuard } from '../../../security/guards/role.guard';
import { Roles } from '../../../security/decorators/roles.decorator';

@ApiTags('vendedores')
@ApiBearerAuth()
@UseGuards(AuthGuard, RoleGuard)
@Controller('sellers')
export class SellerController {
    constructor(private readonly sellerService: SellerService) {}

    @Post()
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Criar um novo vendedor' })
    @ApiResponse({
        status: 201,
        description: 'Vendedor criado com sucesso',
        type: SellerResponseDto,
    })
    @ApiResponse({ status: 400, description: 'Dados inválidos' })
    @ApiResponse({ status: 409, description: 'CNPJ já cadastrado' })
    async create(@Body() createSellerDto: CreateSellerDto): Promise<SellerResponseDto> {
        return this.sellerService.create(createSellerDto);
    }

    @Get()
    @Roles('ADMIN', 'MANAGER', 'USER')
    @ApiOperation({ summary: 'Listar todos os vendedores' })
    @ApiResponse({ status: 200, description: 'Lista de vendedores', type: [SellerResponseDto] })
    async findAll(): Promise<SellerResponseDto[]> {
        return this.sellerService.findAll();
    }

    @Get(':id')
    @Roles('ADMIN', 'MANAGER', 'USER')
    @ApiOperation({ summary: 'Buscar um vendedor por ID' })
    @ApiResponse({ status: 200, description: 'Vendedor encontrado', type: SellerResponseDto })
    @ApiResponse({ status: 404, description: 'Vendedor não encontrado' })
    async findOne(@Param('id') id: string): Promise<SellerResponseDto> {
        return this.sellerService.findOne(id);
    }

    @Patch(':id')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Atualizar um vendedor' })
    @ApiResponse({
        status: 200,
        description: 'Vendedor atualizado com sucesso',
        type: SellerResponseDto,
    })
    @ApiResponse({ status: 404, description: 'Vendedor não encontrado' })
    @ApiResponse({ status: 409, description: 'CNPJ já cadastrado' })
    async update(
        @Param('id') id: string,
        @Body() updateSellerDto: UpdateSellerDto,
    ): Promise<SellerResponseDto> {
        return this.sellerService.update(id, updateSellerDto);
    }

    @Delete(':id')
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Remover um vendedor' })
    @ApiResponse({ status: 200, description: 'Vendedor removido com sucesso' })
    @ApiResponse({ status: 404, description: 'Vendedor não encontrado' })
    async remove(@Param('id') id: string): Promise<void> {
        await this.sellerService.remove(id);
    }

    @Post('update-all-from-brasil-api')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Atualiza dados de todos os vendedores usando a Brasil API' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Dados atualizados com sucesso',
        schema: {
            properties: {
                success: { type: 'number' },
                failed: { type: 'number' },
                errors: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            cnpj: { type: 'string' },
                            error: { type: 'string' },
                        },
                    },
                },
            },
        },
    })
    async updateAllSellersDataFromBrasilApi() {
        return this.sellerService.updateAllSellersDataFromBrasilApi();
    }

    @Post(':id/update-from-brasil-api')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Atualiza dados de um vendedor específico usando a Brasil API' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Dados atualizados com sucesso',
        type: Object,
    })
    async updateSellerDataFromBrasilApi(@Param('id') id: string) {
        return this.sellerService.updateFromBrasilApi(id);
    }
}
