import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TemplateController } from './controllers/template.controller';
import { TemplateService } from './services/template.service';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { ContractTemplateService } from './services/contract-template.service';
import { GoogleDocsService } from './services/google-docs.service';
import { TemplatePreviewController } from './controllers/template-preview.controller';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [TemplateController, TemplatePreviewController],
  providers: [TemplateService, ContractTemplateService, GoogleDocsService],
  exports: [ContractTemplateService, GoogleDocsService],
})
export class TemplateModule {}
