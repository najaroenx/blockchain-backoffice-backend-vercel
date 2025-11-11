import { Module } from '@nestjs/common';
import { WalletRepository } from './wallet.repository';
import { WalletDBService } from './services/wallet-db.service';
import { WalletController } from './controllers/wallet.controller';
import { GetWalletByPhoneOrEmail } from './handlers/getWalletByPhoneOrEmail.handler';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WalletController],
  providers: [WalletRepository, WalletDBService, GetWalletByPhoneOrEmail],
  exports: [WalletDBService],
})
export class WalletModule {}
