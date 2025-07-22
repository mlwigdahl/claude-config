import { FileSystemService } from '../fileSystemService.js';
import { ConsolidatedFileSystem } from '@claude-config/core';
import * as path from 'path';
import { jest } from '@jest/globals';

// Mock the ConsolidatedFileSystem
jest.mock('@claude-config/core', () => ({
  ConsolidatedFileSystem: {
    getFileStats: jest.fn(),
    listDirectory: jest.fn(),
    readFile: jest.fn(),
  },
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }))
}));

describe('FileSystemService - Command File Identification', () => {
  let fileSystemService: FileSystemService;
  const mockConsolidatedFileSystem = ConsolidatedFileSystem as jest.Mocked<typeof ConsolidatedFileSystem>;

  beforeEach(() => {
    fileSystemService = new FileSystemService();
    jest.clearAllMocks();
  });

  describe('isCommandFile', () => {
    it('should identify .md files in .claude/commands as command files', () => {
      const commandPaths = [
        '/Users/test/project/.claude/commands/test.md',
        '/Users/test/project/.claude/commands/subfolder/nested.md',
        '/Users/test/project/.claude/commands/deep/nested/path/command.md',
        '/Users/test/.claude/commands/global.md',
      ];

      commandPaths.forEach(commandPath => {
        expect(FileSystemService.isCommandFile(commandPath)).toBe(true);
      });
    });

    it('should not identify .md files outside .claude/commands as command files', () => {
      const nonCommandPaths = [
        '/Users/test/project/README.md',
        '/Users/test/project/docs/guide.md',
        '/Users/test/project/.claude/README.md',
        '/Users/test/project/.claude/settings/config.md',
        '/Users/test/project/src/file.md',
        '/Users/test/project/.claude/commands.md', // Not in commands directory
      ];

      nonCommandPaths.forEach(nonCommandPath => {
        expect(FileSystemService.isCommandFile(nonCommandPath)).toBe(false);
      });
    });

    it('should not identify non-.md files as command files', () => {
      const nonMdPaths = [
        '/Users/test/project/.claude/commands/test.txt',
        '/Users/test/project/.claude/commands/config.json',
        '/Users/test/project/.claude/commands/script.js',
      ];

      nonMdPaths.forEach(nonMdPath => {
        expect(FileSystemService.isCommandFile(nonMdPath)).toBe(false);
      });
    });

    it('should not identify CLAUDE.md as command file even in commands directory', () => {
      const claudeMdPaths = [
        '/Users/test/project/.claude/commands/CLAUDE.md',
        '/Users/test/project/.claude/commands/subfolder/CLAUDE.md',
      ];

      claudeMdPaths.forEach(claudeMdPath => {
        expect(FileSystemService.isCommandFile(claudeMdPath)).toBe(false);
      });
    });
  });

  describe('isConfigurationFile with command file detection', () => {
    it('should identify command files correctly', () => {
      const commandFiles = [
        { name: 'test.md', path: '/Users/test/project/.claude/commands/test.md' },
        { name: 'nested.md', path: '/Users/test/project/.claude/commands/subfolder/nested.md' },
      ];

      commandFiles.forEach(({ name, path }) => {
        const result = FileSystemService.isConfigurationFile(name, path);
        expect(result.valid).toBe(true);
        expect(result.type).toBe('command');
      });
    });

    it('should identify regular .md files as nonstandard memory files', () => {
      const regularMdFiles = [
        { name: 'README.md', path: '/Users/test/project/README.md' },
        { name: 'guide.md', path: '/Users/test/project/docs/guide.md' },
        { name: 'config.md', path: '/Users/test/project/.claude/config.md' },
      ];

      regularMdFiles.forEach(({ name, path }) => {
        const result = FileSystemService.isConfigurationFile(name, path);
        expect(result.valid).toBe(true);
        expect(result.type).toBe('memory');
      });
    });

    it('should still identify CLAUDE.md as memory file', () => {
      const claudeMdFiles = [
        { name: 'CLAUDE.md', path: '/Users/test/project/CLAUDE.md' },
        { name: 'CLAUDE.md', path: '/Users/test/project/.claude/CLAUDE.md' },
        { name: 'CLAUDE.md', path: '/Users/test/project/.claude/commands/CLAUDE.md' },
      ];

      claudeMdFiles.forEach(({ name, path }) => {
        const result = FileSystemService.isConfigurationFile(name, path);
        expect(result.valid).toBe(true);
        expect(result.type).toBe('memory');
      });
    });

    it('should still identify settings files correctly', () => {
      const settingsFiles = [
        { name: 'settings.json', path: '/Users/test/project/.claude/settings.json' },
        { name: 'settings.local.json', path: '/Users/test/project/.claude/settings.local.json' },
      ];

      settingsFiles.forEach(({ name, path }) => {
        const result = FileSystemService.isConfigurationFile(name, path);
        expect(result.valid).toBe(true);
        expect(result.type).toBe('settings');
      });
    });
  });

  describe('.claude directory scanning', () => {
    const projectRoot = '/Users/test/project';
    const rootPath = '/Users';

    beforeEach(() => {
      // Mock file system structure for .claude directory
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        const fileMap = {
          '/Users/test/project': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/project/.claude': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/project/.claude/settings.json': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/project/.claude/settings.local.json': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/project/.claude/README.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/project/.claude/commands': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/project/.claude/commands/test.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/project/.claude/commands/help.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/project/.claude/commands/nested': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/project/.claude/commands/nested/deep.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/project/.claude/other-dir': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/project/.claude/other-dir/file.txt': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/project/CLAUDE.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/project/README.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test': { isDirectory: true, isFile: false, exists: true },
        };

        const info = fileMap[filePath as keyof typeof fileMap];
        if (info) {
          return Promise.resolve({
            exists: info.exists,
            isDirectory: info.isDirectory,
            isFile: info.isFile,
            size: info.isDirectory ? 1024 : 512,
            lastModified: new Date('2023-01-01T00:00:00Z')
          });
        }
        return Promise.resolve({ exists: false, isDirectory: false, isFile: false, size: 0, lastModified: new Date() });
      });

      // Mock directory listings
      mockConsolidatedFileSystem.listDirectory.mockImplementation((dirPath: string) => {
        const directoryMap = {
          '/Users/test/project': ['CLAUDE.md', 'README.md', '.claude', 'src'],
          '/Users/test/project/.claude': ['settings.json', 'settings.local.json', 'README.md', 'commands', 'other-dir'],
          '/Users/test/project/.claude/commands': ['test.md', 'help.md', 'nested'],
          '/Users/test/project/.claude/commands/nested': ['deep.md'],
          '/Users/test/project/.claude/other-dir': ['file.txt'],
          '/Users/test': ['project'],
        };

        const files = directoryMap[dirPath as keyof typeof directoryMap];
        return Promise.resolve(files || []);
      });

      // Mock empty gitignore
      mockConsolidatedFileSystem.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith('.gitignore')) {
          return Promise.resolve('');
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should include direct files in .claude directory only if they are config files', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Navigate to project root then .claude directory
      const projectNode = result.tree.children?.find(c => c.name === 'project');
      expect(projectNode).toBeDefined();
      
      const claudeNode = projectNode?.children?.find(c => c.name === '.claude');
      expect(claudeNode).toBeDefined();
      expect(claudeNode?.type).toBe('directory');
      
      // Check direct files in .claude directory
      const directFiles = claudeNode?.children?.filter(c => c.type === 'file') || [];
      const directFileNames = directFiles.map(f => f.name);
      
      // Should include settings files
      expect(directFileNames).toContain('settings.json');
      expect(directFileNames).toContain('settings.local.json');
      
      // Should include .md files like README.md as nonstandard memory files
      expect(directFileNames).toContain('README.md');
    });

    it('should include commands directory with all .md files at any depth', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Navigate to project root then .claude/commands directory
      const projectNode = result.tree.children?.find(c => c.name === 'project');
      expect(projectNode).toBeDefined();
      
      const claudeNode = projectNode?.children?.find(c => c.name === '.claude');
      const commandsNode = claudeNode?.children?.find(c => c.name === 'commands');
      expect(commandsNode).toBeDefined();
      expect(commandsNode?.type).toBe('directory');
      
      // Check command files at root level
      const commandFiles = commandsNode?.children?.filter(c => c.type === 'file') || [];
      const commandFileNames = commandFiles.map(f => f.name);
      
      expect(commandFileNames).toContain('test.md');
      expect(commandFileNames).toContain('help.md');
      
      // Check nested directory
      const nestedNode = commandsNode?.children?.find(c => c.name === 'nested');
      expect(nestedNode).toBeDefined();
      expect(nestedNode?.type).toBe('directory');
      
      // Check nested command file
      const nestedFiles = nestedNode?.children?.filter(c => c.type === 'file') || [];
      const nestedFileNames = nestedFiles.map(f => f.name);
      
      expect(nestedFileNames).toContain('deep.md');
    });

    it('should not include non-commands subdirectories in .claude directory', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Navigate to project root then .claude directory
      const projectNode = result.tree.children?.find(c => c.name === 'project');
      expect(projectNode).toBeDefined();
      
      const claudeNode = projectNode?.children?.find(c => c.name === '.claude');
      expect(claudeNode).toBeDefined();
      
      // Check that other-dir is not included at all
      const otherDirNode = claudeNode?.children?.find(c => c.name === 'other-dir');
      expect(otherDirNode).toBeUndefined();
      
      // Only commands directory should be present among subdirectories
      const subdirectories = claudeNode?.children?.filter(c => c.type === 'directory') || [];
      expect(subdirectories).toHaveLength(1);
      expect(subdirectories[0].name).toBe('commands');
    });

    it('should correctly count configuration files in .claude directory', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Should count settings files and command files
      expect(result.configurationFiles.settings).toBeGreaterThan(0); // settings.json files
      expect(result.configurationFiles.command).toBeGreaterThan(0); // .md files in commands
      expect(result.configurationFiles.memory).toBeGreaterThan(0); // CLAUDE.md files
    });
  });
});