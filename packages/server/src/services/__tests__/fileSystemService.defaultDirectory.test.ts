import { FileSystemService } from '../fileSystemService';
import { ConsolidatedFileSystem } from '@claude-config/core';
import { createError } from '../../middleware/errorHandler';
import * as os from 'os';

// Mock dependencies
jest.mock('@claude-config/core', () => ({
  ConsolidatedFileSystem: {
    getFileStats: jest.fn(),
  },
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  })),
}));
jest.mock('../../middleware/errorHandler');
jest.mock('os');

const mockConsolidatedFileSystem = ConsolidatedFileSystem as jest.Mocked<typeof ConsolidatedFileSystem>;
const mockCreateError = createError as jest.MockedFunction<typeof createError>;
const mockOs = os as jest.Mocked<typeof os>;

describe('FileSystemService - Default Directory', () => {
  let fileSystemService: FileSystemService;
  let originalPlatform: string;

  beforeEach(() => {
    jest.clearAllMocks();
    fileSystemService = new FileSystemService();
    originalPlatform = process.platform;
    
    // Mock createError to return a simple Error
    mockCreateError.mockImplementation((message: string, statusCode?: number, code?: string) => {
      const error = new Error(message) as any;
      error.status = statusCode || 500;
      error.code = code;
      return error;
    });
  });

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  describe('macOS/Linux Default Directory', () => {
    beforeEach(() => {
      // Mock macOS platform
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      mockOs.homedir.mockReturnValue('/Users/testuser');
    });

    it('should return Documents directory if it exists', async () => {
      // Mock Documents directory exists
      mockConsolidatedFileSystem.getFileStats
        .mockResolvedValueOnce({
          exists: true,
          isDirectory: true,
          isFile: false,
          size: 0,
          lastModified: new Date(),
        });

      const result = await fileSystemService.getDefaultDirectory();

      expect(result).toEqual({
        defaultDirectory: '/Users/testuser/Documents',
        homeDirectory: '/Users/testuser',
        platform: 'darwin',
        drives: undefined,
      });
    });

    it('should fallback to Desktop if Documents does not exist', async () => {
      // Mock Documents doesn't exist, Desktop does
      mockConsolidatedFileSystem.getFileStats
        .mockRejectedValueOnce(new Error('Directory not found'))
        .mockResolvedValueOnce({
          exists: true,
          isDirectory: true,
          isFile: false,
          size: 0,
          lastModified: new Date(),
        });

      const result = await fileSystemService.getDefaultDirectory();

      expect(result).toEqual({
        defaultDirectory: '/Users/testuser/Desktop',
        homeDirectory: '/Users/testuser',
        platform: 'darwin',
        drives: undefined,
      });
    });

    it('should fallback to home directory if neither Documents nor Desktop exist', async () => {
      // Mock both Documents and Desktop don't exist, home does
      mockConsolidatedFileSystem.getFileStats
        .mockRejectedValueOnce(new Error('Directory not found'))
        .mockRejectedValueOnce(new Error('Directory not found'))
        .mockResolvedValueOnce({
          exists: true,
          isDirectory: true,
          isFile: false,
          size: 0,
          lastModified: new Date(),
        });

      const result = await fileSystemService.getDefaultDirectory();

      expect(result).toEqual({
        defaultDirectory: '/Users/testuser',
        homeDirectory: '/Users/testuser',
        platform: 'darwin',
        drives: undefined,
      });
    });
  });

  describe('Windows Default Directory', () => {
    beforeEach(() => {
      // Mock Windows platform
      Object.defineProperty(process, 'platform', { value: 'win32' });
      mockOs.homedir.mockReturnValue('C:\\Users\\testuser');
    });

    it('should return Documents directory if it exists and discover drives', async () => {
      // Mock based on path being checked
      mockConsolidatedFileSystem.getFileStats.mockImplementation((path: string) => {
        if (path.includes('Documents')) {
          // Documents directory exists
          return Promise.resolve({
            exists: true,
            isDirectory: true,
            isFile: false,
            size: 0,
            lastModified: new Date(),
          });
        } else if (path === 'C:\\') {
          // C: drive exists  
          return Promise.resolve({
            exists: true,
            isDirectory: true,
            isFile: false,
            size: 0,
            lastModified: new Date(),
          });
        } else {
          // Other drives don't exist
          return Promise.reject(new Error('Drive not found'));
        }
      });

      const result = await fileSystemService.getDefaultDirectory();

      expect(result.homeDirectory).toBe('C:\\Users\\testuser');
      expect(result.platform).toBe('win32');
      expect(result.drives).toEqual(['C:']);
      expect(result.defaultDirectory).toContain('Documents');
    });

    it('should fallback to home directory if Documents does not exist', async () => {
      // Mock based on path being checked
      mockConsolidatedFileSystem.getFileStats.mockImplementation((path: string) => {
        if (path === 'C:\\Users\\testuser\\Documents') {
          // Documents directory doesn't exist
          return Promise.reject(new Error('Directory not found'));
        } else if (path === 'D:\\') {
          // D: drive exists  
          return Promise.resolve({
            exists: true,
            isDirectory: true,
            isFile: false,
            size: 0,
            lastModified: new Date(),
          });
        } else {
          // Other drives don't exist
          return Promise.reject(new Error('Drive not found'));
        }
      });

      const result = await fileSystemService.getDefaultDirectory();

      expect(result.defaultDirectory).toBe('C:\\Users\\testuser');
      expect(result.homeDirectory).toBe('C:\\Users\\testuser');
      expect(result.platform).toBe('win32');
      expect(result.drives).toEqual(['D:']);
    });

    it('should handle case where no drives are found', async () => {
      // Mock Documents doesn't exist
      mockConsolidatedFileSystem.getFileStats
        .mockRejectedValueOnce(new Error('Directory not found'))
        // Mock no drives exist (shouldn't happen in reality)
        .mockRejectedValue(new Error('Drive not found'));

      const result = await fileSystemService.getDefaultDirectory();

      expect(result).toEqual({
        defaultDirectory: 'C:\\Users\\testuser',
        homeDirectory: 'C:\\Users\\testuser',
        platform: 'win32',
        drives: undefined,
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      mockOs.homedir.mockReturnValue('/Users/testuser');
    });

    it('should handle file system errors gracefully', async () => {
      // Mock all file system calls fail
      mockConsolidatedFileSystem.getFileStats.mockRejectedValue(new Error('File system error'));

      const result = await fileSystemService.getDefaultDirectory();

      // Should still return home directory even if all checks fail
      expect(result).toEqual({
        defaultDirectory: '/Users/testuser',
        homeDirectory: '/Users/testuser',
        platform: 'darwin',
        drives: undefined,
      });
    });
  });
});