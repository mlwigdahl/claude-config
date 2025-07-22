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

describe('FileSystemService - Ancestor Directory Search', () => {
  let fileSystemService: FileSystemService;
  const mockConsolidatedFileSystem = ConsolidatedFileSystem as jest.Mocked<typeof ConsolidatedFileSystem>;

  beforeEach(() => {
    fileSystemService = new FileSystemService();
    jest.clearAllMocks();
  });

  describe('ancestor directory file discovery', () => {
    const projectRoot = '/Users/test/dev/my-project';
    const rootPath = '/Users';

    beforeEach(() => {
      // Mock file system structure with ancestor directories
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        const fileMap = {
          '/Users/test/dev/my-project': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/my-project/.claude': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/my-project/.claude/settings.json': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/my-project/.claude/commands': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/my-project/.claude/commands/test.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/my-project/CLAUDE.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/my-project/src': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/.claude': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/.claude/settings.json': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/.claude/commands': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/.claude/commands/global.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/CLAUDE.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/other-project': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/some-file.txt': { isDirectory: false, isFile: true, exists: true },
          '/Users/test': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/.claude': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/.claude/settings.json': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/CLAUDE.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/Documents': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/random-file.txt': { isDirectory: false, isFile: true, exists: true },
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
          '/Users/test/dev/my-project': ['CLAUDE.md', 'src', '.claude', 'package.json'],
          '/Users/test/dev/my-project/.claude': ['settings.json', 'commands'],
          '/Users/test/dev/my-project/.claude/commands': ['test.md'],
          '/Users/test/dev': ['my-project', 'CLAUDE.md', '.claude', 'other-project', 'some-file.txt'],
          '/Users/test/dev/.claude': ['settings.json', 'commands'],
          '/Users/test/dev/.claude/commands': ['global.md'],
          '/Users/test': ['dev', 'CLAUDE.md', '.claude', 'Documents', 'random-file.txt'],
          '/Users/test/.claude': ['settings.json'],
        };

        const files = directoryMap[dirPath as keyof typeof directoryMap];
        return Promise.resolve(files || []);
      });

      // Mock gitignore (empty for ancestor directories)
      mockConsolidatedFileSystem.readFile.mockImplementation((filePath: string) => {
        if (filePath.endsWith('.gitignore')) {
          return Promise.resolve('node_modules/\n*.log\n');
        }
        return Promise.reject(new Error('File not found'));
      });
    });

    it('should include .claude directories from ancestor directories', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Check that the tree includes ancestor .claude directories
      const rootNode = result.tree;
      expect(rootNode.name).toBe('test');
      
      // Navigate to dev directory
      const devNode = rootNode.children?.find(c => c.name === 'dev');
      expect(devNode).toBeDefined();
      
      // Check that dev directory contains .claude directory
      const devClaudeNode = devNode?.children?.find(c => c.name === '.claude');
      expect(devClaudeNode).toBeDefined();
      expect(devClaudeNode?.type).toBe('directory');
      
      // Check that .claude directory contains settings.json
      const devSettingsNode = devClaudeNode?.children?.find(c => c.name === 'settings.json');
      expect(devSettingsNode).toBeDefined();
      expect(devSettingsNode?.type).toBe('file');
      
      // Check that .claude directory contains commands directory
      const devCommandsNode = devClaudeNode?.children?.find(c => c.name === 'commands');
      expect(devCommandsNode).toBeDefined();
      expect(devCommandsNode?.type).toBe('directory');
      
      // Check that commands directory contains global.md
      const globalCommandNode = devCommandsNode?.children?.find(c => c.name === 'global.md');
      expect(globalCommandNode).toBeDefined();
      expect(globalCommandNode?.type).toBe('file');
    });

    it('should include configuration files from ancestor directories', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Check that the tree includes ancestor CLAUDE.md files
      const rootNode = result.tree;
      
      // Check root level CLAUDE.md
      const rootClaudeFile = rootNode.children?.find(c => c.name === 'CLAUDE.md');
      expect(rootClaudeFile).toBeDefined();
      expect(rootClaudeFile?.type).toBe('file');
      
      // Navigate to dev directory
      const devNode = rootNode.children?.find(c => c.name === 'dev');
      expect(devNode).toBeDefined();
      
      // Check dev level CLAUDE.md
      const devClaudeFile = devNode?.children?.find(c => c.name === 'CLAUDE.md');
      expect(devClaudeFile).toBeDefined();
      expect(devClaudeFile?.type).toBe('file');
      
      // Navigate to project directory
      const projectNode = devNode?.children?.find(c => c.name === 'my-project');
      expect(projectNode).toBeDefined();
      
      // Check project level CLAUDE.md
      const projectClaudeFile = projectNode?.children?.find(c => c.name === 'CLAUDE.md');
      expect(projectClaudeFile).toBeDefined();
      expect(projectClaudeFile?.type).toBe('file');
    });

    it('should handle missing .claude directories gracefully', async () => {
      // Mock scenario without .claude directories
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        const fileMap = {
          '/Users/test/dev/my-project': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/my-project/CLAUDE.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/my-project/src': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/my-project/package.json': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/CLAUDE.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/other-project': { isDirectory: true, isFile: false, exists: true },
          '/Users/test': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/CLAUDE.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/Documents': { isDirectory: true, isFile: false, exists: true },
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

      mockConsolidatedFileSystem.listDirectory.mockImplementation((dirPath: string) => {
        const directoryMap = {
          '/Users/test/dev/my-project': ['CLAUDE.md', 'src', 'package.json'],
          '/Users/test/dev': ['my-project', 'CLAUDE.md', 'other-project'],
          '/Users/test': ['dev', 'CLAUDE.md', 'Documents'],
        };

        const files = directoryMap[dirPath as keyof typeof directoryMap];
        return Promise.resolve(files || []);
      });

      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Should still build the tree without .claude directories
      const rootNode = result.tree;
      expect(rootNode.name).toBe('test');
      
      // Navigate to dev directory
      const devNode = rootNode.children?.find(c => c.name === 'dev');
      expect(devNode).toBeDefined();
      
      // Should not contain .claude directory
      const devClaudeNode = devNode?.children?.find(c => c.name === '.claude');
      expect(devClaudeNode).toBeUndefined();
      
      // But should still contain CLAUDE.md
      const devClaudeFile = devNode?.children?.find(c => c.name === 'CLAUDE.md');
      expect(devClaudeFile).toBeDefined();
    });

    it('should exclude non-configuration files and subdirectories from ancestor directories', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      const rootNode = result.tree;
      
      // Check that non-configuration files are excluded from root level
      const rootRandomFile = rootNode.children?.find(c => c.name === 'random-file.txt');
      expect(rootRandomFile).toBeUndefined();
      
      // Check that non-configuration subdirectories are excluded from root level
      const rootDocuments = rootNode.children?.find(c => c.name === 'Documents');
      expect(rootDocuments).toBeUndefined();
      
      // Navigate to dev directory
      const devNode = rootNode.children?.find(c => c.name === 'dev');
      expect(devNode).toBeDefined();
      
      // Check that non-configuration files are excluded from dev level
      const devSomeFile = devNode?.children?.find(c => c.name === 'some-file.txt');
      expect(devSomeFile).toBeUndefined();
      
      // Check that non-configuration subdirectories are excluded from dev level
      const devOtherProject = devNode?.children?.find(c => c.name === 'other-project');
      expect(devOtherProject).toBeUndefined();
      
      // But configuration files should still be included
      expect(rootNode.children?.find(c => c.name === 'CLAUDE.md')).toBeDefined();
      expect(devNode?.children?.find(c => c.name === 'CLAUDE.md')).toBeDefined();
      
      // And .claude directories should still be included
      expect(rootNode.children?.find(c => c.name === '.claude')).toBeDefined();
      expect(devNode?.children?.find(c => c.name === '.claude')).toBeDefined();
    });

    it('should respect gitignore patterns in project directory but not ancestor directories', async () => {
      // Add ignored files to project directory
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        const fileMap = {
          '/Users/test/dev/my-project': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/my-project/.claude': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/my-project/.claude/settings.json': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/my-project/.claude/commands': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/my-project/.claude/commands/test.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/my-project/CLAUDE.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/my-project/src': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/my-project/node_modules': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/my-project/app.log': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/.claude': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/.claude/settings.json': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/.claude/commands': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/dev/.claude/commands/global.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/CLAUDE.md': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/dev/node_modules': { isDirectory: true, isFile: false, exists: true },
          '/Users/test': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/.claude': { isDirectory: true, isFile: false, exists: true },
          '/Users/test/.claude/settings.json': { isDirectory: false, isFile: true, exists: true },
          '/Users/test/CLAUDE.md': { isDirectory: false, isFile: true, exists: true },
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

      mockConsolidatedFileSystem.listDirectory.mockImplementation((dirPath: string) => {
        const directoryMap = {
          '/Users/test/dev/my-project': ['CLAUDE.md', 'src', '.claude', 'node_modules', 'app.log'],
          '/Users/test/dev/my-project/.claude': ['settings.json', 'commands'],
          '/Users/test/dev/my-project/.claude/commands': ['test.md'],
          '/Users/test/dev': ['my-project', 'CLAUDE.md', '.claude', 'node_modules'],
          '/Users/test/dev/.claude': ['settings.json', 'commands'],
          '/Users/test/dev/.claude/commands': ['global.md'],
          '/Users/test': ['dev', 'CLAUDE.md', '.claude'],
          '/Users/test/.claude': ['settings.json'],
        };

        const files = directoryMap[dirPath as keyof typeof directoryMap];
        return Promise.resolve(files || []);
      });

      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Project directory should respect gitignore
      const rootNode = result.tree;
      const devNode = rootNode.children?.find(c => c.name === 'dev');
      const projectNode = devNode?.children?.find(c => c.name === 'my-project');
      
      // Should not contain ignored files in project directory
      const projectNodeModules = projectNode?.children?.find(c => c.name === 'node_modules');
      expect(projectNodeModules).toBeUndefined();
      
      // Ancestor directories should only include configuration files and .claude directories
      // (node_modules is not a configuration file, so it should be excluded from ancestor directories too)
      const devNodeModules = devNode?.children?.find(c => c.name === 'node_modules');
      expect(devNodeModules).toBeUndefined(); // Should be excluded from ancestor directory (not a config file)
      
      // But configuration files should still be included in ancestor directories
      expect(devNode?.children?.find(c => c.name === 'CLAUDE.md')).toBeDefined();
      expect(devNode?.children?.find(c => c.name === '.claude')).toBeDefined();
    });

    it('should calculate statistics correctly including ancestor files', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Should count files from all directories
      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalDirectories).toBeGreaterThan(0);
      
      // Should count configuration files from ancestor directories
      expect(result.configurationFiles.memory).toBeGreaterThan(0); // CLAUDE.md files
      expect(result.configurationFiles.settings).toBeGreaterThan(0); // settings.json files
      expect(result.configurationFiles.command).toBeGreaterThan(0); // command files
    });

    it('should handle deeply nested ancestor directories', async () => {
      const deepProjectRoot = '/Users/test/dev/projects/client/my-project';
      
      // Mock deep directory structure
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        const paths = [
          '/Users/test/dev/projects/client/my-project',
          '/Users/test/dev/projects/client',
          '/Users/test/dev/projects',
          '/Users/test/dev',
          '/Users/test'
        ];
        
        if (paths.includes(filePath) || filePath.endsWith('CLAUDE.md') || filePath.endsWith('.claude')) {
          return Promise.resolve({
            exists: true,
            isDirectory: !filePath.endsWith('.md'),
            isFile: filePath.endsWith('.md'),
            size: 1024,
            lastModified: new Date()
          });
        }
        return Promise.resolve({ exists: false, isDirectory: false, isFile: false, size: 0, lastModified: new Date() });
      });

      mockConsolidatedFileSystem.listDirectory.mockImplementation((dirPath: string) => {
        const directoryMap = {
          '/Users/test/dev/projects/client/my-project': ['CLAUDE.md'],
          '/Users/test/dev/projects/client': ['my-project', 'CLAUDE.md'],
          '/Users/test/dev/projects': ['client', 'CLAUDE.md'],
          '/Users/test/dev': ['projects', 'CLAUDE.md'],
          '/Users/test': ['dev', 'CLAUDE.md'],
        };

        const files = directoryMap[dirPath as keyof typeof directoryMap];
        return Promise.resolve(files || []);
      });

      const result = await fileSystemService.buildFilteredFileTree(deepProjectRoot, rootPath);
      
      // Should build complete tree from root to deep project
      const rootNode = result.tree;
      expect(rootNode.name).toBe('test');
      
      // Navigate through the hierarchy
      const devNode = rootNode.children?.find(c => c.name === 'dev');
      expect(devNode).toBeDefined();
      
      const projectsNode = devNode?.children?.find(c => c.name === 'projects');
      expect(projectsNode).toBeDefined();
      
      const clientNode = projectsNode?.children?.find(c => c.name === 'client');
      expect(clientNode).toBeDefined();
      
      const projectNode = clientNode?.children?.find(c => c.name === 'my-project');
      expect(projectNode).toBeDefined();
      
      // Each level should contain its CLAUDE.md file
      expect(rootNode.children?.find(c => c.name === 'CLAUDE.md')).toBeDefined();
      expect(devNode?.children?.find(c => c.name === 'CLAUDE.md')).toBeDefined();
      expect(projectsNode?.children?.find(c => c.name === 'CLAUDE.md')).toBeDefined();
      expect(clientNode?.children?.find(c => c.name === 'CLAUDE.md')).toBeDefined();
      expect(projectNode?.children?.find(c => c.name === 'CLAUDE.md')).toBeDefined();
    });
  });
});