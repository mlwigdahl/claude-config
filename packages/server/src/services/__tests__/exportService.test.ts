import * as fs from 'fs/promises';
import * as path from 'path';
import { ExportService } from '../exportService.js';
import { ConsolidatedFileSystem } from '@claude-config/core';
import type { ExportOptions } from '@claude-config/shared';

// Mock the dependencies
jest.mock('@claude-config/core', () => ({
  ConsolidatedFileSystem: {
    directoryExists: jest.fn(),
    listDirectory: jest.fn(),
    getFileStats: jest.fn(),
    readFile: jest.fn(),
    fileExists: jest.fn(),
  },
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('../configurationService.js', () => ({
  ConfigurationServiceAPI: {
    getFileConfigurationType: jest.fn(),
  },
}));

jest.mock('archiver', () => {
  const mockArchiver = {
    on: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    finalize: jest.fn().mockReturnThis(),
  };

  return jest.fn(() => mockArchiver);
});

// Import mocks
import { ConfigurationServiceAPI } from '../configurationService.js';
import archiver from 'archiver';

const mockedFS = ConsolidatedFileSystem as jest.Mocked<typeof ConsolidatedFileSystem>;
const mockedConfigService = ConfigurationServiceAPI as jest.Mocked<typeof ConfigurationServiceAPI>;
const mockedArchiver = archiver as jest.MockedFunction<typeof archiver>;

describe('ExportService', () => {
  const testProjectPath = '/test/project';
  
  const createMockArchiver = () => {
    const mockArchiverInstance: any = {
      on: jest.fn(),
      append: jest.fn(),
      finalize: jest.fn(),
    };
    
    // Set up the implementation after the object is created to avoid circular reference
    mockArchiverInstance.on.mockImplementation((event: string, callback: Function) => {
      if (event === 'data') {
        // Simulate data chunks
        setTimeout(() => callback(Buffer.from('mock-zip-data')), 0);
      } else if (event === 'end') {
        // Simulate archive completion
        setTimeout(() => callback(), 0);
      }
      return mockArchiverInstance;
    });
    
    mockArchiverInstance.append.mockReturnValue(mockArchiverInstance);
    mockArchiverInstance.finalize.mockReturnValue(mockArchiverInstance);
    
    mockedArchiver.mockReturnValue(mockArchiverInstance);
    return mockArchiverInstance;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default fileExists mock - return false for .gitignore files
    mockedFS.fileExists.mockResolvedValue(false);
    
    // Default readFile mock
    mockedFS.readFile.mockImplementation(async (filepath: string) => {
      const filename = path.basename(filepath);
      return `Mock content for ${filename}`;
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('exportProject', () => {
    const defaultOptions: ExportOptions = {
      memoryFiles: 'all',
      settingsFiles: 'both', 
      commandFiles: true,
      includeInactive: false,
      recursive: true,
      format: 'zip',
      includeUserPath: false
    };

    it('should fail if project path does not exist', async () => {
      mockedFS.directoryExists.mockResolvedValue(false);

      const result = await ExportService.exportProject(testProjectPath, defaultOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Project path not found');
      expect(result.fileCount).toBe(0);
    });

    it('should return error when no files match criteria', async () => {
      mockedFS.directoryExists.mockResolvedValue(true);
      mockedFS.listDirectory.mockResolvedValue([]);
      // Realpath not used in ConsolidatedFileSystem

      const result = await ExportService.exportProject(testProjectPath, defaultOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No files found matching export criteria');
      expect(result.fileCount).toBe(0);
    });

    it('should successfully export matching files', async () => {
      // Setup mocks
      mockedFS.directoryExists.mockResolvedValue(true);
      mockedFS.listDirectory.mockResolvedValue(['CLAUDE.md', 'settings.json', 'commands.json']);
      // Realpath not used in ConsolidatedFileSystem
      mockedFS.getFileStats.mockImplementation(async (filepath: string) => ({
        exists: true,
        isFile: true,
        isDirectory: false,
        size: 100,
        lastModified: new Date(),
      }));
      
      mockedConfigService.getFileConfigurationType.mockImplementation((filename) => {
        if (filename === 'CLAUDE.md') return { type: 'memory' };
        if (filename === 'settings.json') return { type: 'settings' };
        if (filename === 'commands.json') return { type: 'command' };
        return null;
      });

      // Mock archiver
      createMockArchiver();

      const result = await ExportService.exportProject(testProjectPath, defaultOptions);

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(3);
      expect(result.filename).toMatch(/project-export-\d+T\d+\.zip/);
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('should filter files based on memory file options', async () => {
      const claudeOnlyOptions: ExportOptions = {
        ...defaultOptions,
        memoryFiles: 'claude-only'
      };

      mockedFS.directoryExists.mockResolvedValue(true);
      mockedFS.listDirectory.mockResolvedValue(['CLAUDE.md', 'other.md', 'settings.json']);
      // Realpath not used in ConsolidatedFileSystem
      mockedFS.getFileStats.mockImplementation(async (filepath: string) => ({
        exists: true,
        isFile: true,
        isDirectory: false,
        size: 100,
        lastModified: new Date(),
      }));
      
      mockedConfigService.getFileConfigurationType.mockImplementation((filename) => {
        if (filename.endsWith('.md')) return { type: 'memory' };
        if (filename === 'settings.json') return { type: 'settings' };
        return null;
      });

      // Mock archiver
      createMockArchiver();

      const result = await ExportService.exportProject(testProjectPath, claudeOnlyOptions);

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(2); // Only CLAUDE.md and settings.json
    });

    it('should skip inactive files when not requested', async () => {
      mockedFS.directoryExists.mockResolvedValue(true);
      mockedFS.listDirectory.mockResolvedValue(['CLAUDE.md', 'CLAUDE.md.inactive', 'settings.json']);
      // Realpath not used in ConsolidatedFileSystem
      mockedFS.getFileStats.mockImplementation(async (filepath: string) => ({
        exists: true,
        isFile: true,
        isDirectory: false,
        size: 100,
        lastModified: new Date(),
      }));
      
      mockedConfigService.getFileConfigurationType.mockImplementation((filename) => {
        if (filename === 'CLAUDE.md') return { type: 'memory' };
        if (filename === 'settings.json') return { type: 'settings' };
        return null;
      });

      // Mock archiver
      createMockArchiver();

      const result = await ExportService.exportProject(testProjectPath, defaultOptions);

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(2); // Should exclude .inactive file
    });

    it('should include inactive files when requested', async () => {
      const includeInactiveOptions: ExportOptions = {
        ...defaultOptions,
        includeInactive: true
      };

      mockedFS.directoryExists.mockResolvedValue(true);
      mockedFS.listDirectory.mockResolvedValue(['CLAUDE.md', 'CLAUDE.md.inactive', 'settings.json']);
      // Realpath not used in ConsolidatedFileSystem
      mockedFS.getFileStats.mockImplementation(async (filepath: string) => ({
        exists: true,
        isFile: true,
        isDirectory: false,
        size: 100,
        lastModified: new Date(),
      }));
      
      mockedConfigService.getFileConfigurationType.mockImplementation((filename) => {
        if (filename === 'CLAUDE.md') return { type: 'memory' };
        if (filename === 'settings.json') return { type: 'settings' };
        return null;
      });

      // Mock archiver
      createMockArchiver();

      const result = await ExportService.exportProject(testProjectPath, includeInactiveOptions);

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(3); // Should include .inactive file
    });
  });

  describe('getDefaultOptions', () => {
    it('should return valid default options', () => {
      const defaults = ExportService.getDefaultOptions();

      expect(defaults).toEqual({
        memoryFiles: 'all',
        settingsFiles: 'both',
        commandFiles: true,
        includeInactive: false,
        recursive: true,
        format: 'zip',
        includeUserPath: false
      });
    });
  });

  describe('validateOptions', () => {
    it('should fill in missing options with defaults', () => {
      const partial = { memoryFiles: 'claude-only' as const };
      const validated = ExportService.validateOptions(partial);

      expect(validated).toEqual({
        memoryFiles: 'claude-only',
        settingsFiles: 'both',
        commandFiles: true,
        includeInactive: false,
        recursive: true,
        format: 'zip',
        includeUserPath: false,
        selectedFiles: undefined
      });
    });

    it('should preserve provided options', () => {
      const options = {
        memoryFiles: 'none' as const,
        settingsFiles: 'project-only' as const,
        commandFiles: false,
        includeInactive: true,
        recursive: false,
        format: 'zip' as const,
        includeUserPath: true,
        selectedFiles: ['test.md']
      };
      const validated = ExportService.validateOptions(options);

      expect(validated).toEqual(options);
    });
  });
});