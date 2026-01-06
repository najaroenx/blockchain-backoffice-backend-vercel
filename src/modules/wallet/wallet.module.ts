import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WalletRepository } from './wallet.repository';
import { WalletDBService } from './services/wallet-db.service';
import { WalletController } from './controllers/wallet.controller';
import { GetWalletByPhoneOrEmail } from './handlers/getWalletByPhoneOrEmail.handler';
import { GetThbBalance } from './handlers/getThbBalance.handler';
import { PrismaModule } from 'prisma/prisma.module';
import { BlockchainModule } from 'src/providers/blockchain/blockchain.module';

@Module({
  imports: [PrismaModule, BlockchainModule, ConfigModule],
  controllers: [WalletController],
  providers: [
    WalletRepository,
    WalletDBService,
    GetWalletByPhoneOrEmail,
    GetThbBalance,
  ],
  exports: [WalletDBService],
})
export class WalletModule {}
