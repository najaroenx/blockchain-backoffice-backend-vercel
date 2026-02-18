jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { TempLinkController } from 'src/modules/internal/templink/controllers/templink.controller';
import { CreateTempLink } from 'src/modules/internal/templink/handlers/createTempLink.handler';
import { GetTempLinkByUid } from 'src/modules/internal/templink/handlers/getTempLinkByUid.handler';
import { GetTempLinksByMerchant } from 'src/modules/internal/templink/handlers/getTempLinksByMerchant.handler';
import { UpdateTempLink } from 'src/modules/internal/templink/handlers/updateTempLink.handler';
import { DeleteTempLink } from 'src/modules/internal/templink/handlers/deleteTempLink.handler';
import { CreateOTP } from 'src/modules/internal/templink/handlers/createOTP.handler';
import { VerifyOTP } from 'src/modules/internal/templink/handlers/verifyOTP.handler';
import { ReSendOTP } from 'src/modules/internal/templink/handlers/reSendOTP.handler';

describe('TempLinkController', () => {
  let controller: TempLinkController;
  let createTempLink: jest.Mocked<CreateTempLink>;
  let getTempLinkByUid: jest.Mocked<GetTempLinkByUid>;
  let getTempLinksByMerchant: jest.Mocked<GetTempLinksByMerchant>;
  let updateTempLink: jest.Mocked<UpdateTempLink>;
  let deleteTempLink: jest.Mocked<DeleteTempLink>;
  let createOTP: jest.Mocked<CreateOTP>;
  let verifyOTP: jest.Mocked<VerifyOTP>;
  let reSendOTP: jest.Mocked<ReSendOTP>;

  beforeEach(async () => {
    createTempLink = { execute: jest.fn() } as any;
    getTempLinkByUid = { execute: jest.fn() } as any;
    getTempLinksByMerchant = { execute: jest.fn() } as any;
    updateTempLink = { execute: jest.fn() } as any;
    deleteTempLink = { execute: jest.fn() } as any;
    createOTP = { execute: jest.fn() } as any;
    verifyOTP = { execute: jest.fn() } as any;
    reSendOTP = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TempLinkController],
      providers: [
        { provide: CreateTempLink, useValue: createTempLink },
        { provide: GetTempLinkByUid, useValue: getTempLinkByUid },
        { provide: GetTempLinksByMerchant, useValue: getTempLinksByMerchant },
        { provide: UpdateTempLink, useValue: updateTempLink },
        { provide: DeleteTempLink, useValue: deleteTempLink },
        { provide: CreateOTP, useValue: createOTP },
        { provide: VerifyOTP, useValue: verifyOTP },
        { provide: ReSendOTP, useValue: reSendOTP },
      ],
    }).compile();

    controller = module.get<TempLinkController>(TempLinkController);
  });

  it('createTempLink parses expire date and delegates', async () => {
    createTempLink.execute.mockResolvedValue({ uid: 'u1' } as any);
    const body = {
      phoneNumber: '081',
      merchantId: 'm1',
      expire: '2025-12-31T00:00:00Z',
    } as any;
    const result = await controller.createTempLink(body);
    expect(createTempLink.execute).toHaveBeenCalledWith(
      '081',
      'm1',
      expect.any(Date),
    );
    expect(result).toEqual({ uid: 'u1' });
  });

  it('getTempLinkByUid delegates to handler', async () => {
    getTempLinkByUid.execute.mockResolvedValue({ uid: 'u1' } as any);
    const result = await controller.getTempLinkByUid({ uid: 'u1' } as any);
    expect(getTempLinkByUid.execute).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ uid: 'u1' });
  });

  it('getTempLinksByMerchant delegates to handler', async () => {
    getTempLinksByMerchant.execute.mockResolvedValue([] as any);
    const result = await controller.getTempLinksByMerchant({
      merchantId: 'm1',
    } as any);
    expect(getTempLinksByMerchant.execute).toHaveBeenCalledWith('m1');
    expect(result).toEqual([]);
  });

  it('updateTempLink delegates with parsed date', async () => {
    updateTempLink.execute.mockResolvedValue({ uid: 'u1' } as any);
    const result = await controller.updateTempLink(
      { uid: 'u1' } as any,
      { expire: '2025-12-31T00:00:00Z' } as any,
    );
    expect(updateTempLink.execute).toHaveBeenCalledWith('u1', expect.any(Date));
    expect(result).toEqual({ uid: 'u1' });
  });

  it('updateTempLink delegates with undefined expire', async () => {
    updateTempLink.execute.mockResolvedValue({ uid: 'u1' } as any);
    await controller.updateTempLink({ uid: 'u1' } as any, {} as any);
    expect(updateTempLink.execute).toHaveBeenCalledWith('u1', undefined);
  });

  it('deleteTempLink delegates to handler', async () => {
    deleteTempLink.execute.mockResolvedValue({ deleted: true } as any);
    const result = await controller.deleteTempLink({ uid: 'u1' } as any);
    expect(deleteTempLink.execute).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ deleted: true });
  });

  it('sendOTP delegates to createOTPHandler', async () => {
    createOTP.execute.mockResolvedValue({ sent: true } as any);
    const result = await controller.sendOTP({
      requestId: 'r1',
      phoneNumber: '081',
    } as any);
    expect(createOTP.execute).toHaveBeenCalledWith('r1', '081');
    expect(result).toEqual({ sent: true });
  });

  it('verifyOTP delegates to handler', async () => {
    verifyOTP.execute.mockResolvedValue({ verified: true } as any);
    const result = await controller.verifyOTP({
      phoneNumber: '081',
      otpCode: '123456',
    } as any);
    expect(verifyOTP.execute).toHaveBeenCalledWith('081', '123456');
    expect(result).toEqual({ verified: true });
  });

  it('resendOTP delegates to handler', async () => {
    reSendOTP.execute.mockResolvedValue({ resent: true } as any);
    const result = await controller.resendOTP({ requestId: 'r1' });
    expect(reSendOTP.execute).toHaveBeenCalledWith('r1');
    expect(result).toEqual({ resent: true });
  });
});
