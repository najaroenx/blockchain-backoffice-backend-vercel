import { Injectable, Logger } from '@nestjs/common';
import { AisSmsService } from 'src/providers/ais-sms/ais-sms.service';
import { AisSmsSendResult } from 'src/providers/ais-sms/types';
import { SendAisSmsTestDto } from '../dtos/ais-sms.dto';

@Injectable()
export class SendAisSmsTest {
  private readonly logger = new Logger(SendAisSmsTest.name);

  constructor(private readonly aisSmsService: AisSmsService) {}

  async execute(dto: SendAisSmsTestDto): Promise<AisSmsSendResult> {
    this.logger.log(`Test-sending AIS SMS to ${dto.to}`);
    return this.aisSmsService.sendMt({
      to: dto.to,
      content: dto.content,
      ctype: dto.ctype,
      report: dto.report,
    });
  }
}
