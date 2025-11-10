import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PageOptionsDto } from '../src/common/dtos';

describe('PageOptionsDto', () => {
  it('should be defined', () => {
    expect(PageOptionsDto).toBeDefined();
  });

  it('should use default values when no input is provided', () => {
    const dto = new PageOptionsDto();
    expect(dto.page).toBe(1);
    expect(dto.take).toBe(10);
    expect(dto.skip).toBe(0); // (1 - 1) * 10
  });

  it('should transform string values to numbers', async () => {
    const dto = plainToInstance(PageOptionsDto, { page: '3', take: '5' });
    expect(dto.page).toBe(3);
    expect(dto.take).toBe(5);
    expect(dto.skip).toBe(10); // (3 - 1) * 5
  });

  it('should be valid when values are within the allowed range', async () => {
    const dto = plainToInstance(PageOptionsDto, { page: 2, take: 20 });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation when page is below 1', async () => {
    const dto = plainToInstance(PageOptionsDto, { page: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should calculate skip correctly', () => {
    const dto = plainToInstance(PageOptionsDto, { page: 5, take: 10 });
    expect(dto.skip).toBe(40); // (5 - 1) * 10
  });
});
