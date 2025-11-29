import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { GetCustomerPhoneDevForRespType } from '../types';
import { TempLinkDBService } from 'src/modules/templink/service/templink-db.service';
import { OTPService } from 'src/providers/otp/otp.service';

@Injectable()
export class GetCustomerPhoneDevForResp {
  private logger = new Logger(GetCustomerPhoneDevForResp.name);

  constructor(
    private db: CustomerDBService,
    private tempLinkDBService: TempLinkDBService,
    private configService: ConfigService,
    private otpService: OTPService,
  ) {}

  async execute(
    merchantId: string,
    phone: string,
  ): Promise<GetCustomerPhoneDevForRespType> {
    try {
      const customer = await this.db.getCustomersByPhone(merchantId, phone);
      const otp = this.otpService.generateOTP(6);
      this.logger.log(`Generated OTP ${otp} for phone ${phone}`);
      if (!customer) {
        const findRequest =
          await this.tempLinkDBService.getTempLinkByPhoneNumber(phone);

        if (findRequest) {
          // Check if expired, update with new expiration
          if (findRequest.expire < new Date()) {
            const uuid = randomUUID();
            await this.tempLinkDBService.updateTempLink(findRequest.uid, {
              uid: uuid,
              expire: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
              otp: otp,
            });
            throw new NotFoundException({
              statusCode: 404,
              message: `Customer with phone ${phone} not found`,
              error: 'NEW_OTP_GENERATED',
              data: {
                url: `${this.configService.get('FRONT_URL')}/otp?requestid=${uuid}&merchantId=${merchantId}`,
                callbackUrl: 'http://localhost:4001/auth/verify',
                merchantId: merchantId,
              },
            });
          }

          throw new NotFoundException({
            statusCode: 404,
            message: `Customer with phone ${phone} not found`,
            error: 'NEW_OTP_GENERATED',
            data: {
              url: `${this.configService.get('FRONT_URL')}/otp?requestid=${findRequest.uid}&merchantId=${merchantId}`,
              callbackUrl: 'http://localhost:4001/auth/verify',
              merchantId: merchantId,
            },
          });
        }

        const uuid = randomUUID();
        await this.tempLinkDBService.createTempLink({
          merchantId,
          phoneNumber: phone,
          uid: uuid,
          otp: otp,
          expire: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        });
        throw new NotFoundException({
          statusCode: 404,
          message: `Customer with phone ${phone} not found`,
          data: {
            url: `${this.configService.get('FRONT_URL')}/otp?requestid=${uuid}&merchantId=${merchantId}`,
            callbackUrl: 'http://localhost:4001/auth/verify',
            merchantId: merchantId,
          },
        });
      }

      // Add mock vouchers if customer has no owned vouchers
      const ownedVouchers: any[] = customer.ownedVouchers || [];
      if (ownedVouchers.length === 0) {
        // Add mock vouchers for demonstration
        ownedVouchers.push({
          id: 'mock-voucher-1',
          code: 'WELCOME2024',
          voucherId: 'voucher-mock-1',
          pointsCost: 100,
          currency: 'POINTS',
          isUsed: false,
          usedAt: null,
          voucher: {
            id: 'voucher-mock-1',
            name: 'Welcome Discount 20%',
            description: 'Get 20% off on your first purchase',
            imageUrl:
              'https://via.placeholder.com/300x200?text=Welcome+Discount',
            value: 20,
            valueType: 'percentage',
            status: 'active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          },
        });
        ownedVouchers.push({
          id: 'mock-voucher-2',
          code: 'FREESHIP50',
          voucherId: 'voucher-mock-2',
          pointsCost: 50,
          currency: 'POINTS',
          isUsed: false,
          usedAt: null,
          voucher: {
            id: 'voucher-mock-2',
            name: 'Free Shipping',
            description: 'Free shipping on orders over $50',
            imageUrl: 'https://via.placeholder.com/300x200?text=Free+Shipping',
            value: 0,
            valueType: 'gift',
            status: 'active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
          },
        });
      }

      const formattedCustomer = {
        ...customer,
        phone: phone,
        walletAddress: customer.wallet?.walletAddress || '',
        ownedVouchers: ownedVouchers,
      };

      return {
        message: 'Customer found successfully',
        statusCode: 200,
        data: formattedCustomer,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }

  async executeDetailed(phone: string) {
    try {
      this.logger.log(`[START] Getting customer detailed by phone: ${phone}`);

      const customerData = await this.db.getCustomerByPhoneDetailed(phone);

      if (!customerData) {
        return {
          message: `Customer with phone ${phone} not found`,
          status: 404,
          data: null,
        };
      }

      this.logger.log(`[SUCCESS] Found customer: ${(customerData as any).id}`);

      const merchants = this.formatMerchantsWithPointsAndCoupons(customerData);
      const walletAddress = (customerData as any).wallet?.walletAddress || '';

      return {
        message: 'success',
        status: 200,
        data: {
          walletAddress,
          phone,
          customer: {
            id: (customerData as any).id,
            email: (customerData as any).email,
            firstName: (customerData as any).firstName,
            lastName: (customerData as any).lastName,
            tel: (customerData as any).tel,
            walletAddress,
            createdAt: (customerData as any).createdAt,
            updatedAt: (customerData as any).updatedAt,
            merchants,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting customer detailed by phone: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  private formatMerchantsWithPointsAndCoupons(customer: any) {
    const merchantMap = new Map();

    // Group by merchants
    customer.customerMerChant?.forEach((cm: any) => {
      if (cm.merchant) {
        merchantMap.set(cm.merchantId, {
          merchantId: cm.merchant.id,
          name: cm.merchant.name,
          description: cm.merchant.description || '',
          points: [],
          coupons: [],
        });
      }
    });

    // Add points to merchants
    customer.customerPoints?.forEach((cp: any) => {
      if (cp.point && cp.point.merchantId) {
        const merchant = merchantMap.get(cp.point.merchantId);
        if (merchant) {
          merchant.points.push({
            title: cp.point.name,
            balance: cp.balances,
            pointId: cp.point.id,
          });
        }
      }
    });

    // Add coupons to merchants
    customer.ownedVouchers?.forEach((voucher: any) => {
      if (voucher.voucher && voucher.voucher.merchantId) {
        const merchant = merchantMap.get(voucher.voucher.merchantId);
        if (merchant) {
          merchant.coupons.push({
            codeId: voucher.id,
            code: voucher.code,
            voucherId: voucher.voucherId,
            name: voucher.voucher.name,
            description: voucher.voucher.description,
            imageUrl: voucher.voucher.imageUrl,
            pointsCost: voucher.pointsCost,
            currency: voucher.currency,
            value: voucher.voucher.value,
            valueType: voucher.voucher.valueType,
          });
        }
      }
    });

    return Array.from(merchantMap.values());
  }
}
