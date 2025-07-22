/**
 * Jest setup file for Express API server package
 */

// Mock filesystem operations in test environment
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
    rename: jest.fn(),
    copyFile: jest.fn(),
    mkdtemp: jest.fn((prefix) => Promise.resolve(prefix + 'temp123')),
    rm: jest.fn(),
    rmdir: jest.fn(),
  },
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

// Suppress console output in tests to reduce noise
const originalConsole = { ...console };
console.log = jest.fn();
console.info = jest.fn();
console.warn = jest.fn();
console.debug = jest.fn();
console.error = jest.fn();

// Restore console after tests complete
afterAll(() => {
  Object.assign(console, originalConsole);
});

// Global test utilities for Express testing
global.mockRequest = (options = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  ...options,
});

global.mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

global.mockNext = () => jest.fn();