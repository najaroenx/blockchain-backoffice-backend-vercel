import { Module, Global } from '@nestjs/common';
import { MerchantRefEnrichmentService } from './services/merchant-ref-enrichment.service';
import { PrismaModule } from 'prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [MerchantRefEnrichmentService],
  exports: [MerchantRefEnrichmentService],
})
export class SharedModule {}
