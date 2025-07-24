import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ImportService } from '../importService.js';
import { ConsolidatedFileSystem } from '@claude-config/core';
import type { ImportOptions } from '@claude-config/shared';
import yauzl from 'yauzl';

// Mock the dependencies
jest.mock('@claude-config/core', () => ({
  ConsolidatedFileSystem: {
    directoryExists: jest.fn(),
    fileExists: jest.fn(),
    getFileStats: jest.fn(),
    writeFile: jest.fn(),
    ensureDirectory: jest.fn(),
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

jest.mock('../fileSystemService.js', () => ({
  FileSystemService: {
    isConfigurationFile: jest.fn(),
  },
}));

jest.mock('yauzl', () => ({
  fromBuffer: jest.fn(),
}));

// Import mocks
import { ConfigurationServiceAPI } from '../configurationService.js';
import { FileSystemService } from '../fileSystemService.js';

const mockedFS = ConsolidatedFileSystem as jest.Mocked<typeof ConsolidatedFileSystem>;
const mockedConfigService = ConfigurationServiceAPI as jest.Mocked<typeof ConfigurationServiceAPI>;
const mockedFileSystemService = FileSystemService as jest.Mocked<typeof FileSystemService>;
const mockedYauzl = yauzl as jest.Mocked<typeof yauzl>;

describe('ImportService', () => {
  const testTargetPath = '/test/target';
  
  // Helper to mock file configuration checks
  const mockFileConfigChecks = () => {
    mockedFileSystemService.isConfigurationFile.mockImplementation((filename, filePath, isHomeContext) => {
      if (filename === 'CLAUDE.md') return { type: 'memory', valid: true };
      if (filename.endsWith('.md')) {
        // Check if it's in commands directory
        if (filePath && (filePath.includes('/.claude/commands/') || filePath.includes('\\.claude\\commands\\'))) {
          return { type: 'command', valid: true };
        }
        return { type: 'memory', valid: true };
      }
      if (filename === 'settings.json' || filename === 'settings.local.json') 
        return { type: 'settings', valid: true };
      if (filename === 'commands.json') return { type: 'command', valid: true };
      return { type: null, valid: false };
    });
  };
  
  const createMockZipFile = (entries: { fileName: string; content: string }[]) => {
    const mockZipFile: any = {
      readEntry: jest.fn(),
      on: jest.fn(),
      openReadStream: jest.fn(),
    };

    let entryIndex = 0;
    
    mockZipFile.readEntry.mockImplementation(() => {
      if (entryIndex < entries.length) {
        const entry = {
          fileName: entries[entryIndex].fileName,
        };
        entryIndex++;
        // Simulate async entry event
        setTimeout(() => {
          const handlers = mockZipFile.on.mock.calls.find(([event]: [string, Function]) => event === 'entry');
          if (handlers) {
            handlers[1](entry);
          }
        }, 0);
      } else {
        // Simulate end event
        setTimeout(() => {
          const handlers = mockZipFile.on.mock.calls.find(([event]: [string, Function]) => event === 'end');
          if (handlers) {
            handlers[1]();
          }
        }, 0);
      }
    });

    mockZipFile.openReadStream.mockImplementation((entry: any, callback: Function) => {
      const content = entries.find(e => e.fileName === entry.fileName)?.content || '';
      const mockStream = {
        on: jest.fn(),
      };

      // Simulate stream events
      setTimeout(() => {
        const dataHandler = mockStream.on.mock.calls.find(([event]: [string, Function]) => event === 'data');
        const endHandler = mockStream.on.mock.calls.find(([event]: [string, Function]) => event === 'end');
        
        if (dataHandler) {
          dataHandler[1](Buffer.from(content));
        }
        if (endHandler) {
          endHandler[1]();
        }
      }, 0);

      callback(null, mockStream);
    });

    return mockZipFile;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockedFS.directoryExists.mockResolvedValue(true);
    mockedFS.fileExists.mockResolvedValue(false);
    
    // Default mock for file configuration checks
    mockFileConfigChecks();
    mockedFS.ensureDirectory.mockResolvedValue(void 0);
    mockedFS.writeFile.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('previewImport', () => {
    const defaultOptions: ImportOptions = {
      overwriteConflicts: false,
      preserveDirectoryStructure: true,
      includeUserPath: false
    };

    it('should fail if target path does not exist', async () => {
      mockedFS.directoryExists.mockResolvedValue(false);

      const archiveBuffer = Buffer.from('mock-zip-data');
      const result = await ImportService.previewImport(archiveBuffer, testTargetPath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Target path not found');
      expect(result.totalFiles).toBe(0);
      expect(result.conflicts).toEqual([]);
    });

    it('should return error when no valid config files found in archive', async () => {
      const entries = [
        { fileName: 'README.md', content: 'Not a config file' },
        { fileName: 'package.json', content: '{}' }
      ];

      // Override the default mock for this test to ensure no valid config files
      mockedFileSystemService.isConfigurationFile.mockReturnValue({ type: null, valid: false });
      
      const mockZipFile = createMockZipFile(entries);
      mockedYauzl.fromBuffer.mockImplementation((buffer: Buffer, optionsOrCallback?: any, callback?: any) => {
        if (typeof optionsOrCallback === 'function') {
          // Two-parameter version: fromBuffer(buffer, callback)
          optionsOrCallback(null, mockZipFile);
        } else if (callback) {
          // Three-parameter version: fromBuffer(buffer, options, callback)
          callback(null, mockZipFile);
        } else {
          // No callback provided - shouldn't happen in normal usage
          throw new Error('No callback provided to yauzl.fromBuffer');
        }
      });

      mockedConfigService.getFileConfigurationType.mockReturnValue(null);

      const archiveBuffer = Buffer.from('mock-zip-data');
      const result = await ImportService.previewImport(archiveBuffer, testTargetPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid configuration files found in archive');
      expect(result.totalFiles).toBe(0);

      // Restore default mock
      mockFileConfigChecks();
    });

    it('should successfully preview valid config files from archive', async () => {
      const entries = [
        { fileName: 'CLAUDE.md', content: '# Claude configuration' },
        { fileName: 'settings.json', content: '{"key": "value"}' },
        { fileName: 'commands.json', content: '{"commands": []}' }
      ];
      
      const mockZipFile = createMockZipFile(entries);
      mockedYauzl.fromBuffer.mockImplementation((buffer: Buffer, optionsOrCallback?: any, callback?: any) => {
        if (typeof optionsOrCallback === 'function') {
          // Two-parameter version: fromBuffer(buffer, callback)
          optionsOrCallback(null, mockZipFile);
        } else if (callback) {
          // Three-parameter version: fromBuffer(buffer, options, callback)
          callback(null, mockZipFile);
        } else {
          // No callback provided - shouldn't happen in normal usage
          throw new Error('No callback provided to yauzl.fromBuffer');
        }
      });

      mockedConfigService.getFileConfigurationType.mockImplementation((filename) => {
        if (filename === 'CLAUDE.md') return { type: 'memory' };
        if (filename === 'settings.json') return { type: 'settings' };
        if (filename === 'commands.json') return { type: 'command' };
        return null;
      });

      const archiveBuffer = Buffer.from('mock-zip-data');
      const result = await ImportService.previewImport(archiveBuffer, testTargetPath);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(3);
      expect(result.conflicts).toEqual([]);
      expect(result.filesToImport).toHaveLength(3);
      expect(result.filesToImport[0].type).toBe('memory');
      expect(result.filesToImport[1].type).toBe('settings');
      expect(result.filesToImport[2].type).toBe('command');
    });

    it('should detect conflicts when files already exist', async () => {
      const entries = [
        { fileName: 'CLAUDE.md', content: '# Claude configuration' },
        { fileName: 'settings.json', content: '{"key": "value"}' }
      ];
      
      const mockZipFile = createMockZipFile(entries);
      mockedYauzl.fromBuffer.mockImplementation((buffer: Buffer, optionsOrCallback?: any, callback?: any) => {
        if (typeof optionsOrCallback === 'function') {
          // Two-parameter version: fromBuffer(buffer, callback)
          optionsOrCallback(null, mockZipFile);
        } else if (callback) {
          // Three-parameter version: fromBuffer(buffer, options, callback)
          callback(null, mockZipFile);
        } else {
          // No callback provided - shouldn't happen in normal usage
          throw new Error('No callback provided to yauzl.fromBuffer');
        }
      });

      mockedConfigService.getFileConfigurationType.mockImplementation((filename) => {
        if (filename === 'CLAUDE.md') return { type: 'memory' };
        if (filename === 'settings.json') return { type: 'settings' };
        return null;
      });

      // Mock existing files
      mockedFS.fileExists.mockImplementation(async (filepath: string) => {
        return filepath.includes('CLAUDE.md');
      });
      
      mockedFS.getFileStats.mockImplementation(async (filepath: string) => ({
        exists: true,
        isFile: true,
        isDirectory: false,
        size: 500,
        lastModified: new Date('2023-01-01'),
      }));

      const archiveBuffer = Buffer.from('mock-zip-data');
      const result = await ImportService.previewImport(archiveBuffer, testTargetPath);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(2);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].targetPath).toContain('CLAUDE.md');
      expect(result.conflicts[0].existingSize).toBe(500);
    });

    it('should handle inactive files correctly', async () => {
      const entries = [
        { fileName: 'CLAUDE.md.inactive', content: '# Inactive Claude config' },
        { fileName: 'settings.json', content: '{"key": "value"}' }
      ];
      
      const mockZipFile = createMockZipFile(entries);
      mockedYauzl.fromBuffer.mockImplementation((buffer: Buffer, optionsOrCallback?: any, callback?: any) => {
        if (typeof optionsOrCallback === 'function') {
          // Two-parameter version: fromBuffer(buffer, callback)
          optionsOrCallback(null, mockZipFile);
        } else if (callback) {
          // Three-parameter version: fromBuffer(buffer, options, callback)
          callback(null, mockZipFile);
        } else {
          // No callback provided - shouldn't happen in normal usage
          throw new Error('No callback provided to yauzl.fromBuffer');
        }
      });

      mockedConfigService.getFileConfigurationType.mockImplementation((filename) => {
        if (filename === 'CLAUDE.md') return { type: 'memory' };
        if (filename === 'settings.json') return { type: 'settings' };
        return null;
      });

      const archiveBuffer = Buffer.from('mock-zip-data');
      const result = await ImportService.previewImport(archiveBuffer, testTargetPath);

      expect(result.success).toBe(true);
      expect(result.totalFiles).toBe(2);
      expect(result.filesToImport[0].isInactive).toBe(true);
      expect(result.filesToImport[1].isInactive).toBe(false);
    });
  });

  describe('importProject', () => {
    const defaultOptions: ImportOptions = {
      overwriteConflicts: false,
      preserveDirectoryStructure: true,
      includeUserPath: false
    };

    it('should import files without conflicts successfully', async () => {
      const entries = [
        { fileName: 'CLAUDE.md', content: '# Claude configuration' },
        { fileName: 'settings.json', content: '{"key": "value"}' }
      ];
      
      const mockZipFile = createMockZipFile(entries);
      mockedYauzl.fromBuffer.mockImplementation((buffer: Buffer, optionsOrCallback?: any, callback?: any) => {
        if (typeof optionsOrCallback === 'function') {
          // Two-parameter version: fromBuffer(buffer, callback)
          optionsOrCallback(null, mockZipFile);
        } else if (callback) {
          // Three-parameter version: fromBuffer(buffer, options, callback)
          callback(null, mockZipFile);
        } else {
          // No callback provided - shouldn't happen in normal usage
          throw new Error('No callback provided to yauzl.fromBuffer');
        }
      });

      mockedConfigService.getFileConfigurationType.mockImplementation((filename) => {
        if (filename === 'CLAUDE.md') return { type: 'memory' };
        if (filename === 'settings.json') return { type: 'settings' };
        return null;
      });

      const archiveBuffer = Buffer.from('mock-zip-data');
      const result = await ImportService.importProject(archiveBuffer, testTargetPath, defaultOptions);

      expect(result.success).toBe(true);
      expect(result.filesImported).toBe(2);
      expect(result.filesSkipped).toBe(0);
      expect(result.conflicts).toEqual([]);
      expect(mockedFS.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should skip conflicting files when overwriteConflicts is false', async () => {
      const entries = [
        { fileName: 'CLAUDE.md', content: '# Claude configuration' },
        { fileName: 'settings.json', content: '{"key": "value"}' }
      ];
      
      const mockZipFile = createMockZipFile(entries);
      mockedYauzl.fromBuffer.mockImplementation((buffer: Buffer, optionsOrCallback?: any, callback?: any) => {
        if (typeof optionsOrCallback === 'function') {
          // Two-parameter version: fromBuffer(buffer, callback)
          optionsOrCallback(null, mockZipFile);
        } else if (callback) {
          // Three-parameter version: fromBuffer(buffer, options, callback)
          callback(null, mockZipFile);
        } else {
          // No callback provided - shouldn't happen in normal usage
          throw new Error('No callback provided to yauzl.fromBuffer');
        }
      });

      mockedConfigService.getFileConfigurationType.mockImplementation((filename) => {
        if (filename === 'CLAUDE.md') return { type: 'memory' };
        if (filename === 'settings.json') return { type: 'settings' };
        return null;
      });

      // Mock CLAUDE.md as existing file
      mockedFS.fileExists.mockImplementation(async (filepath: string) => {
        return filepath.includes('CLAUDE.md');
      });
      
      mockedFS.getFileStats.mockImplementation(async (filepath: string) => ({
        exists: true,
        isFile: true,
        isDirectory: false,
        size: 500,
        lastModified: new Date('2023-01-01'),
      }));

      const archiveBuffer = Buffer.from('mock-zip-data');
      const result = await ImportService.importProject(archiveBuffer, testTargetPath, defaultOptions);

      expect(result.success).toBe(true);
      expect(result.filesImported).toBe(1); // Only settings.json
      expect(result.filesSkipped).toBe(1); // CLAUDE.md skipped due to conflict
      expect(result.conflicts).toHaveLength(1);
      expect(mockedFS.writeFile).toHaveBeenCalledTimes(1);
    });

    it('should overwrite conflicting files when overwriteConflicts is true', async () => {
      const overwriteOptions: ImportOptions = {
        overwriteConflicts: true,
        preserveDirectoryStructure: true,
        includeUserPath: false
      };

      const entries = [
        { fileName: 'CLAUDE.md', content: '# Claude configuration' },
        { fileName: 'settings.json', content: '{"key": "value"}' }
      ];
      
      const mockZipFile = createMockZipFile(entries);
      mockedYauzl.fromBuffer.mockImplementation((buffer: Buffer, optionsOrCallback?: any, callback?: any) => {
        if (typeof optionsOrCallback === 'function') {
          // Two-parameter version: fromBuffer(buffer, callback)
          optionsOrCallback(null, mockZipFile);
        } else if (callback) {
          // Three-parameter version: fromBuffer(buffer, options, callback)
          callback(null, mockZipFile);
        } else {
          // No callback provided - shouldn't happen in normal usage
          throw new Error('No callback provided to yauzl.fromBuffer');
        }
      });

      mockedConfigService.getFileConfigurationType.mockImplementation((filename) => {
        if (filename === 'CLAUDE.md') return { type: 'memory' };
        if (filename === 'settings.json') return { type: 'settings' };
        return null;
      });

      // Mock CLAUDE.md as existing file
      mockedFS.fileExists.mockImplementation(async (filepath: string) => {
        return filepath.includes('CLAUDE.md');
      });
      
      mockedFS.getFileStats.mockImplementation(async (filepath: string) => ({
        exists: true,
        isFile: true,
        isDirectory: false,
        size: 500,
        lastModified: new Date('2023-01-01'),
      }));

      const archiveBuffer = Buffer.from('mock-zip-data');
      const result = await ImportService.importProject(archiveBuffer, testTargetPath, overwriteOptions);

      expect(result.success).toBe(true);
      expect(result.filesImported).toBe(2); // Both files imported
      expect(result.filesSkipped).toBe(0);
      expect(result.conflicts).toEqual([]); // No remaining conflicts since overwritten
      expect(mockedFS.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should import command files to user path when files have user/ prefix', async () => {
      // Use default mock for file configuration checks
      mockFileConfigChecks();
      
      const entries = [
        { fileName: 'project/CLAUDE.md', content: '# Project memory' },
        { fileName: 'user/.claude/CLAUDE.md', content: '# User memory' },
        { fileName: 'user/.claude/commands/my-command.md', content: '# My command' },
        { fileName: 'user/.claude/commands/namespace/nested-cmd.md', content: '# Nested command' }
      ];
      
      const mockZipFile = createMockZipFile(entries);
      mockedYauzl.fromBuffer.mockImplementation((buffer: Buffer, optionsOrCallback?: any, callback?: any) => {
        if (typeof optionsOrCallback === 'function') {
          optionsOrCallback(null, mockZipFile);
        } else if (callback) {
          callback(null, mockZipFile);
        }
      });

      const archiveBuffer = Buffer.from('mock-zip-data');
      const optionsWithUserPath = { ...defaultOptions, includeUserPath: true };
      
      // Track writeFile calls manually
      const writeFileCalls: any[] = [];
      mockedFS.writeFile.mockImplementation(async (filepath, content) => {
        writeFileCalls.push([filepath, content]);
        return null;
      });
      
      const result = await ImportService.importProject(archiveBuffer, testTargetPath, optionsWithUserPath);
      
      expect(result.success).toBe(true);
      expect(result.filesImported).toBe(4); // All 4 files imported
      expect(mockedFS.writeFile).toHaveBeenCalledTimes(4);
      
      // Check that user files were written to the correct paths
      const userClaudePath = path.join(os.homedir(), '.claude');
      
      // Normalize paths for cross-platform comparison
      const normalizedWriteCalls = writeFileCalls.map(([filepath, content]) => [
        path.normalize(filepath),
        content
      ]);
      
      // Verify user files were written to home directory
      expect(normalizedWriteCalls.some(([filepath]) => 
        filepath === path.normalize(path.join(userClaudePath, 'CLAUDE.md'))
      )).toBe(true);
      
      expect(normalizedWriteCalls.some(([filepath]) => 
        filepath === path.normalize(path.join(userClaudePath, 'commands', 'my-command.md'))
      )).toBe(true);
      
      expect(normalizedWriteCalls.some(([filepath]) => 
        filepath === path.normalize(path.join(userClaudePath, 'commands', 'namespace', 'nested-cmd.md'))
      )).toBe(true);
      
      // Verify project file was written to project path
      // On Windows, the path might be resolved to an absolute path with drive letter
      const expectedProjectFile = path.normalize(path.join(testTargetPath, 'CLAUDE.md'));
      expect(normalizedWriteCalls.some(([filepath]) => 
        filepath.endsWith(expectedProjectFile) || filepath === expectedProjectFile
      )).toBe(true);
    });
  });

  describe('getDefaultOptions', () => {
    it('should return valid default options', () => {
      const defaults = ImportService.getDefaultOptions();

      expect(defaults).toEqual({
        overwriteConflicts: false,
        preserveDirectoryStructure: true,
        includeUserPath: false
      });
    });
  });

  describe('validateOptions', () => {
    it('should fill in missing options with defaults', () => {
      const partial = { overwriteConflicts: true };
      const validated = ImportService.validateOptions(partial);

      expect(validated).toEqual({
        overwriteConflicts: true,
        preserveDirectoryStructure: true,
        includeUserPath: false,
        selectedFiles: undefined
      });
    });

    it('should preserve provided options', () => {
      const options = {
        overwriteConflicts: true,
        preserveDirectoryStructure: false,
        includeUserPath: true,
        selectedFiles: ['test.md']
      };
      const validated = ImportService.validateOptions(options);

      expect(validated).toEqual(options);
    });
  });
});