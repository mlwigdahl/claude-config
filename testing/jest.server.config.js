/**
 * Jest configuration for the Express API server package
 */
export default {
  preset: 'ts-jest/presets/default-esm',
  displayName: 'server',
  testEnvironment: 'node',
  rootDir: '../packages/server',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@claude-config/core$': '<rootDir>/../core/src',
  },
  coverageDirectory: '../../coverage/server',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/../../testing/setup/server.setup.js'],
};