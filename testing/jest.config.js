/**
 * Root Jest configuration for orchestrating all package tests
 */
export default {
  projects: [
    '<rootDir>/jest.core.config.js',
    '<rootDir>/jest.server.config.js',
    '<rootDir>/jest.app.config.js',
  ],
  collectCoverageFrom: [
    'packages/*/src/**/*.{ts,tsx}',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/__tests__/**',
    '!packages/app/src/main.tsx',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};