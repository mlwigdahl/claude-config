/**
 * Jest configuration for the React frontend app package
 */
export default {
  preset: 'ts-jest/presets/default-esm',
  displayName: 'app',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost/',
    // Proper HTML document structure for React 18
    html: '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
    // Additional JSDOM options for React 18 compatibility
    resources: 'usable',
    runScripts: 'dangerously',
  },
  setupFilesAfterEnv: ['<rootDir>/../../testing/setup/app.setup.js'],
  // React 18 globals
  globals: {
    IS_REACT_ACT_ENVIRONMENT: true,
  },
  rootDir: '../packages/app',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.{ts,tsx}', '**/?(*.)+(spec|test).{ts,tsx}'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      diagnostics: {
        ignoreCodes: [2339, 2345, 2307],
      },
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        noEmit: true,
      },
    }],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/main.tsx',
  ],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@claude-config/core$': '<rootDir>/../core/src',
    '^@claude-config/core/browser$': '<rootDir>/src/__mocks__/@claude-config/core/browser.js',
    '^@chakra-ui/icons$': '<rootDir>/src/__mocks__/@chakra-ui/icons.ts',
    '^@core/(.*)$': '<rootDir>/src/__mocks__/@core/$1',
  },
  coverageDirectory: '../../coverage/app',
  coverageReporters: ['text', 'lcov', 'html'],
};