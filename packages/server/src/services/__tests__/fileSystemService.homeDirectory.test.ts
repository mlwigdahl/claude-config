import { FileSystemService } from '../fileSystemService.js';
import { ConsolidatedFileSystem } from '@claude-config/core';
import * as path from 'path';

const mockHomeDir = 'C:\\Users\\TestUser';

jest.mock('os', () => ({
  homedir: jest.fn(() => mockHomeDir),
}));

jest.mock('@claude-config/core', () => ({
  ConsolidatedFileSystem: {
    fileExists: jest.fn(),
    directoryExists: jest.fn(),
    getFileStats: jest.fn(),
    listDirectory: jest.fn(),
    readFile: jest.fn(),
  },
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('FileSystemService - Home Directory Handling', () => {
  let fileSystemService: FileSystemService;
  const mockClaudeDir = path.join(mockHomeDir, '.claude');

  beforeEach(() => {
    fileSystemService = new FileSystemService();
    jest.clearAllMocks();
  });

  describe('buildFilteredFileTree', () => {
    it('should only scan .claude subdirectory when processing home directory', async () => {
      // Mock that .claude directory exists
      (ConsolidatedFileSystem.directoryExists as jest.Mock).mockResolvedValue(true);
      (ConsolidatedFileSystem.getFileStats as jest.Mock).mockImplementation(async (filePath: string) => {
        if (filePath === mockClaudeDir) {
          return {
            exists: true,
            isDirectory: true,
            isFile: false,
            size: 0,
            lastModified: new Date(),
          };
        }
        return {
          exists: true,
          isDirectory: false,
          isFile: true,
          size: 100,
          lastModified: new Date(),
        };
      });

      // Mock .claude directory contents
      (ConsolidatedFileSystem.listDirectory as jest.Mock).mockImplementation(async (dirPath: string) => {
        if (dirPath === mockClaudeDir) {
          return ['CLAUDE.md', 'settings.json', 'commands'];
        }
        if (dirPath === path.join(mockClaudeDir, 'commands')) {
          return ['test-command.md'];
        }
        return [];
      });

      const result = await fileSystemService.buildFilteredFileTree(mockHomeDir, mockHomeDir);

      // Should have home directory as root with .claude as only child
      expect(result.tree).toBeDefined();
      expect(result.tree.name).toBe('TestUser');
      expect(result.tree.path).toBe(mockHomeDir);
      expect(result.tree.children).toHaveLength(1);
      expect(result.tree.children![0].name).toBe('.claude');
    });

    it('should handle missing .claude directory gracefully', async () => {
      // Mock that .claude directory doesn't exist
      (ConsolidatedFileSystem.directoryExists as jest.Mock).mockResolvedValue(false);

      const result = await fileSystemService.buildFilteredFileTree(mockHomeDir, mockHomeDir);

      // Should return home directory with no children
      expect(result.tree).toBeDefined();
      expect(result.tree.name).toBe('TestUser');
      expect(result.tree.path).toBe(mockHomeDir);
      expect(result.tree.children).toHaveLength(0);
    });

    it('should not scan other directories in home directory', async () => {
      // Mock home directory with multiple subdirectories
      (ConsolidatedFileSystem.directoryExists as jest.Mock).mockResolvedValue(true);
      (ConsolidatedFileSystem.getFileStats as jest.Mock).mockImplementation(async (filePath: string) => {
        return {
          exists: true,
          isDirectory: true,
          isFile: false,
          size: 0,
          lastModified: new Date(),
        };
      });

      // Even if listDirectory would return other directories, they shouldn't be processed
      (ConsolidatedFileSystem.listDirectory as jest.Mock).mockResolvedValue([
        '.claude',
        'Documents',
        'Downloads',
        'Desktop'
      ]);

      const result = await fileSystemService.buildFilteredFileTree(mockHomeDir, mockHomeDir);

      // Should only process .claude directory
      expect(result.tree.children).toHaveLength(1);
      expect(result.tree.children![0].name).toBe('.claude');
      
      // listDirectory should only be called for .claude directory (home directory scanning is optimized)
      expect(ConsolidatedFileSystem.listDirectory).toHaveBeenCalledWith(mockClaudeDir);
    });
  });

  describe('isConfigurationFile with home context', () => {
    it('should reject memory files outside .claude in home context', () => {
      const result = FileSystemService.isConfigurationFile(
        'CLAUDE.md',
        path.join(mockHomeDir, 'Documents', 'CLAUDE.md'),
        true // isHomeContext
      );

      expect(result.valid).toBe(false);
      expect(result.type).toBe(null);
    });

    it('should accept memory files inside .claude in home context', () => {
      const result = FileSystemService.isConfigurationFile(
        'CLAUDE.md',
        path.join(mockHomeDir, '.claude', 'CLAUDE.md'),
        true // isHomeContext
      );

      expect(result.valid).toBe(true);
      expect(result.type).toBe('memory');
    });

    it('should accept settings files anywhere (they are always in .claude)', () => {
      const result = FileSystemService.isConfigurationFile(
        'settings.json',
        path.join(mockHomeDir, '.claude', 'settings.json'),
        true // isHomeContext
      );

      expect(result.valid).toBe(true);
      expect(result.type).toBe('settings');
    });

    it('should accept command files in .claude/commands in home context', () => {
      const result = FileSystemService.isConfigurationFile(
        'my-command.md',
        path.join(mockHomeDir, '.claude', 'commands', 'my-command.md'),
        true // isHomeContext
      );

      expect(result.valid).toBe(true);
      expect(result.type).toBe('command');
    });

    it('should accept non-standard memory files in .claude in home context', () => {
      const result = FileSystemService.isConfigurationFile(
        'custom-memory.md',
        path.join(mockHomeDir, '.claude', 'custom-memory.md'),
        true // isHomeContext
      );

      expect(result.valid).toBe(true);
      expect(result.type).toBe('memory');
    });
  });

  describe('isConfigurationFile in project context', () => {
    it('should accept memory files anywhere in project context', () => {
      const projectPath = 'M:\\projects\\my-project';
      
      const result1 = FileSystemService.isConfigurationFile(
        'CLAUDE.md',
        path.join(projectPath, 'CLAUDE.md'),
        false // not home context
      );

      const result2 = FileSystemService.isConfigurationFile(
        'CLAUDE.md',
        path.join(projectPath, 'src', 'components', 'CLAUDE.md'),
        false // not home context
      );

      expect(result1.valid).toBe(true);
      expect(result1.type).toBe('memory');
      expect(result2.valid).toBe(true);
      expect(result2.type).toBe('memory');
    });

    it('should accept non-standard memory files anywhere in project context', () => {
      const projectPath = 'M:\\projects\\my-project';
      
      const result = FileSystemService.isConfigurationFile(
        'project-notes.md',
        path.join(projectPath, 'docs', 'project-notes.md'),
        false // not home context
      );

      expect(result.valid).toBe(true);
      expect(result.type).toBe('memory');
    });
  });

  describe('buildFilteredTreeNode with home context', () => {
    it('should respect home context when processing file nodes directly', async () => {
      const claudeMemoryPath = path.join(mockHomeDir, '.claude', 'CLAUDE.md');
      
      // Mock that .claude directory exists
      (ConsolidatedFileSystem.directoryExists as jest.Mock).mockResolvedValue(true);
      
      // Mock file stats for a memory file in .claude
      (ConsolidatedFileSystem.getFileStats as jest.Mock).mockImplementation(async (filePath: string) => {
        if (filePath === mockClaudeDir) {
          return {
            exists: true,
            isDirectory: true,
            isFile: false,
            size: 0,
            lastModified: new Date(),
          };
        }
        return {
          exists: true,
          isDirectory: false,
          isFile: true,
          size: 100,
          lastModified: new Date(),
        };
      });

      // Mock reading file content for validation
      (ConsolidatedFileSystem.readFile as jest.Mock).mockResolvedValue('# Claude Memory File');

      // Mock directory listing
      (ConsolidatedFileSystem.listDirectory as jest.Mock).mockImplementation(async (dirPath: string) => {
        if (dirPath === mockClaudeDir) {
          return ['CLAUDE.md'];
        }
        return [];
      });

      // Build tree with home context for a single file
      const result = await fileSystemService.buildFilteredFileTree(mockHomeDir, mockHomeDir);

      // Verify that the tree building correctly identifies memory files in .claude
      // when processing them as file nodes (not just as directory children)
      const listDirCalls = (ConsolidatedFileSystem.listDirectory as jest.Mock).mock.calls;
      
      // The home directory scanning should detect .claude subdirectory
      expect(listDirCalls.some((call: any[]) => call[0] === mockClaudeDir)).toBe(true);
    });

    it('should correctly handle newly created memory files in .claude directory', async () => {
      const newMemoryFile = 'new-memory.md';
      const newMemoryPath = path.join(mockHomeDir, '.claude', newMemoryFile);

      // Mock .claude directory exists
      (ConsolidatedFileSystem.directoryExists as jest.Mock).mockResolvedValue(true);
      
      // Mock directory and file stats
      (ConsolidatedFileSystem.getFileStats as jest.Mock).mockImplementation(async (filePath: string) => {
        if (filePath === mockClaudeDir) {
          return {
            exists: true,
            isDirectory: true,
            isFile: false,
            size: 0,
            lastModified: new Date(),
          };
        }
        if (filePath === newMemoryPath || filePath.endsWith('.md')) {
          return {
            exists: true,
            isDirectory: false,
            isFile: true,
            size: 100,
            lastModified: new Date(),
          };
        }
        return {
          exists: false,
          isDirectory: false,
          isFile: false,
          size: 0,
          lastModified: new Date(),
        };
      });

      // Mock .claude directory contents including the new file
      (ConsolidatedFileSystem.listDirectory as jest.Mock).mockImplementation(async (dirPath: string) => {
        if (dirPath === mockClaudeDir) {
          return ['CLAUDE.md', newMemoryFile, 'settings.json'];
        }
        return [];
      });

      const result = await fileSystemService.buildFilteredFileTree(mockHomeDir, mockHomeDir);

      // Should include the newly created memory file
      expect(result.tree.children).toHaveLength(1); // Only .claude
      expect(result.tree.children![0].name).toBe('.claude');
      
      const claudeChildren = result.tree.children![0].children || [];
      const memoryFiles = claudeChildren.filter(child => child.fileType === 'memory');
      
      // Should have both CLAUDE.md and new-memory.md
      expect(memoryFiles.length).toBeGreaterThanOrEqual(2);
      expect(memoryFiles.some(file => file.name === newMemoryFile)).toBe(true);
    });
  });
});