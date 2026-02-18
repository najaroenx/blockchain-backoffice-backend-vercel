jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import {
  generateUniqueCodes,
  generateSequentialCodes,
  generateShortCodes,
} from 'src/modules/internal/voucher/utils/generate-codes.util';

describe('generate-codes.util', () => {
  describe('generateUniqueCodes', () => {
    it('should generate the requested number of unique codes', () => {
      const codes = generateUniqueCodes('voucher-abc-123', 10);
      expect(codes).toHaveLength(10);
      expect(new Set(codes).size).toBe(10); // all unique
    });

    it('should prefix codes with first 6 chars of voucherId (uppercased, alphanumeric only)', () => {
      const codes = generateUniqueCodes('abc-def-ghi', 3);
      for (const code of codes) {
        expect(code).toMatch(/^ABCDE-/); // 'abc-de' -> strip non-alnum -> 'ABCDE'
      }
    });

    it('should generate codes with hex random part', () => {
      const codes = generateUniqueCodes('VCHCR1', 5);
      for (const code of codes) {
        // PREFIX-XXXXXXXX (8 hex chars)
        expect(code).toMatch(/^[A-Z0-9]+-[A-F0-9]{8}$/);
      }
    });

    it('should handle large quantity', () => {
      const codes = generateUniqueCodes('test12', 500);
      expect(codes).toHaveLength(500);
      expect(new Set(codes).size).toBe(500);
    });

    it('should handle voucherId with special characters', () => {
      const codes = generateUniqueCodes('a!@#$%^&', 2);
      expect(codes).toHaveLength(2);
      // Special chars stripped: only 'A' remains as prefix
      for (const code of codes) {
        expect(code).toMatch(/^A-[A-F0-9]{8}$/);
      }
    });
  });

  describe('generateSequentialCodes', () => {
    it('should generate sequential codes', () => {
      const codes = generateSequentialCodes('voucher-abc', 5);
      expect(codes).toHaveLength(5);
    });

    it('should have sequential numbering', () => {
      const codes = generateSequentialCodes('ABCDEF', 3);
      expect(codes[0]).toMatch(/-0001$/);
      expect(codes[1]).toMatch(/-0002$/);
      expect(codes[2]).toMatch(/-0003$/);
    });

    it('should include timestamp in code', () => {
      const codes = generateSequentialCodes('test12', 1);
      // Format: PREFIX-TIMESTAMP-0001
      const parts = codes[0].split('-');
      expect(parts.length).toBe(3);
    });

    it('should prefix with first 6 uppercased alphanumeric chars', () => {
      const codes = generateSequentialCodes('hello-world', 1);
      expect(codes[0]).toMatch(/^HELLO-/); // 'hello-' -> strip non-alnum -> 'HELLO'
    });
  });

  describe('generateShortCodes', () => {
    it('should generate short unique codes', () => {
      const codes = generateShortCodes('ABCDEFGH', 10);
      expect(codes).toHaveLength(10);
      expect(new Set(codes).size).toBe(10);
    });

    it('should use first 4 chars as prefix', () => {
      const codes = generateShortCodes('test-voucher', 3);
      for (const code of codes) {
        expect(code).toMatch(/^TEST/);
      }
    });

    it('should generate 6 hex chars after prefix', () => {
      const codes = generateShortCodes('ABCD1234', 5);
      for (const code of codes) {
        // 4-char prefix + 6 hex chars = 10 chars total
        expect(code).toMatch(/^[A-Z0-9]{4}[A-F0-9]{6}$/);
      }
    });

    it('should handle large quantity', () => {
      const codes = generateShortCodes('test', 200);
      expect(codes).toHaveLength(200);
      expect(new Set(codes).size).toBe(200);
    });
  });
});
