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
    writeFile: jest.fn(),
    createDirectory: jest.fn(),
  },
  getLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }))
}));

describe('FileSystemService - File Filtering', () => {
  let fileSystemService: FileSystemService;
  const mockConsolidatedFileSystem = ConsolidatedFileSystem as jest.Mocked<typeof ConsolidatedFileSystem>;

  beforeEach(() => {
    fileSystemService = new FileSystemService();
    jest.clearAllMocks();
  });

  describe('isConfigurationFile', () => {
    it('should identify CLAUDE.md as memory file', () => {
      const result = FileSystemService.isConfigurationFile('CLAUDE.md');
      expect(result).toEqual({ type: 'memory', valid: true });
    });

    it('should identify settings.json as settings file', () => {
      const result = FileSystemService.isConfigurationFile('settings.json');
      expect(result).toEqual({ type: 'settings', valid: true });
    });

    it('should identify settings.local.json as settings file', () => {
      const result = FileSystemService.isConfigurationFile('settings.local.json');
      expect(result).toEqual({ type: 'settings', valid: true });
    });

    it('should identify .md files in .claude/commands as command files', () => {
      const result = FileSystemService.isConfigurationFile('my-command.md', '/Users/test/.claude/commands/my-command.md');
      expect(result).toEqual({ type: 'command', valid: true });
    });

    it('should identify .md files outside .claude/commands as nonstandard memory files', () => {
      const result = FileSystemService.isConfigurationFile('my-command.md', '/Users/test/project/my-command.md');
      expect(result).toEqual({ type: 'memory', valid: true });
    });

    it('should not identify other .json files as configuration files', () => {
      const result = FileSystemService.isConfigurationFile('package.json');
      expect(result).toEqual({ type: null, valid: false });
    });

    it('should not identify other file types as configuration files', () => {
      const testCases = [
        'index.js',
        'style.css',
        'image.png',
        'data.txt',
        'package.json', // Should not be a settings file
        'config.yaml',
      ];

      testCases.forEach(fileName => {
        const result = FileSystemService.isConfigurationFile(fileName);
        expect(result).toEqual({ type: null, valid: false });
      });
    });

    it('should identify README.md correctly based on location', () => {
      const readmeInCommands = FileSystemService.isConfigurationFile('README.md', '/Users/test/.claude/commands/README.md');
      expect(readmeInCommands).toEqual({ type: 'command', valid: true });
      
      const readmeElsewhere = FileSystemService.isConfigurationFile('README.md', '/Users/test/project/README.md');
      expect(readmeElsewhere).toEqual({ type: 'memory', valid: true });
      
      const claudeResult = FileSystemService.isConfigurationFile('CLAUDE.md');
      expect(claudeResult).toEqual({ type: 'memory', valid: true });
    });
  });

  describe('listProjectFiles', () => {
    const projectRoot = '/Users/test/my-project';
    const rootPath = '/Users';

    beforeEach(() => {
      // Mock file system structure
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        const isDirectory = 
          filePath.endsWith('/Users') ||
          filePath.endsWith('/Users/test') ||
          filePath.endsWith('/Users/test/my-project') ||
          filePath.endsWith('/Users/test/my-project/src') ||
          filePath.endsWith('/Users/test/my-project/docs') ||
          filePath.endsWith('/Users/test/my-project/.claude') ||
          filePath.endsWith('/Users/test/my-project/.claude/commands') ||
          filePath.endsWith('/Users/test/my-project/.git') ||
          filePath.includes('directory');
        
        const stats = {
          exists: true,
          isDirectory,
          isFile: !isDirectory,
          size: isDirectory ? 1024 : 512,
          lastModified: new Date('2023-01-01T00:00:00Z')
        };
        return Promise.resolve(stats);
      });

      mockConsolidatedFileSystem.listDirectory.mockImplementation((dirPath: string) => {
        // Mock directory contents based on path
        if (dirPath === '/Users') {
          return Promise.resolve(['test', 'other-user']);
        } else if (dirPath === '/Users/test') {
          return Promise.resolve(['my-project', 'other-project', 'CLAUDE.md', 'settings.json', 'random-file.txt']);
        } else if (dirPath === '/Users/test/my-project') {
          return Promise.resolve([
            'CLAUDE.md',
            'settings.json',
            'settings.local.json',
            'src',
            'docs',
            'package.json',
            'README.md',
            'config.yaml',
            'important-command.md',
            '.git',
            '.claude'
          ]);
        } else if (dirPath === '/Users/test/my-project/src') {
          return Promise.resolve(['index.js', 'utils.js', 'component.tsx']);
        } else if (dirPath === '/Users/test/my-project/.claude') {
          return Promise.resolve(['commands', 'settings.json']);
        } else if (dirPath === '/Users/test/my-project/.claude/commands') {
          return Promise.resolve(['git-commit.md', 'deploy.md', 'test-command.md']);
        } else if (dirPath === '/Users/test/my-project/docs') {
          return Promise.resolve(['installation.md', 'usage.md', 'CLAUDE.md']);
        }
        return Promise.resolve([]);
      });
    });

    it('should filter to only show configuration files and directories', async () => {
      const result = await fileSystemService.listProjectFiles(projectRoot, rootPath);
      
      // Should include configuration files only
      const fileNames = result.files.map(f => f.name);
      expect(fileNames).toContain('CLAUDE.md');
      expect(fileNames).toContain('settings.json');
      expect(fileNames).toContain('settings.local.json');
      
      // Should include command files from .claude/commands
      expect(fileNames).toContain('git-commit.md');
      expect(fileNames).toContain('deploy.md');
      expect(fileNames).toContain('test-command.md');
      
      // Should include .md files outside .claude/commands as nonstandard memory files
      expect(fileNames).toContain('README.md');
      expect(fileNames).toContain('important-command.md');
      
      // Should not include other files
      expect(fileNames).not.toContain('package.json');
      expect(fileNames).not.toContain('config.yaml');
      expect(fileNames).not.toContain('index.js');
    });

    it('should include all directories under project root', async () => {
      const result = await fileSystemService.listProjectFiles(projectRoot, rootPath);
      
      const directoryNames = result.directories.map(d => d.name);
      expect(directoryNames).toContain('src');
      expect(directoryNames).toContain('docs');
      expect(directoryNames).toContain('.claude');
      expect(directoryNames).toContain('.git'); // Should include hidden directories
    });

    it('should include parent directories up to one level below root', async () => {
      const result = await fileSystemService.listProjectFiles(projectRoot, rootPath);
      
      // Should include parent directories
      const parentDirs = result.parentDirectories.map(d => d.name);
      expect(parentDirs).toContain('test'); // /Users/test
      expect(parentDirs).not.toContain('Users'); // Should not include root level
    });

    it('should include configuration files from parent directories', async () => {
      const result = await fileSystemService.listProjectFiles(projectRoot, rootPath);
      
      // Should find CLAUDE.md and settings.json in parent directory
      const parentFiles = result.parentFiles.map(f => f.name);
      expect(parentFiles).toContain('CLAUDE.md');
      expect(parentFiles).toContain('settings.json');
      expect(parentFiles).not.toContain('random-file.txt');
    });

    it('should include configuration files from subdirectories', async () => {
      const result = await fileSystemService.listProjectFiles(projectRoot, rootPath);
      
      // Should find command files in .claude/commands
      const commandFiles = result.files.filter(f => f.path.includes('.claude/commands'));
      expect(commandFiles).toHaveLength(3);
      expect(commandFiles.map(f => f.name)).toContain('git-commit.md');
      expect(commandFiles.map(f => f.name)).toContain('deploy.md');
      expect(commandFiles.map(f => f.name)).toContain('test-command.md');
      
      // Should find only CLAUDE.md in docs subdirectory (other .md files are not in .claude/commands)
      const docsFiles = result.files.filter(f => f.path.includes('docs'));
      expect(docsFiles.map(f => f.name)).toContain('CLAUDE.md');
      expect(docsFiles.map(f => f.name)).toContain('installation.md');
      expect(docsFiles.map(f => f.name)).toContain('usage.md');
    });

    it('should handle non-existent project directory gracefully', async () => {
      mockConsolidatedFileSystem.getFileStats.mockResolvedValueOnce({
        exists: false,
        isDirectory: false,
        size: 0,
        lastModified: new Date()
      });

      await expect(fileSystemService.listProjectFiles('/non/existent/path', rootPath))
        .rejects.toThrow('Project directory not found');
    });

    it('should handle non-directory project path gracefully', async () => {
      mockConsolidatedFileSystem.getFileStats.mockResolvedValueOnce({
        exists: true,
        isDirectory: false,
        size: 1024,
        lastModified: new Date()
      });

      await expect(fileSystemService.listProjectFiles('/Users/test/file.txt', rootPath))
        .rejects.toThrow('Project path is not a directory');
    });
  });

  describe('buildFilteredFileTree', () => {
    const projectRoot = '/Users/test/my-project';
    const rootPath = '/Users';

    beforeEach(() => {
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        const isDirectory = 
          filePath.endsWith('/Users/test/my-project') ||
          filePath.endsWith('/Users/test/my-project/src') ||
          filePath.endsWith('/Users/test/my-project/src/utils') ||
          filePath.includes('directory');
        
        const stats = {
          exists: true,
          isDirectory,
          isFile: !isDirectory,
          size: isDirectory ? 1024 : 512,
          lastModified: new Date('2023-01-01T00:00:00Z')
        };
        return Promise.resolve(stats);
      });

      mockConsolidatedFileSystem.listDirectory.mockImplementation((dirPath: string) => {
        if (dirPath === '/Users/test/my-project') {
          return Promise.resolve(['CLAUDE.md', 'src', 'package.json', 'settings.json', 'random.txt']);
        } else if (dirPath === '/Users/test/my-project/src') {
          return Promise.resolve(['index.js', 'CLAUDE.md', 'utils']);
        } else if (dirPath === '/Users/test/my-project/src/utils') {
          return Promise.resolve(['helper.js']);
        }
        return Promise.resolve([]);
      });
    });

    it('should build a filtered tree structure', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      expect(result.tree).toBeDefined();
      expect(result.tree.name).toBe('test');
      expect(result.tree.type).toBe('directory');
      expect(result.tree.children).toBeDefined();
      
      // Navigate to the project root within the tree
      const projectNode = result.tree.children!.find(c => c.name === 'my-project');
      expect(projectNode).toBeDefined();
      expect(projectNode!.type).toBe('directory');
      
      // Should include configuration files in the project root
      const childNames = projectNode!.children?.map(c => c.name) || [];
      expect(childNames).toContain('CLAUDE.md');
      expect(childNames).toContain('settings.json');
      expect(childNames).toContain('src'); // Directory should be included
      expect(childNames).not.toContain('package.json');
      expect(childNames).not.toContain('random.txt');
    });

    it('should filter subdirectories recursively', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Navigate to the project root within the tree
      const projectNode = result.tree.children!.find(c => c.name === 'my-project');
      expect(projectNode).toBeDefined();
      
      const srcDir = projectNode!.children!.find(c => c.name === 'src');
      expect(srcDir).toBeDefined();
      expect(srcDir!.children).toBeDefined();
      
      // Should include CLAUDE.md from src directory
      const srcChildNames = srcDir!.children!.map(c => c.name);
      expect(srcChildNames).toContain('CLAUDE.md');
      expect(srcChildNames).not.toContain('index.js');
    });

    it('should provide summary statistics', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalDirectories).toBeGreaterThan(0);
      expect(result.configurationFiles).toBeDefined();
      expect(result.configurationFiles.memory).toBeGreaterThan(0);
      expect(result.configurationFiles.settings).toBeGreaterThan(0);
    });
  });
});