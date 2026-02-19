jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WalletController } from 'src/modules/internal/wallet/controllers/wallet.controller';
import { GetWalletByPhoneOrEmail } from 'src/modules/internal/wallet/handlers/getWalletByPhoneOrEmail.handler';
import { GetThbBalance } from 'src/modules/internal/wallet/handlers/getThbBalance.handler';
import { GetSellerWalletByMerchantId } from 'src/modules/internal/wallet/handlers/getSellerWalletByMerchantId.handler';

describe('WalletController', () => {
  let controller: WalletController;
  let getWalletByPhoneOrEmail: jest.Mocked<GetWalletByPhoneOrEmail>;
  let getThbBalance: jest.Mocked<GetThbBalance>;
  let getSellerWallet: jest.Mocked<GetSellerWalletByMerchantId>;

  // Reset mocks before each test
  beforeEach(async () => {
    getWalletByPhoneOrEmail = { execute: jest.fn() } as any;
    getThbBalance = { execute: jest.fn() } as any;
    getSellerWallet = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        { provide: GetWalletByPhoneOrEmail, useValue: getWalletByPhoneOrEmail },
        { provide: GetThbBalance, useValue: getThbBalance },
        { provide: GetSellerWalletByMerchantId, useValue: getSellerWallet },
      ],
    }).compile();

    controller = module.get<WalletController>(WalletController);
  });

  it('getWalletByPhoneOrEmail with phone delegates to handler', async () => {
    getWalletByPhoneOrEmail.execute.mockResolvedValue({
      address: '0x1',
    } as any);
    const result = await controller.getWalletByPhoneOrEmail(
      '0812345678',
      undefined,
    );
    expect(getWalletByPhoneOrEmail.execute).toHaveBeenCalledWith(
      '0812345678',
      undefined,
    );
    expect(result).toEqual({ address: '0x1' });
  });

  it('getWalletByPhoneOrEmail with email delegates to handler', async () => {
    getWalletByPhoneOrEmail.execute.mockResolvedValue({
      address: '0x2',
    } as any);
    const result = await controller.getWalletByPhoneOrEmail(
      undefined,
      'test@test.com',
    );
    expect(getWalletByPhoneOrEmail.execute).toHaveBeenCalledWith(
      undefined,
      'test@test.com',
    );
    expect(result).toEqual({ address: '0x2' });
  });

  it('getWalletByPhoneOrEmail throws if no phone or email', async () => {
    await expect(
      controller.getWalletByPhoneOrEmail(undefined, undefined),
    ).rejects.toThrow(BadRequestException);
  });

  it('getThbBalance delegates to handler', async () => {
    getThbBalance.execute.mockResolvedValue({ balance: '100' } as any);
    const result = await controller.getThbBalance('0xabc');
    expect(getThbBalance.execute).toHaveBeenCalledWith('0xabc');
    expect(result).toEqual({ balance: '100' });
  });

  it('getSellerWalletByMerchantId delegates to handler', async () => {
    getSellerWallet.execute.mockResolvedValue({ wallet: '0x1' } as any);
    const result = await controller.getSellerWalletByMerchantId('m1');
    expect(getSellerWallet.execute).toHaveBeenCalledWith('m1');
    expect(result).toEqual({ wallet: '0x1' });
  });
});
