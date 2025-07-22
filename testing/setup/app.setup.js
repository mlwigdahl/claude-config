/**
 * Jest setup file for React frontend app package
 * This file imports the existing setupTests.ts and adds additional shared setup
 */

require('@testing-library/jest-dom');

// Import existing app-specific setup
require('../../packages/app/src/setupTests.ts');

// Mock @claude-config/core/browser for app tests
jest.mock('@claude-config/core/browser', () => ({
  createClientConfigurationService: jest.fn(() => ({
    setProjectHandle: jest.fn(),
    discoverProjectFiles: jest.fn().mockResolvedValue([]),
    readFile: jest.fn().mockResolvedValue('mock content'),
    writeFile: jest.fn().mockResolvedValue(undefined),
    createFile: jest.fn().mockResolvedValue({ success: true }),
    deleteFile: jest.fn().mockResolvedValue({ success: true }),
    validateViaAPI: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
    createFileTemplate: jest.fn().mockResolvedValue({ success: true, data: { template: { content: '# Template', path: 'template.md' } } }),
    extractHooksFromSettings: jest.fn().mockResolvedValue([]),
    validateMultipleFiles: jest.fn().mockResolvedValue([]),
  })),
  ClientConfigurationService: jest.fn(),
  LogLevel: {
    DEBUG: 'debug',
    INFO: 'info', 
    WARN: 'warn',
    ERROR: 'error',
  },
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// React Router mocking is handled in the app's own setupTests.ts file