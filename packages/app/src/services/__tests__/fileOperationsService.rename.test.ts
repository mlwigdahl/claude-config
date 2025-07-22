import { FileOperationsService } from '../fileOperationsService';

describe('FileOperationsService - File Type Detection for Renamed Files', () => {
  beforeEach(() => {
    // Suppress console logs during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Memory File Detection', () => {
    it('should recognize CLAUDE.md as memory file', () => {
      const fileType = FileOperationsService.getFileType('/project/CLAUDE.md');
      expect(fileType).toBe('memory');
    });

    it('should recognize renamed memory files', () => {
      const testCases = [
        '/project/project-memory.md',
        '/project/notes.md',
        '/project/documentation.md',
        '/project/my-memory-file.md',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBe('memory');
      });
    });

    it('should recognize inactive memory files', () => {
      const testCases = [
        '/project/CLAUDE.md.inactive',
        '/project/project-memory.md.inactive',
        '/project/notes.md.inactive',
        '/project/documentation.md.inactive',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBe('memory');
      });
    });

    it('should not recognize .md files in commands directory as memory files', () => {
      const testCases = [
        '/project/.claude/commands/test-command.md',
        '/project/.claude/commands/subfolder/another-command.md',
        '/project/.claude/commands/test-command.md.inactive',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBe('command');
      });
    });

    it('should not recognize non-.md files as memory files', () => {
      const testCases = [
        '/project/readme.txt',
        '/project/notes.html',
        '/project/document.pdf',
        '/project/data.json',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBeNull();
      });
    });
  });

  describe('Settings File Detection', () => {
    it('should recognize standard settings files', () => {
      const testCases = [
        '/project/settings.json',
        '/project/settings.local.json',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBe('settings');
      });
    });

    it('should recognize inactive settings files', () => {
      const testCases = [
        '/project/settings.json.inactive',
        '/project/settings.local.json.inactive',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBe('settings');
      });
    });

    it('should not recognize custom .json files as settings files', () => {
      const testCases = [
        '/project/config.json',
        '/project/package.json',
        '/project/custom-settings.json',
        '/project/data.json',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBeNull();
      });
    });
  });

  describe('isCommandFile Helper Method', () => {
    it('should identify command files in .claude/commands directory', () => {
      const testCases = [
        '/project/.claude/commands/test-command.md',
        '/project/.claude/commands/subfolder/nested-command.md',
        '/project/.claude/commands/utilities/helper-command.md',
        '/project/.claude/commands/CLAUDE.md', // Should be command if in commands directory
      ];

      testCases.forEach(filePath => {
        const isCommand = FileOperationsService.isCommandFile(filePath);
        expect(isCommand).toBe(true);
      });
    });

    it('should not identify non-command files as command files', () => {
      const testCases = [
        '/project/CLAUDE.md', // Memory file in root
        '/project/docs/guide.md', // Regular markdown file
        '/project/.claude/other-file.md', // Not in commands directory
        '/project/.claude/commands/file.txt', // Wrong extension
        '/project/commands/file.md', // No .claude parent
      ];

      testCases.forEach(filePath => {
        const isCommand = FileOperationsService.isCommandFile(filePath);
        expect(isCommand).toBe(false);
      });
    });

    it('should handle path variations', () => {
      const validPaths = [
        '/project/.claude/commands/test.md',
        '\\project\\.claude\\commands\\test.md', // Windows style
        '/project/.claude/commands/../commands/test.md', // With relative path
      ];

      validPaths.forEach(filePath => {
        const isCommand = FileOperationsService.isCommandFile(filePath);
        expect(isCommand).toBe(true);
      });
    });
  });

  describe('Command File Detection', () => {
    it('should recognize command files in .claude/commands directory', () => {
      const testCases = [
        '/project/.claude/commands/test-command.md',
        '/project/.claude/commands/subfolder/nested-command.md',
        '/project/.claude/commands/utilities/helper-command.md',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBe('command');
      });
    });

    it('should recognize inactive command files', () => {
      const testCases = [
        '/project/.claude/commands/test-command.md.inactive',
        '/project/.claude/commands/subfolder/nested-command.md.inactive',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBe('command');
      });
    });

    it('should not recognize .md files outside commands directory as command files', () => {
      const testCases = [
        '/project/.claude/other-file.md',
        '/project/.claude/README.md',
        '/project/docs/guide.md',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBe('memory'); // Should be memory since they're .md files not in commands
      });
    });
  });

  describe('File Type Priority and Precedence', () => {
    it('should prioritize settings detection over memory for settings files', () => {
      const fileType = FileOperationsService.getFileType('/project/settings.json');
      expect(fileType).toBe('settings');
    });

    it('should prioritize command detection over memory for command files', () => {
      const fileType = FileOperationsService.getFileType('/project/.claude/commands/test.md');
      expect(fileType).toBe('command');
    });

    it('should default to memory for .md files not in commands directory', () => {
      const testCases = [
        '/project/any-name.md',
        '/project/subdirectory/file.md',
        '/project/.claude/not-in-commands.md',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBe('memory');
      });
    });
  });

  describe('Edge Cases and Invalid Files', () => {
    it('should handle files with no extension', () => {
      const testCases = [
        '/project/file-without-extension',
        '/project/README',
        '/project/LICENSE',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBeNull();
      });
    });

    it('should handle empty or invalid file paths', () => {
      const testCases = [
        '',
        '/',
        '/project/',
        'invalid-path',
      ];

      testCases.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBeNull();
      });
    });

    it('should handle files with multiple dots in filename', () => {
      const testCases = [
        '/project/file.name.with.dots.md',
        '/project/settings.backup.json',
        '/project/.claude/commands/complex.command.name.md',
      ];

      expect(FileOperationsService.getFileType(testCases[0])).toBe('memory');
      expect(FileOperationsService.getFileType(testCases[1])).toBeNull(); // Not a standard settings file
      expect(FileOperationsService.getFileType(testCases[2])).toBe('command');
    });

    it('should handle inactive files with complex names', () => {
      const testCases = [
        '/project/complex-memory-file-name.md.inactive',
        '/project/settings.json.inactive',
        '/project/.claude/commands/complex-command-name.md.inactive',
      ];

      expect(FileOperationsService.getFileType(testCases[0])).toBe('memory');
      expect(FileOperationsService.getFileType(testCases[1])).toBe('settings');
      expect(FileOperationsService.getFileType(testCases[2])).toBe('command');
    });
  });

  describe('Path Normalization', () => {
    it('should handle different path separators and formats', () => {
      // These should all be treated as command files
      const commandFilePaths = [
        '/project/.claude/commands/test.md',
        '\\project\\.claude\\commands\\test.md', // Windows-style path
        '/project/.claude/commands/../commands/test.md', // Path with relative parts
      ];

      commandFilePaths.forEach(filePath => {
        const fileType = FileOperationsService.getFileType(filePath);
        expect(fileType).toBe('command');
      });
    });

    it('should handle paths with trailing slashes', () => {
      const fileType = FileOperationsService.getFileType('/project/memory-file.md/');
      expect(fileType).toBe('memory');
    });
  });

});