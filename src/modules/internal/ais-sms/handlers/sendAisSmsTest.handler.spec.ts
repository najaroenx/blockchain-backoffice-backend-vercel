import { Test, TestingModule } from '@nestjs/testing';
import { AisSmsService } from 'src/providers/ais-sms/ais-sms.service';
import { AisSmsSendResult } from 'src/providers/ais-sms/types';
import { SendAisSmsTest } from './sendAisSmsTest.handler';

describe('SendAisSmsTest', () => {
  let handler: SendAisSmsTest;
  let aisSmsService: { sendMt: jest.Mock };

  beforeEach(async () => {
    aisSmsService = { sendMt: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendAisSmsTest,
        { provide: AisSmsService, useValue: aisSmsService },
      ],
    }).compile();

    handler = module.get(SendAisSmsTest);
  });

  it('delegates to AisSmsService.sendMt with the DTO fields', async () => {
    const expected: AisSmsSendResult = {
      success: true,
      status: 'OK',
      detail: 'SUCCESS',
      smid: '1357412663',
      raw: '<XML/>',
    };
    aisSmsService.sendMt.mockResolvedValue(expected);

    const result = await handler.execute({
      to: '66818452233',
      content: 'AIS_TEST',
      ctype: 'TEXT',
      report: true,
    });

    expect(aisSmsService.sendMt).toHaveBeenCalledWith({
      to: '66818452233',
      content: 'AIS_TEST',
      ctype: 'TEXT',
      report: true,
    });
    expect(result).toBe(expected);
  });

  it('propagates errors thrown by the underlying service', async () => {
    aisSmsService.sendMt.mockRejectedValue(new Error('AIS SMS send failed'));

    await expect(
      handler.execute({ to: '66818452233', content: 'AIS_TEST' }),
    ).rejects.toThrow('AIS SMS send failed');
  });
});
