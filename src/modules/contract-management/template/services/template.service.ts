import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/services/prisma.service';
import { CreateTemplateDto } from '../dtos/create-template.dto';
import { UpdateTemplateDto } from '../dtos/update-template.dto';
import { TemplateResponseDto } from '../dtos/template-response.dto';

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  private mapToResponseDto(template: any): TemplateResponseDto {
    return {
      id: template.id,
      name: template.name,
      content: template.content,
      version: template.version,
      isActive: template.is_active,
      createdAt: template.created_at,
      updatedAt: template.updated_at,
    };
  }

  async create(createTemplateDto: CreateTemplateDto): Promise<TemplateResponseDto> {
    // Verifica se já existe um template com a mesma versão
    const existingTemplate = await this.prisma.templates.findFirst({
      where: { version: createTemplateDto.version },
    });

    if (existingTemplate) {
      throw new BadRequestException(
        `Já existe um template com a versão ${createTemplateDto.version}`,
      );
    }

    const template = await this.prisma.templates.create({
      data: createTemplateDto,
    });
    return this.mapToResponseDto(template);
  }

  async findAll(): Promise<TemplateResponseDto[]> {
    const templates = await this.prisma.templates.findMany();
    return templates.map(template => this.mapToResponseDto(template));
  }

  async findOne(id: string): Promise<TemplateResponseDto> {
    const template = await this.prisma.templates.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template com ID ${id} não encontrado`);
    }

    return this.mapToResponseDto(template);
  }

  async update(id: string, updateTemplateDto: UpdateTemplateDto): Promise<TemplateResponseDto> {
    try {
      if (
        updateTemplateDto.version &&
        updateTemplateDto.version !== (await this.findOne(id)).version
      ) {
        const existingTemplate = await this.prisma.templates.findFirst({
          where: { version: updateTemplateDto.version },
        });

        if (existingTemplate) {
          throw new BadRequestException(
            `Já existe um template com a versão ${updateTemplateDto.version}`,
          );
        }
      }

      const template = await this.prisma.templates.update({
        where: { id },
        data: updateTemplateDto,
      });
      return this.mapToResponseDto(template);
    } catch (error) {
      throw new NotFoundException(`Template com ID ${id} não encontrado`);
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.templates.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Template com ID ${id} não encontrado`);
    }
  }

  async findActive(): Promise<TemplateResponseDto[]> {
    const templates = await this.prisma.templates.findMany({
      where: { is_active: true },
    });
    return templates.map(template => this.mapToResponseDto(template));
  }

  async findLatestVersion(): Promise<TemplateResponseDto> {
    const template = await this.prisma.templates.findFirst({
      where: { is_active: true },
      orderBy: {
        version: 'desc',
      },
    });

    if (!template) {
      throw new NotFoundException('Nenhum template ativo encontrado');
    }

    return this.mapToResponseDto(template);
  }
}
