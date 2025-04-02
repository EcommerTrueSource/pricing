import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AutentiqueController } from './controllers/autentique.controller';
import { AutentiqueService } from './services/autentique.service';

@Module({
    imports: [ConfigModule],
    controllers: [AutentiqueController],
    providers: [AutentiqueService],
    exports: [AutentiqueService],
})
export class AutentiqueModule {}
