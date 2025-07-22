import { FileSystemService } from '../fileSystemService';
import { ConsolidatedFileSystem } from '@claude-config/core';
import { createError } from '../../middleware/errorHandler';

// Mock dependencies
jest.mock('@claude-config/core');
jest.mock('../../middleware/errorHandler');
jest.mock('@claude-config/core', () => ({
  ConsolidatedFileSystem: {
    getFileStats: jest.fn(),
    moveFile: jest.fn(),
  },
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    error: jest.fn(),
  })),
}));

const mockConsolidatedFileSystem = ConsolidatedFileSystem as jest.Mocked<typeof ConsolidatedFileSystem>;
const mockCreateError = createError as jest.MockedFunction<typeof createError>;

describe('FileSystemService - File Renaming', () => {
  let fileSystemService: FileSystemService;

  beforeEach(() => {
    jest.clearAllMocks();
    fileSystemService = new FileSystemService();
    
    // Mock createError to return a simple Error
    mockCreateError.mockImplementation((message: string, statusCode?: number, code?: string) => {
      const error = new Error(message) as any;
      error.status = statusCode || 500;
      error.code = code;
      return error;
    });
  });

  describe('Basic Validation', () => {
    it('should reject rename if source file does not exist', async () => {
      mockConsolidatedFileSystem.getFileStats.mockResolvedValue({
        exists: false,
        isFile: false,
        isDirectory: false,
        size: 0,
        lastModified: new Date(),
      });

      await expect(
        fileSystemService.renameFile('/project/nonexistent.md', '/project/new-name.md')
      ).rejects.toMatchObject({
        message: 'Source file not found',
        status: 404,
      });
    });

    it('should reject rename if source is not a file', async () => {
      mockConsolidatedFileSystem.getFileStats
        .mockResolvedValueOnce({
          exists: true,
          isFile: false,
          isDirectory: true,
          size: 0,
          lastModified: new Date(),
        });

      await expect(
        fileSystemService.renameFile('/project/directory', '/project/new-name.md')
      ).rejects.toMatchObject({
        message: 'Source path is not a file',
        status: 400,
      });
    });

    it('should reject rename if target file already exists', async () => {
      mockConsolidatedFileSystem.getFileStats
        .mockResolvedValueOnce({
          exists: true,
          isFile: true,
          isDirectory: false,
          size: 100,
          lastModified: new Date(),
        })
        .mockResolvedValueOnce({
          exists: true,
          isFile: true,
          isDirectory: false,
          size: 100,
          lastModified: new Date(),
        });

      await expect(
        fileSystemService.renameFile('/project/source.md', '/project/existing.md')
      ).rejects.toMatchObject({
        message: 'A file with that name already exists',
        status: 409,
      });
    });
  });

  describe('Memory File Rename Validation', () => {
    beforeEach(() => {
      // Mock successful file existence checks - source exists, target doesn't
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        if (filePath.includes('CLAUDE.md') && !filePath.includes('memory-file') && !filePath.includes('settings.json') && !filePath.includes('invalid-name')) {
          // Source CLAUDE.md file exists
          return Promise.resolve({
            exists: true,
            isFile: true,
            isDirectory: false,
            size: 100,
            lastModified: new Date(),
          });
        } else {
          // Target files don't exist
          return Promise.resolve({
            exists: false,
            isFile: false,
            isDirectory: false,
            size: 0,
            lastModified: new Date(),
          });
        }
      });
      
      mockConsolidatedFileSystem.moveFile.mockResolvedValue();
    });

    it('should allow valid memory file rename', async () => {
      await expect(
        fileSystemService.renameFile('/project/CLAUDE.md', '/project/memory-file.md')
      ).resolves.toBeUndefined();

      expect(mockConsolidatedFileSystem.moveFile).toHaveBeenCalledWith(
        '/project/CLAUDE.md',
        '/project/memory-file.md',
        { createDirs: true, overwrite: false }
      );
    });

    it('should allow valid inactive memory file rename', async () => {
      await expect(
        fileSystemService.renameFile('/project/CLAUDE.md.inactive', '/project/memory-file.md.inactive')
      ).resolves.toBeUndefined();

      expect(mockConsolidatedFileSystem.moveFile).toHaveBeenCalledWith(
        '/project/CLAUDE.md.inactive',
        '/project/memory-file.md.inactive',
        { createDirs: true, overwrite: false }
      );
    });

    it('should reject memory file rename without .md extension', async () => {
      await expect(
        fileSystemService.renameFile('/project/CLAUDE.md', '/project/memory-file.txt')
      ).rejects.toMatchObject({
        message: 'Memory files must have a .md extension',
        status: 400,
      });
    });

    it('should reject changing file type from memory to settings', async () => {
      await expect(
        fileSystemService.renameFile('/project/CLAUDE.md', '/project/settings.json')
      ).rejects.toMatchObject({
        message: 'Memory files must have a .md extension',
        status: 400,
      });
    });

    it('should reject invalid configuration file name', async () => {
      await expect(
        fileSystemService.renameFile('/project/CLAUDE.md', '/project/invalid-name.xyz')
      ).rejects.toMatchObject({
        message: 'Memory files must have a .md extension',
        status: 400,
      });
    });
  });

  describe('Settings File Rename Validation', () => {
    beforeEach(() => {
      // Mock successful file existence checks - source exists, target doesn't
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        const fileName = filePath.split('/').pop() || '';
        if (fileName === 'settings.json' || fileName === 'settings.json.inactive') {
          // Source settings files exist
          return Promise.resolve({
            exists: true,
            isFile: true,
            isDirectory: false,
            size: 100,
            lastModified: new Date(),
          });
        } else {
          // Target files don't exist
          return Promise.resolve({
            exists: false,
            isFile: false,
            isDirectory: false,
            size: 0,
            lastModified: new Date(),
          });
        }
      });
      
      mockConsolidatedFileSystem.moveFile.mockResolvedValue();
    });

    it('should allow valid settings file rename', async () => {
      await expect(
        fileSystemService.renameFile('/project/settings.json', '/project/settings.local.json')
      ).resolves.toBeUndefined();
    });

    it('should allow valid inactive settings file rename', async () => {
      await expect(
        fileSystemService.renameFile('/project/settings.json.inactive', '/project/settings.local.json.inactive')
      ).resolves.toBeUndefined();
    });

    it('should reject invalid settings file rename', async () => {
      await expect(
        fileSystemService.renameFile('/project/settings.json', '/project/custom-settings.json')
      ).rejects.toMatchObject({
        message: 'Settings files must be named settings.json or settings.local.json',
        status: 400,
      });
    });

    it('should reject changing settings file to different type', async () => {
      await expect(
        fileSystemService.renameFile('/project/settings.json', '/project/memory.md')
      ).rejects.toMatchObject({
        message: 'Settings files must be named settings.json or settings.local.json',
        status: 400,
      });
    });
  });

  describe('Command File Rename Validation', () => {
    beforeEach(() => {
      // Mock successful file existence checks - source exists, target doesn't
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        if (filePath.includes('/commands/') && !filePath.includes('renamed-')) {
          // Source file exists
          return Promise.resolve({
            exists: true,
            isFile: true,
            isDirectory: false,
            size: 100,
            lastModified: new Date(),
          });
        } else {
          // Target file doesn't exist
          return Promise.resolve({
            exists: false,
            isFile: false,
            isDirectory: false,
            size: 0,
            lastModified: new Date(),
          });
        }
      });
      
      mockConsolidatedFileSystem.moveFile.mockResolvedValue();
    });

    it('should allow valid command file rename', async () => {
      await expect(
        fileSystemService.renameFile(
          '/project/.claude/commands/test-command.md',
          '/project/.claude/commands/renamed-command.md'
        )
      ).resolves.toBeUndefined();
    });

    it('should allow valid inactive command file rename', async () => {
      await expect(
        fileSystemService.renameFile(
          '/project/.claude/commands/test-command.md.inactive',
          '/project/.claude/commands/renamed-command.md.inactive'
        )
      ).resolves.toBeUndefined();
    });

    it('should reject command file rename outside commands directory', async () => {
      await expect(
        fileSystemService.renameFile(
          '/project/.claude/commands/test-command.md',
          '/project/not-a-command.md'
        )
      ).rejects.toMatchObject({
        message: 'Command files must remain in .claude/commands directory',
        status: 400,
      });
    });
  });

  describe('Non-Configuration File Rename', () => {
    beforeEach(() => {
      // Mock successful file existence checks - source exists, target doesn't
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        if (filePath.includes('regular-file.txt') || filePath.includes('source.md')) {
          // Source file exists
          return Promise.resolve({
            exists: true,
            isFile: true,
            isDirectory: false,
            size: 100,
            lastModified: new Date(),
          });
        } else {
          // Target file doesn't exist
          return Promise.resolve({
            exists: false,
            isFile: false,
            isDirectory: false,
            size: 0,
            lastModified: new Date(),
          });
        }
      });
      
      mockConsolidatedFileSystem.moveFile.mockResolvedValue();
    });

    it('should allow non-configuration file rename without special validation', async () => {
      await expect(
        fileSystemService.renameFile('/project/regular-file.txt', '/project/renamed-file.txt')
      ).resolves.toBeUndefined();

      expect(mockConsolidatedFileSystem.moveFile).toHaveBeenCalledWith(
        '/project/regular-file.txt',
        '/project/renamed-file.txt',
        { createDirs: true, overwrite: false }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle ConsolidatedFileSystem.moveFile errors', async () => {
      // Mock successful file existence checks
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        if (filePath.includes('source.md')) {
          return Promise.resolve({
            exists: true,
            isFile: true,
            isDirectory: false,
            size: 100,
            lastModified: new Date(),
          });
        } else {
          return Promise.resolve({
            exists: false,
            isFile: false,
            isDirectory: false,
            size: 0,
            lastModified: new Date(),
          });
        }
      });

      const moveError = new Error('File system error');
      mockConsolidatedFileSystem.moveFile.mockRejectedValue(moveError);

      await expect(
        fileSystemService.renameFile('/project/source.md', '/project/target.md')
      ).rejects.toMatchObject({
        message: 'Failed to rename file: File system error',
        status: 500,
      });
    });

    it('should handle file stats errors', async () => {
      const statsError = new Error('Cannot access file');
      mockConsolidatedFileSystem.getFileStats.mockRejectedValue(statsError);

      await expect(
        fileSystemService.renameFile('/project/source.md', '/project/target.md')
      ).rejects.toMatchObject({
        message: 'Failed to rename file: Cannot access file',
        status: 500,
      });
    });
  });
});