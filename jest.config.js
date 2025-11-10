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
  transformIgnorePatterns: ['node_modules/(?!(nanoid|@babel/highlight)/)'],
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

  // ✅ ให้ Jest รู้ว่าใช้ ts-jest
  preset: 'ts-jest',
};
