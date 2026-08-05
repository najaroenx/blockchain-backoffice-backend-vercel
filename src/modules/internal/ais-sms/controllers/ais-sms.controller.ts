import { Controller, Post, Get, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/modules/internal/auth/public.decorator';
import { SendAisSmsTest } from '../handlers/sendAisSmsTest.handler';
import { CheckAisConnectivity } from '../handlers/checkAisConnectivity.handler';
import { SendAisSmsTestDto } from '../dtos/ais-sms.dto';

@ApiTags('AIS SMS')
@Controller('ais-sms')
export class AisSmsController {
  constructor(
    private readonly sendAisSmsTestHandler: SendAisSmsTest,
    private readonly checkAisConnectivityHandler: CheckAisConnectivity,
  ) {}

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

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('/connectivity-check')
  @ApiOperation({
    summary: 'Raw TCP connectivity check against the AIS SMS gateway',
    description:
      'Opens a bare TCP connection to the configured AIS gateway host/port - the same thing a manual `telnet host port` would tell you. Sends no HTTP request and no SMS (no charge), so it can be polled freely to tell a network/firewall block apart from AIS itself being unreachable.',
  })
  @ApiResponse({
    status: 200,
    description: 'TCP connectivity result (connected, host, port, egressIp)',
  })
  async checkConnectivity() {
    return this.checkAisConnectivityHandler.execute();
  }
}
