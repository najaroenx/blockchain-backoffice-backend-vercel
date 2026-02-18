jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from 'src/modules/internal/admin/controllers/admin.controller';
import { MintTHBToMerchant } from 'src/modules/internal/admin/handlers/mintTHBToMerchant.handler';

describe('AdminController', () => {
  let controller: AdminController;
  let mintHandler: jest.Mocked<MintTHBToMerchant>;

  beforeEach(async () => {
    mintHandler = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: MintTHBToMerchant, useValue: mintHandler }],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('mintTHBToMerchant delegates to handler', async () => {
    mintHandler.execute.mockResolvedValue({ txHash: '0xabc' } as any);
    const result = await controller.mintTHBToMerchant('m1', 1000);
    expect(mintHandler.execute).toHaveBeenCalledWith('m1', 1000);
    expect(result).toEqual({ txHash: '0xabc' });
  });
});
