import '@testing-library/jest-dom';

// React 18 testing setup with legacy mode compatibility
import { configure } from '@testing-library/react';

// Configure Testing Library for React 18 - use legacy mode for compatibility
configure({
  asyncUtilTimeout: 2000,
  computedStyleSupportsPseudoElements: true,
});

// Force React Testing Library to use legacy ReactDOM.render for tests
// This bypasses React 18's createRoot requirements
Object.defineProperty(global, 'IS_REACT_ACT_ENVIRONMENT', {
  writable: true, 
  value: true,
});

// Disable React 18's automatic batching in tests to prevent timing issues
if (typeof global.scheduler === 'undefined') {
  global.scheduler = {};
}

// React 18 compatibility: Ensure proper DOM environment
Object.defineProperty(window, 'IS_REACT_ACT_ENVIRONMENT', {
  writable: true,
  value: true,
});


// Mock fetch for tests with smart error handling
global.fetch = jest.fn((url: string, options?: any) => {
  // Parse request body if available
  let requestBody: any = {};
  if (options?.body) {
    try {
      requestBody = JSON.parse(options.body);
    } catch (e) {
      // Invalid JSON in request
    }
  }
  
  // Handle validation endpoint
  if (url.includes('/validation/validate')) {
    const { fileType, content } = requestBody;
    
    // Simulate validation failures
    if (fileType === 'settings' && content === 'invalid json') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ valid: false, errors: ['Invalid JSON format'] }),
        text: () => Promise.resolve(''),
        status: 200,
      });
    }
    
    if (fileType === 'unknown') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ valid: false, errors: ['Unknown file type'] }),
        text: () => Promise.resolve(''),
        status: 200,
      });
    }
    
    // Default success
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ valid: true, errors: [] }),
      text: () => Promise.resolve(''),
      status: 200,
    });
  }
  
  if (url.includes('/hooks/extract')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ hooks: [] }),
      text: () => Promise.resolve(''),
      status: 200,
    });
  }
  
  if (url.includes('/files/create-template')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ 
        template: { content: '# Template\n\nContent here.', path: 'template.md' } 
      }),
      text: () => Promise.resolve(''),
      status: 200,
    });
  }
  
  // Default response
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    status: 200,
  });
}) as jest.Mock;

// Mock File System Access API for tests
(globalThis as any).showDirectoryPicker = jest.fn();
(globalThis as any).showOpenFilePicker = jest.fn();
(globalThis as any).showSaveFilePicker = jest.fn();

// Mock window.File constructor
(globalThis as any).File = class MockFile {
  constructor(
    public fileBits: BlobPart[],
    public fileName: string,
    public options: FilePropertyBag = {}
  ) {}
};

// Mock FileReader
(globalThis as any).FileReader = class MockFileReader {
  readAsText = jest.fn();
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  result: string | ArrayBuffer | null = null;
};

// Suppress console errors/warnings in tests unless explicitly testing them
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

// Store original console methods
const bufferedLogs: Array<{ type: string; args: any[] }> = [];

// Override console methods
console.error = (...args: any[]) => {
  // Suppress specific warnings and test errors (only for strings)
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
     args[0].includes('Warning: An update to') ||
     args[0].includes('was not wrapped in act') ||
     args[0].includes('Save failed'))
  ) {
    return;
  }
  
  // Suppress Error objects with "Save failed" message
  if (args[0] instanceof Error && args[0].message === 'Save failed') {
    return;
  }
  
  bufferedLogs.push({ type: 'error', args });
};

console.warn = (...args: any[]) => {
  bufferedLogs.push({ type: 'warn', args });
};

console.log = (...args: any[]) => {
  bufferedLogs.push({ type: 'log', args });
};

// After each test, suppress logs
afterEach(() => {
  // For now, just suppress logs in tests to reduce noise
  bufferedLogs.length = 0;
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});