import { Controller, Post, Get, Body, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/modules/internal/auth/public.decorator';
import { SendAisSmsTest } from '../handlers/sendAisSmsTest.handler';
import { TelnetCheck } from '../handlers/telnetCheck.handler';
import { SendAisSmsTestDto, TelnetCheckQueryDto } from '../dtos/ais-sms.dto';

@ApiTags('AIS SMS')
@Controller('ais-sms')
export class AisSmsController {
  constructor(
    private readonly sendAisSmsTestHandler: SendAisSmsTest,
    private readonly telnetCheckHandler: TelnetCheck,
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
  @Get('/telnet-check')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Raw TCP connectivity check (like `telnet host port`)',
    description:
      'Opens a bare TCP connection to the given host/port, bypassing HTTP entirely. Used to diagnose network/firewall reachability issues (e.g. whether this pod can reach an AIS gateway) independent of anything at the HTTP layer.',
  })
  @ApiResponse({
    status: 200,
    description: 'Connectivity result (reachable, durationMs, error if any)',
  })
  async telnetCheck(@Query() query: TelnetCheckQueryDto) {
    return this.telnetCheckHandler.execute(query);
  }
}
