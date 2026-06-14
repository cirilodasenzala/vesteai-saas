/** Jest config para os testes unitários da API. */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@vesteai/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  // Garante que o pacote shared esteja buildado antes (npm run build --workspace @vesteai/shared).
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};
