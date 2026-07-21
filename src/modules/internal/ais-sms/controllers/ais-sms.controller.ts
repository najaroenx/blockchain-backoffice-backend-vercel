import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/modules/internal/auth/public.decorator';
import { SendAisSmsTest } from '../handlers/sendAisSmsTest.handler';
import { SendAisSmsTestDto } from '../dtos/ais-sms.dto';

@ApiTags('AIS SMS')
@Controller('ais-sms')
export class AisSmsController {
  constructor(private readonly sendAisSmsTestHandler: SendAisSmsTest) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('/test-send')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Test-send an SMS via the AIS MT gateway',
    description:
      'Fires a real MT (Mobile Terminate) request against the AIS SMS gateway configured via AIS_SMS_* env vars, for manual/QA testing. CTYPE (TEXT/UNICODE) is auto-detected from the message content unless ctype is given.',
  })
  @ApiBody({ type: SendAisSmsTestDto })
  @ApiResponse({
    status: 200,
    description: 'AIS gateway response (status/detail/smid)',
  })
  @ApiResponse({ status: 503, description: 'AIS gateway unreachable' })
  async testSend(@Body() body: SendAisSmsTestDto) {
    return this.sendAisSmsTestHandler.execute(body);
  }
}
