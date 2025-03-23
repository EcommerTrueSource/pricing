import { Module } from '@nestjs/common';
import { TemplateController } from './controllers/template.controller';
import { TemplateService } from './services/template.service';
import { PrismaModule } from '../../../shared/modules/prisma.module';
import { ContractTemplateService } from './services/contract-template.service';
import { TemplatePreviewController } from './controllers/template-preview.controller';
import { GoogleDocsService } from './services/google-docs.service';

@Module({
  imports: [PrismaModule],
  controllers: [TemplateController, TemplatePreviewController],
  providers: [TemplateService, ContractTemplateService, GoogleDocsService],
  exports: [TemplateService, ContractTemplateService, GoogleDocsService],
})
export class TemplateModule {}
