import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import {
  CreateTempLink,
  GetTempLinkByUid,
  GetTempLinksByMerchant,
  UpdateTempLink,
  DeleteTempLink,
} from '../handlers';
import { CreateOTP } from '../handlers/createOTP.handler';
import { VerifyOTP } from '../handlers/verifyOTP.handler';
import { ReSendOTP } from '../handlers/reSendOTP.handler';
import {
  CreateTempLinkDto,
  UpdateTempLinkDto,
  GetTempLinkByUidParams,
  GetTempLinksByMerchantParams,
  VerifyOtpDto,
  SendOtpDto,
} from '../dtos';
import { Public } from 'src/modules/internal/auth/public.decorator';

@ApiTags('TempLink')
@Controller('templink')
export class TempLinkController {
  constructor(
    private readonly createTempLinkHandler: CreateTempLink,
    private readonly getTempLinkByUidHandler: GetTempLinkByUid,
    private readonly getTempLinksByMerchantHandler: GetTempLinksByMerchant,
    private readonly updateTempLinkHandler: UpdateTempLink,
    private readonly deleteTempLinkHandler: DeleteTempLink,
    private readonly createOTPHandler: CreateOTP,
    private readonly verifyOTPHandler: VerifyOTP,
    private readonly reSendOTPHandler: ReSendOTP,
  ) {}

  @Public()
  @Post('/')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a temporary link for customer registration',
  })
  @ApiResponse({ status: 201, description: 'Temp link created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createTempLink(@Body() body: CreateTempLinkDto) {
    return this.createTempLinkHandler.execute(
      body.phoneNumber,
      body.merchantId,
      new Date(body.expire),
    );
  }
  @Public()
  @Get('/:uid')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get temporary link by UID' })
  @ApiParam({ name: 'uid', description: 'Unique identifier of the temp link' })
  @ApiResponse({ status: 200, description: 'Temp link retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Temp link not found' })
  async getTempLinkByUid(@Param() params: GetTempLinkByUidParams) {
    return this.getTempLinkByUidHandler.execute(params.uid);
  }

  @Get('/merchant/:merchantId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Get all temporary links for a merchant' })
  @ApiParam({ name: 'merchantId', description: 'Merchant ID' })
  @ApiResponse({
    status: 200,
    description: 'Temp links retrieved successfully',
  })
  async getTempLinksByMerchant(@Param() params: GetTempLinksByMerchantParams) {
    return this.getTempLinksByMerchantHandler.execute(params.merchantId);
  }

  @Put('/:uid')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update a temporary link' })
  @ApiParam({ name: 'uid', description: 'Unique identifier of the temp link' })
  @ApiResponse({ status: 200, description: 'Temp link updated successfully' })
  @ApiResponse({ status: 404, description: 'Temp link not found' })
  async updateTempLink(
    @Param() params: GetTempLinkByUidParams,
    @Body() body: UpdateTempLinkDto,
  ) {
    return this.updateTempLinkHandler.execute(
      params.uid,
      body.expire ? new Date(body.expire) : undefined,
    );
  }

  @Delete('/:uid')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a temporary link' })
  @ApiParam({ name: 'uid', description: 'Unique identifier of the temp link' })
  @ApiResponse({ status: 200, description: 'Temp link deleted successfully' })
  @ApiResponse({ status: 404, description: 'Temp link not found' })
  async deleteTempLink(@Param() params: GetTempLinkByUidParams) {
    return this.deleteTempLinkHandler.execute(params.uid);
  }

  @Public()
  @Post('/send-otp')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Send OTP to phone number',
    description:
      'Sends OTP code to the phone number associated with the request ID',
  })
  @ApiBody({ type: SendOtpDto })
  @ApiResponse({ status: 201, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'URL has expired' })
  @ApiResponse({ status: 404, description: 'Temp link not found' })
  async sendOTP(@Body() body: SendOtpDto) {
    return this.createOTPHandler.execute(body.requestId, body.phoneNumber);
  }

  @Public()
  @Post('/verify-otp')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify OTP code',
    description:
      'Verifies the OTP code and deletes the temp link after successful verification',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'OTP verified successfully, temp link deleted',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid OTP code or temp link expired',
  })
  @ApiResponse({ status: 404, description: 'Temp link not found' })
  async verifyOTP(@Body() body: VerifyOtpDto) {
    return this.verifyOTPHandler.execute(body.phoneNumber, body.otpCode);
  }

  @Public()
  @Post('/resend-otp')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Resend OTP code',
    description:
      'Generates a new OTP, updates expiry time, sends to phone number, and deletes temp link',
  })
  @ApiBody({
    schema: {
      properties: {
        requestId: {
          type: 'string',
          description: 'Request ID (UID) of the temp link',
        },
      },
      required: ['requestId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'OTP resent successfully, temp link deleted',
  })
  @ApiResponse({
    status: 400,
    description: 'URL has expired or phone number not found',
  })
  @ApiResponse({ status: 404, description: 'Temp link not found' })
  async resendOTP(@Body() body: { requestId: string }) {
    return this.reSendOTPHandler.execute(body.requestId);
  }
}
