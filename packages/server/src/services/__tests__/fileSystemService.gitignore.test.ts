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
    fileExists: jest.fn(),
    directoryExists: jest.fn(),
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
        // Normalize path to Unix style for consistent matching
        const normalizedPath = filePath.replace(/\\/g, '/').replace(/^[A-Z]:/, '');
        if (normalizedPath === '/Users/test/my-project/.gitignore') {
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
        // Normalize path to Unix style for consistent matching
        const normalizedPath = filePath.replace(/\\/g, '/').replace(/^[A-Z]:/, '');
        const isDirectory = 
          normalizedPath === '/Users' ||
          normalizedPath === '/Users/test' ||
          normalizedPath === '/Users/test/my-project' ||
          normalizedPath === '/Users/test/my-project/src' ||
          normalizedPath === '/Users/test/my-project/node_modules' ||
          normalizedPath === '/Users/test/my-project/dist' ||
          normalizedPath === '/Users/test/my-project/coverage' ||
          normalizedPath === '/Users/test/my-project/build' ||
          normalizedPath === '/Users/test/my-project/.claude' ||
          normalizedPath === '/Users/test/my-project/.claude/commands';
        
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
        // Normalize path to Unix style for consistent matching
        const normalizedPath = dirPath.replace(/\\/g, '/').replace(/^[A-Z]:/, '');
        
        if (normalizedPath === '/Users') {
          return Promise.resolve(['test']);
        } else if (normalizedPath === '/Users/test') {
          return Promise.resolve(['my-project']);
        } else if (normalizedPath === '/Users/test/my-project') {
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
        } else if (normalizedPath === '/Users/test/my-project/src') {
          return Promise.resolve(['index.js', 'app.ts', 'CLAUDE.md']);
        } else if (normalizedPath === '/Users/test/my-project/.claude') {
          return Promise.resolve(['commands', 'settings.json']);
        } else if (normalizedPath === '/Users/test/my-project/.claude/commands') {
          return Promise.resolve(['test-command.md']);
        }
        return Promise.resolve([]);
      });

      // Mock fileExists
      mockConsolidatedFileSystem.fileExists.mockImplementation((filePath: string) => {
        // Normalize path to Unix style for consistent matching
        const normalizedPath = filePath.replace(/\\/g, '/').replace(/^[A-Z]:/, '');
        if (normalizedPath.endsWith('.gitignore')) {
          return Promise.resolve(true); // .gitignore exists
        }
        return Promise.resolve(false);
      });

      // Mock directoryExists
      mockConsolidatedFileSystem.directoryExists.mockImplementation(async (dirPath: string): Promise<boolean> => {
        try {
          const stats = await mockConsolidatedFileSystem.getFileStats(dirPath);
          return !!(stats.exists && stats.isDirectory);
        } catch {
          return false;
        }
      });
    });

    it('should filter out directories listed in .gitignore', async () => {
      const result = await fileSystemService.buildFilteredFileTree(projectRoot, rootPath);
      
      // Navigate to the project root within the tree
      expect(result.tree.name).toBe('test');
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
      expect(result.tree.name).toBe('test');
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
      expect(result.tree.name).toBe('test');
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
        // Normalize path to Unix style for consistent matching
        const normalizedPath = dirPath.replace(/\\/g, '/').replace(/^[A-Z]:/, '');
        
        if (normalizedPath === '/Users') {
          return Promise.resolve(['test']);
        } else if (normalizedPath === '/Users/test') {
          return Promise.resolve(['my-project']);
        } else if (normalizedPath === '/Users/test/my-project') {
          return Promise.resolve(['src', 'coverage', 'build']);
        } else if (normalizedPath === '/Users/test/my-project/src') {
          return Promise.resolve(['coverage', 'components']); // coverage inside src should NOT be ignored
        }
        return Promise.resolve([]);
      });

      mockConsolidatedFileSystem.getFileStats.mockImplementation((filePath: string) => {
        // Normalize path to Unix style for consistent matching
        const normalizedPath = filePath.replace(/\\/g, '/').replace(/^[A-Z]:/, '');
        const isDirectory = !normalizedPath.includes('.') || normalizedPath.endsWith('coverage') || normalizedPath.endsWith('build') ||
          normalizedPath === '/Users' || normalizedPath === '/Users/test' || normalizedPath.endsWith('/src') || normalizedPath.endsWith('/components');
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