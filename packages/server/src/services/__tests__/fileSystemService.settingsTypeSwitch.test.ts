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
    info: jest.fn(),
    error: jest.fn(),
  })),
}));

const mockConsolidatedFileSystem = ConsolidatedFileSystem as jest.Mocked<typeof ConsolidatedFileSystem>;
const mockCreateError = createError as jest.MockedFunction<typeof createError>;

describe('FileSystemService - Settings Type Switching', () => {
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
    it('should reject if source file does not exist', async () => {
      mockConsolidatedFileSystem.getFileStats.mockResolvedValue({
        exists: false,
        isFile: false,
        isDirectory: false,
        size: 0,
        lastModified: new Date(),
      });

      await expect(
        fileSystemService.switchSettingsFileType('/project/settings.json')
      ).rejects.toMatchObject({
        message: 'Source file not found',
        status: 404,
      });
    });

    it('should reject if source is not a file', async () => {
      mockConsolidatedFileSystem.getFileStats.mockResolvedValue({
        exists: true,
        isFile: false,
        isDirectory: true,
        size: 0,
        lastModified: new Date(),
      });

      await expect(
        fileSystemService.switchSettingsFileType('/project/settings.json')
      ).rejects.toMatchObject({
        message: 'Source path is not a file',
        status: 400,
      });
    });

    it('should reject non-settings files', async () => {
      mockConsolidatedFileSystem.getFileStats.mockResolvedValue({
        exists: true,
        isFile: true,
        isDirectory: false,
        size: 100,
        lastModified: new Date(),
      });

      await expect(
        fileSystemService.switchSettingsFileType('/project/CLAUDE.md')
      ).rejects.toMatchObject({
        message: 'Only settings files can have their type switched',
        status: 400,
      });
    });
  });

  describe('Project to Local Switching', () => {
    beforeEach(() => {
      // Mock source file exists, target doesn't
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        if (filePath.includes('settings.json') && !filePath.includes('settings.local.json')) {
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
      
      mockConsolidatedFileSystem.moveFile.mockResolvedValue();
    });

    it('should switch from project to local settings', async () => {
      const result = await fileSystemService.switchSettingsFileType('/project/settings.json');

      expect(result).toEqual({
        newPath: '/project/settings.local.json',
        newType: 'local',
      });

      expect(mockConsolidatedFileSystem.moveFile).toHaveBeenCalledWith(
        '/project/settings.json',
        '/project/settings.local.json',
        { createDirs: true, overwrite: false }
      );
    });

    it('should switch inactive project to inactive local settings', async () => {
      const result = await fileSystemService.switchSettingsFileType('/project/settings.json.inactive');

      expect(result).toEqual({
        newPath: '/project/settings.local.json.inactive',
        newType: 'local',
      });

      expect(mockConsolidatedFileSystem.moveFile).toHaveBeenCalledWith(
        '/project/settings.json.inactive',
        '/project/settings.local.json.inactive',
        { createDirs: true, overwrite: false }
      );
    });
  });

  describe('Local to Project Switching', () => {
    beforeEach(() => {
      // Mock source file exists, target doesn't
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        if (filePath.includes('settings.local.json')) {
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
      
      mockConsolidatedFileSystem.moveFile.mockResolvedValue();
    });

    it('should switch from local to project settings', async () => {
      const result = await fileSystemService.switchSettingsFileType('/project/settings.local.json');

      expect(result).toEqual({
        newPath: '/project/settings.json',
        newType: 'project',
      });

      expect(mockConsolidatedFileSystem.moveFile).toHaveBeenCalledWith(
        '/project/settings.local.json',
        '/project/settings.json',
        { createDirs: true, overwrite: false }
      );
    });

    it('should switch inactive local to inactive project settings', async () => {
      const result = await fileSystemService.switchSettingsFileType('/project/settings.local.json.inactive');

      expect(result).toEqual({
        newPath: '/project/settings.json.inactive',
        newType: 'project',
      });

      expect(mockConsolidatedFileSystem.moveFile).toHaveBeenCalledWith(
        '/project/settings.local.json.inactive',
        '/project/settings.json.inactive',
        { createDirs: true, overwrite: false }
      );
    });
  });

  describe('Conflict Prevention', () => {
    it('should reject switch if target project file already exists', async () => {
      // Source local file exists, target project file also exists
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        return Promise.resolve({
          exists: true,
          isFile: true,
          isDirectory: false,
          size: 100,
          lastModified: new Date(),
        });
      });

      await expect(
        fileSystemService.switchSettingsFileType('/project/settings.local.json')
      ).rejects.toMatchObject({
        message: 'Cannot switch type: project settings file already exists',
        status: 409,
      });
    });

    it('should reject switch if target local file already exists', async () => {
      // Source project file exists, target local file also exists
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        return Promise.resolve({
          exists: true,
          isFile: true,
          isDirectory: false,
          size: 100,
          lastModified: new Date(),
        });
      });

      await expect(
        fileSystemService.switchSettingsFileType('/project/settings.json')
      ).rejects.toMatchObject({
        message: 'Cannot switch type: local settings file already exists',
        status: 409,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle ConsolidatedFileSystem.moveFile errors', async () => {
      // Mock successful file existence checks
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        if (filePath.includes('settings.json') && !filePath.includes('settings.local.json')) {
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
        fileSystemService.switchSettingsFileType('/project/settings.json')
      ).rejects.toMatchObject({
        message: 'Failed to switch settings file type: File system error',
        status: 500,
      });
    });

    it('should handle file stats errors', async () => {
      const statsError = new Error('Cannot access file');
      mockConsolidatedFileSystem.getFileStats.mockRejectedValue(statsError);

      await expect(
        fileSystemService.switchSettingsFileType('/project/settings.json')
      ).rejects.toMatchObject({
        message: 'Failed to switch settings file type: Cannot access file',
        status: 500,
      });
    });
  });
});