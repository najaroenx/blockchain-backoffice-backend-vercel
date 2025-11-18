import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  // CUSTOMER_NOT_FOUND,
  INTERNAL_SERVER_ERROR,
} from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import {
  GetCustomerByEmailResponseType,
  GetCustomerByPhoneResponseNotFoundType,
} from '../types';

@Injectable()
export class GetCustomerPhone {
  private logger = new Logger(GetCustomerPhone.name);

  constructor(private db: CustomerDBService) {}

  async execute(
    merchantId: string,
    phone: string,
  ): Promise<
    GetCustomerByEmailResponseType | GetCustomerByPhoneResponseNotFoundType
  > {
    try {
      const customer = await this.db.getCustomersByPhone(merchantId, phone);

      if (!customer)
        return {
          message: `Customer with phone ${phone} not found`,
          url: 'http://localhost:3000/otp?kid=dsadasdasdasd&cb=profile',
          callbackUrl: 'http://localhost:4001/auth/verify',
        };

      const formattedCustomer = {
        ...customer,
        phone: phone,
        walletAddress: customer.wallet?.walletAddress || '',
      };

      return {
        customer: formattedCustomer,
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
