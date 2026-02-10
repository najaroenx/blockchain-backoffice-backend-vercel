import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';

@Injectable()
export class GetCustomerPoints {
  private logger = new Logger(GetCustomerPoints.name);

  constructor(private db: CustomerDBService) {}

  async execute(phone: string) {
    try {
      this.logger.log(`[START] Getting customer points by phone: ${phone}`);

      const customerData = await this.db.getCustomerByPhoneDetailed(phone);

      if (!customerData) {
        throw new NotFoundException({
          statusCode: 404,
          message: `Customer with phone ${phone} not found`,
          error: 'CUSTOMER_NOT_FOUND',
        });
      }

      this.logger.log(`[SUCCESS] Found customer: ${(customerData as any).id}`);

      const merchants = this.formatMerchantsWithPointsOnly(customerData);
      const walletAddress = (customerData as any).wallet?.walletAddress || '';

      return {
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
      };
    } catch (error) {
      this.logger.error(
        `Error getting customer points by phone: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  private formatMerchantsWithPointsOnly(customer: any) {
    const merchantMap = new Map();

    // Group by merchants
    customer.customerMerChant?.forEach((cm: any) => {
      if (cm.merchant) {
        merchantMap.set(cm.merchantId, {
          merchantId: cm.merchant.id,
          name: cm.merchant.name,
          description: cm.merchant.description || '',
          points: [],
        });
      }
    });

    // Add points to merchants (no coupons)
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

    return Array.from(merchantMap.values());
  }
}
