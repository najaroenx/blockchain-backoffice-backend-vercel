// jest.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',

  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
  },

  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/main.ts', // ไม่จำเป็นต้องเทส bootstrap หลัก
    '!src/**/*.module.ts', // Module ไม่ต้องเทส
    '!src/**/index.ts',
  ],
  coverageDirectory: './coverage',
};
