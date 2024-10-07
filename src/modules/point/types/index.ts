import { Point } from '@prisma/client';

export type GetPointsResponseType = {
  points: Array<Omit<Point, 'contractAddress'> & { contractAddress: string }>;
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
