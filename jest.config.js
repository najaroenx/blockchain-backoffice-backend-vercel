// jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  // หรือครอบคลุมทั้ง .spec.ts และ .test.ts
  // testRegex: '.*\\.(spec|test)\\.ts$',

  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // ✅ ให้ Jest รู้จัก NestJS module
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
  },

  // ✅ เก็บ coverage และรวมเฉพาะโค้ดใน src/*
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/main.ts',          // ไม่จำเป็นต้องเทส bootstrap หลัก
    '!src/**/*.module.ts',   // Module ไม่ต้องเทส
    '!src/**/index.ts',
  ],
  coverageDirectory: './coverage',

  // ✅ ถ้าใช้ Prisma / Mongo / Redis หรือ service ภายนอกสามารถ mock ได้
  // setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
