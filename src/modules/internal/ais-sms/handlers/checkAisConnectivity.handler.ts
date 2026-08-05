import { Injectable, Logger } from '@nestjs/common';
import { AisSmsService } from 'src/providers/ais-sms/ais-sms.service';
import { AisSmsConnectivityCheck } from 'src/providers/ais-sms/types';

@Injectable()
export class CheckAisConnectivity {
  private readonly logger = new Logger(CheckAisConnectivity.name);

  constructor(private readonly aisSmsService: AisSmsService) {}

  async execute(): Promise<AisSmsConnectivityCheck> {
    this.logger.log('Checking TCP connectivity to the AIS SMS gateway');
    return this.aisSmsService.checkConnectivity();
  }
}
