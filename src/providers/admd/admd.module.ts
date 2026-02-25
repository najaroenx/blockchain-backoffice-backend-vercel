import { Global, Module } from '@nestjs/common';
import { AdmdService } from './admd.service';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [AdmdService],
  exports: [AdmdService],
})
export class AdmdModule {}
