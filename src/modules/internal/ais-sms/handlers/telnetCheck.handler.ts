import { Injectable, Logger } from '@nestjs/common';
import {
  AisSmsService,
  TelnetCheckResult,
} from 'src/providers/ais-sms/ais-sms.service';
import { TelnetCheckQueryDto } from '../dtos/ais-sms.dto';

@Injectable()
export class TelnetCheck {
  private readonly logger = new Logger(TelnetCheck.name);

  constructor(private readonly aisSmsService: AisSmsService) {}

  async execute(dto: TelnetCheckQueryDto): Promise<TelnetCheckResult> {
    this.logger.log(`Test-probing TCP connectivity to ${dto.host}:${dto.port}`);
    return this.aisSmsService.telnetCheck(dto.host, dto.port, dto.timeoutMs);
  }
}
