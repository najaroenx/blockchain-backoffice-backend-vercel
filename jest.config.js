module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '**/*.spec.ts', // ✅ เจอ test ทั้งใน src/ และ test/
  ],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
