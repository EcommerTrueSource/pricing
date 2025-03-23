import { CommandFactory } from 'nest-commander';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContractManagementModule } from './modules/contract-management/contract-management.module';
import { UpdateSellersCommand } from './modules/contract-management/commands/update-sellers.command';
import { UpdateRemainingSellersCommand } from './modules/contract-management/commands/update-remaining-sellers.command';
import { SellerModule } from './modules/contract-management/seller/seller.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
    }),
    ContractManagementModule,
    SellerModule,
  ],
  providers: [UpdateSellersCommand, UpdateRemainingSellersCommand],
})
class CommandModule {}

async function bootstrap() {
  await CommandFactory.run(CommandModule, {
    logger: ['error', 'warn', 'log'],
  });
}

bootstrap();
