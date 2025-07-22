/**
 * Jest setup file for core business logic package
 */

// Mock filesystem operations in test environment with actual implementations
const originalFs = jest.requireActual('fs');

jest.mock('fs', () => ({
  promises: {
    access: originalFs.promises.access,
    readFile: originalFs.promises.readFile,
    writeFile: originalFs.promises.writeFile,
    mkdir: originalFs.promises.mkdir,
    readdir: originalFs.promises.readdir,
    stat: originalFs.promises.stat,
    unlink: originalFs.promises.unlink,
    rename: originalFs.promises.rename,
    copyFile: originalFs.promises.copyFile,
    mkdtemp: originalFs.promises.mkdtemp,
    rm: originalFs.promises.rm,
    rmdir: originalFs.promises.rmdir,
    chmod: originalFs.promises.chmod,
    symlink: originalFs.promises.symlink,
  },
  // Add synchronous fs functions
  readFileSync: originalFs.readFileSync,
  writeFileSync: originalFs.writeFileSync,
  existsSync: originalFs.existsSync,
  statSync: originalFs.statSync,
  mkdirSync: originalFs.mkdirSync,
  readdirSync: originalFs.readdirSync,
  unlinkSync: originalFs.unlinkSync,
  renameSync: originalFs.renameSync,
  copyFileSync: originalFs.copyFileSync,
  chmodSync: originalFs.chmodSync,
}));

// Set test environment variables
process.env.NODE_ENV = 'test';

// Suppress console output in tests to reduce noise
const originalConsole = { ...console };
console.log = jest.fn();
console.info = jest.fn();
console.warn = jest.fn();
console.debug = jest.fn();
// Keep console.error for actual test failures, but suppress expected error logs
const originalError = console.error;
console.error = jest.fn((message, ...args) => {
  // Only show actual Jest/test errors, not application errors
  if (typeof message === 'string' && (
    message.includes('ERROR:') ||
    message.includes('Failed to read file') ||
    message.includes('Failed to write file') ||
    message.includes('Failed to ensure directory') ||
    message.includes('Failed to move file') ||
    message.includes('Failed to delete file') ||
    message.includes('Failed to list directory')
  )) {
    // Suppress expected application errors during tests
    return;
  }
  // Allow other errors through (like actual test failures)
  originalError(message, ...args);
});

// Restore console after tests complete
afterAll(() => {
  Object.assign(console, originalConsole);
});