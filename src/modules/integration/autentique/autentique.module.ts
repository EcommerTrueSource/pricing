import { Module } from '@nestjs/common';
import { AutentiqueController } from './controllers/autentique.controller';
import { AutentiqueService } from './services/autentique.service';

@Module({
  controllers: [AutentiqueController],
  providers: [AutentiqueService],
  exports: [AutentiqueService],
})
export class AutentiqueModule {}
