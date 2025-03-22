import { Module } from '@nestjs/common';
import { TemplateController } from './controllers/template.controller';
import { TemplateService } from './services/template.service';
import { PrismaModule } from '../../../shared/modules/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TemplateController],
  providers: [TemplateService],
  exports: [TemplateService],
})
export class TemplateModule {}
