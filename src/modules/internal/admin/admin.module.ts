import { Module } from '@nestjs/common';
import { AdminController } from './controllers/admin.controller';
import { DeleteVoucherCascade } from './handlers/delete-voucher-cascade.handler';
import { ExportAisLog } from './handlers/export-ais-log.handler';
import { ExportDatabase } from './handlers/export-database.handler';
import { ExportDatabaseSql } from './handlers/export-database-sql.handler';
import { ListAllPoints } from './handlers/list-all-points.handler';
import { AdminOnlyGuard } from './guards/admin-only.guard';
import { MintTHBToMerchant } from './handlers/mintTHBToMerchant.handler';
import { ResetCustomerPointBalances } from './handlers/reset-customer-point-balances.handler';
import { ResetVoucherTokenIds } from './handlers/reset-voucher-token-ids.handler';
import { UpdatePointContractAddress } from './handlers/update-point-contract-address.handler';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  controllers: [AdminController],
  providers: [
    MintTHBToMerchant,
    ExportAisLog,
    ExportDatabase,
    ExportDatabaseSql,
    ListAllPoints,
    DeleteVoucherCascade,
    ResetCustomerPointBalances,
    ResetVoucherTokenIds,
    UpdatePointContractAddress,
    AdminOnlyGuard,
    BlockchainService,
    PrismaService,
  ],
})
export class AdminModule {}
