import { Point } from '@prisma/client';
import { PointInfo } from 'src/modules/customer/types';

export type GetPointsResponseType = {
  points: Array<
    Omit<Point, 'contractAddress'> & {
      contractAddress: string;
      remaining: string | null;
    }
  >;
  counts: number;
};

export type GetPointResponseType = {
  point: Omit<Point, 'contractAddress'> & { contractAddress: string };
};

export type UpdatePointResponseType = {
  point: Omit<Point, 'contractAddress'> & {
    contractAddress: string;
  };
};

export type PointMerchantInfo = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  website: string | null;
};

export type PointStatistics = {
  totalTransactions: number;
  totalCustomers: number;
  totalBalance: number;
  initialSupply: number;
  circulatingSupply: number;
};

export type GetPointByIdResponseType = {
  point: Omit<Point, 'contractAddress'> & {
    contractAddress: string;
    merchant: PointMerchantInfo | null;
    statistics: PointStatistics;
  };
};

export type GetPointByPhoneResponseType = {
  customerPoints: PointInfo[];
};
