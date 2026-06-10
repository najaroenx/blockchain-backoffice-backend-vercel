module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.spec.json',
      },
    ],
  },
  // uuid >=14 is ESM-only (forced via resolutions) — jest must transform it to CJS
  transformIgnorePatterns: ['node_modules/(?!(uuid|nanoid|@babel/highlight)/)'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
    '^prisma/(.*)$': '<rootDir>/prisma/$1',
  },

  // ✅ เก็บ coverage ทุกครั้งที่เทส
  collectCoverage: true,

  // ✅ รวมทุกไฟล์ยกเว้นพวก bootstrap / module / index
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/index.ts',
  ],

  // ✅ เก็บผลไว้ในโฟลเดอร์ coverage
  coverageDirectory: './coverage',

  // ✅ SonarQube ต้องการ lcov format
  coverageReporters: ['text', 'lcov', 'clover', 'json-summary'],

  // ✅ ให้ Jest รู้ว่าใช้ ts-jest
  preset: 'ts-jest',
};
