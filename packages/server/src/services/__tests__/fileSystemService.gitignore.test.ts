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

describe('FileSystemService - Gitignore Filtering', () => {
  let fileSystemService: FileSystemService;
  const mockConsolidatedFileSystem = ConsolidatedFileSystem as jest.Mocked<typeof ConsolidatedFileSystem>;

  beforeEach(() => {
    fileSystemService = new FileSystemService();
    jest.clearAllMocks();
  });

  describe('gitignore filtering in buildFilteredFileTree', () => {
    const projectRoot = '/Users/test/my-project';
    const rootPath = '/Users';

    beforeEach(() => {
      // Mock gitignore file content
      mockConsolidatedFileSystem.readFile.mockImplementation((filePath: string) => {
        if (filePath === '/Users/test/my-project/.gitignore') {
          return Promise.resolve(`
# Comments should be ignored
node_modules/
dist/
*.log
.DS_Store
coverage/
*.tmp
build/
.env
`);
        }
        return Promise.reject(new Error('File not found'));
      });

      // Mock file system structure
      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        const isDirectory = 
          filePath.endsWith('/Users/test/my-project') ||
          filePath.endsWith('/Users/test/my-project/src') ||
          filePath.endsWith('/Users/test/my-project/node_modules') ||
          filePath.endsWith('/Users/test/my-project/dist') ||
          filePath.endsWith('/Users/test/my-project/coverage') ||
          filePath.endsWith('/Users/test/my-project/build') ||
          filePath.endsWith('/Users/test/my-project/.claude');
        
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
          return Promise.resolve([
            'CLAUDE.md',
            'settings.json',
            'src',
            'node_modules',  // Should be ignored
            'dist',          // Should be ignored
            'coverage',      // Should be ignored
            'build',         // Should be ignored
            'app.log',       // Should be ignored
            '.DS_Store',     // Should be ignored
            '.env',          // Should be ignored
            'test.tmp',      // Should be ignored
            '.claude',
            'README.md',
            'package.json'
          ]);
        } else if (dirPath === '/Users/test/my-project/src') {
          return Promise.resolve(['index.js', 'app.ts', 'CLAUDE.md']);
        } else if (dirPath === '/Users/test/my-project/.claude') {
          return Promise.resolve(['commands', 'settings.json']);
        }
        return Promise.resolve([]);
      });
    });

    it('should filter out directories listed in .gitignore', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Navigate to the project root within the tree
      const projectNode = result.tree.children?.find(c => c.name === 'my-project');
      expect(projectNode).toBeDefined();
      
      const childNames = projectNode!.children?.map(c => c.name) || [];
      
      expect(childNames).not.toContain('node_modules');
      expect(childNames).not.toContain('dist');
      expect(childNames).not.toContain('coverage');
      expect(childNames).not.toContain('build');
      
      // Check that non-ignored directories are included
      expect(childNames).toContain('src');
      expect(childNames).toContain('.claude');
    });

    it('should filter out files matching .gitignore patterns', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Navigate to the project root within the tree
      const projectNode = result.tree.children?.find(c => c.name === 'my-project');
      expect(projectNode).toBeDefined();
      
      const childNames = projectNode!.children?.map(c => c.name) || [];
      
      // Check that ignored files are not in the tree
      expect(childNames).not.toContain('app.log');
      expect(childNames).not.toContain('.DS_Store');
      expect(childNames).not.toContain('.env');
      expect(childNames).not.toContain('test.tmp');
      
      // Check that configuration files are included
      expect(childNames).toContain('CLAUDE.md');
      expect(childNames).toContain('settings.json');
      
      // Check that command files from .claude/commands are included
      expect(childNames).toContain('.claude');
    });

    it('should handle missing .gitignore file gracefully', async () => {
      // Mock missing gitignore
      mockConsolidatedFileSystem.readFile.mockRejectedValue(new Error('File not found'));
      
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Navigate to the project root within the tree
      const projectNode = result.tree.children?.find(c => c.name === 'my-project');
      expect(projectNode).toBeDefined();
      
      // Should include all directories and configuration files when no gitignore
      const childNames = projectNode!.children?.map(c => c.name) || [];
      
      expect(childNames).toContain('node_modules');
      expect(childNames).toContain('dist');
      expect(childNames).toContain('src');
    });

    it('should ignore comment lines in .gitignore', async () => {
      mockConsolidatedFileSystem.readFile.mockResolvedValue(`
# This is a comment
node_modules/
# Another comment
dist/
`);
      
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      const projectNode = result.tree;
      const childNames = projectNode.children?.map(c => c.name) || [];
      
      expect(childNames).not.toContain('node_modules');
      expect(childNames).not.toContain('dist');
    });

    it('should handle directory patterns correctly', async () => {
      mockConsolidatedFileSystem.readFile.mockResolvedValue(`
coverage/
build/
`);

      // Add nested structure
      mockConsolidatedFileSystem.listDirectory.mockImplementation((dirPath: string) => {
        if (dirPath === '/Users/test/my-project') {
          return Promise.resolve(['src', 'coverage', 'build']);
        } else if (dirPath === '/Users/test/my-project/src') {
          return Promise.resolve(['coverage', 'components']); // coverage inside src should NOT be ignored
        }
        return Promise.resolve([]);
      });

      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        const isDirectory = !filePath.includes('.') || filePath.endsWith('coverage') || filePath.endsWith('build');
        return Promise.resolve({
          exists: true,
          isDirectory,
          isFile: !isDirectory,
          size: 1024,
          lastModified: new Date()
        });
      });

      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Navigate to the project root within the tree
      const projectNode = result.tree.children?.find(c => c.name === 'my-project');
      expect(projectNode).toBeDefined();
      
      const projectChildren = projectNode!.children?.map(c => c.name) || [];
      
      // Root level coverage and build should be ignored
      expect(projectChildren).not.toContain('coverage');
      expect(projectChildren).not.toContain('build');
      expect(projectChildren).toContain('src');
    });

    it('should handle glob patterns correctly', async () => {
      mockConsolidatedFileSystem.readFile.mockResolvedValue(`
*.log
*.tmp
.env*
`);

      mockConsolidatedFileSystem.listDirectory.mockResolvedValue([
        'app.log',
        'error.log',
        'test.tmp',
        '.env',
        '.env.local',
        '.env.production',
        'CLAUDE.md',
        'settings.json'
      ]);

      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      const projectNode = result.tree;
      const childNames = projectNode.children?.map(c => c.name) || [];
      
      // All matching patterns should be ignored
      expect(childNames).not.toContain('app.log');
      expect(childNames).not.toContain('error.log');
      expect(childNames).not.toContain('test.tmp');
      expect(childNames).not.toContain('.env');
      expect(childNames).not.toContain('.env.local');
      expect(childNames).not.toContain('.env.production');
      
      // Configuration files should still be included
      expect(childNames).toContain('CLAUDE.md');
      expect(childNames).toContain('settings.json');
    });
  });
});