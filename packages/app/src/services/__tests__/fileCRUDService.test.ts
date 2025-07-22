import { FileCRUDService, CreateFileOptions } from '../fileCRUDService';
import { FileSystemService } from '../fileSystemService';
import { FileOperationsService } from '../fileOperationsService';

// Mock the services
jest.mock('../fileSystemService');
jest.mock('../fileOperationsService');

const mockFileSystemService = FileSystemService as jest.Mocked<typeof FileSystemService>;
const mockFileOperationsService = FileOperationsService as jest.Mocked<typeof FileOperationsService>;

describe('FileCRUDService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mocks
    mockFileSystemService.fileExists.mockResolvedValue(false);
    mockFileSystemService.writeTextToFile.mockResolvedValue(undefined);
    mockFileSystemService.deleteFile.mockResolvedValue(undefined);
    mockFileOperationsService.validateFile.mockResolvedValue({ valid: true });
    
    // Mock the static utility methods
    mockFileOperationsService.getFileExtension.mockImplementation((fileType: string) => {
      switch (fileType) {
        case 'settings': return 'json';
        case 'memory':
        case 'command': return 'md';
        default: return 'txt';
      }
    });
    
    mockFileOperationsService.getDefaultFileName.mockImplementation((fileType: string) => {
      switch (fileType) {
        case 'memory': return 'CLAUDE.md';
        case 'settings': return 'settings.json';
        case 'command': return 'new-command.md';
        default: return 'new-file.txt';
      }
    });
  });

  describe('createFile', () => {
    const baseOptions: CreateFileOptions = {
      fileType: 'command',
      fileName: 'test-command.md',
      directoryPath: '/project/.claude/commands',
      templateOptions: {
        name: 'test-command',
        namespace: 'project'
      }
    };

    it('should handle string template content', async () => {
      const markdownContent = '# Test Command\n\nThis is a test command.';
      mockFileOperationsService.createTemplate.mockResolvedValue({
        fileType: 'command',
        template: markdownContent
      });

      const result = await FileCRUDService.createFile(baseOptions);

      expect(result.success).toBe(true);
      expect(mockFileSystemService.writeTextToFile).toHaveBeenCalledWith(
        '/project/.claude/commands/test-command.md',
        markdownContent
      );
      expect(result.data?.content).toBe(markdownContent);
    });

    it('should extract content from structured template object', async () => {
      const markdownContent = '---\ndescription: test command\n---\n\n# Test Command\n\nThis is a test command.';
      const structuredTemplate = {
        content: markdownContent,
        path: 'test-command.md',
        type: 'command',
        metadata: {
          isTemplate: true,
          commandName: 'test-command',
          namespace: 'project',
          createdAt: '2025-07-19T17:32:00.584Z'
        }
      };

      mockFileOperationsService.createTemplate.mockResolvedValue({
        fileType: 'command',
        template: structuredTemplate as any
      });

      const result = await FileCRUDService.createFile(baseOptions);

      expect(result.success).toBe(true);
      expect(mockFileSystemService.writeTextToFile).toHaveBeenCalledWith(
        '/project/.claude/commands/test-command.md',
        markdownContent
      );
      expect(result.data?.content).toBe(markdownContent);
    });

    it('should fall back to JSON stringification for objects without content field', async () => {
      const templateObject = {
        title: 'Test Command',
        description: 'A test command',
        commands: ['echo hello']
      };

      mockFileOperationsService.createTemplate.mockResolvedValue({
        fileType: 'command',
        template: templateObject as any
      });

      const result = await FileCRUDService.createFile(baseOptions);

      expect(result.success).toBe(true);
      const expectedContent = JSON.stringify(templateObject, null, 2);
      expect(mockFileSystemService.writeTextToFile).toHaveBeenCalledWith(
        '/project/.claude/commands/test-command.md',
        expectedContent
      );
      expect(result.data?.content).toBe(expectedContent);
    });

    it('should handle non-object template values', async () => {
      mockFileOperationsService.createTemplate.mockResolvedValue({
        fileType: 'command',
        template: 123 as any
      });

      const result = await FileCRUDService.createFile(baseOptions);

      expect(result.success).toBe(true);
      expect(mockFileSystemService.writeTextToFile).toHaveBeenCalledWith(
        '/project/.claude/commands/test-command.md',
        '123'
      );
      expect(result.data?.content).toBe('123');
    });

    it('should handle null template values', async () => {
      mockFileOperationsService.createTemplate.mockResolvedValue({
        fileType: 'command',
        template: null as any
      });

      const result = await FileCRUDService.createFile(baseOptions);

      expect(result.success).toBe(true);
      expect(mockFileSystemService.writeTextToFile).toHaveBeenCalledWith(
        '/project/.claude/commands/test-command.md',
        'null'
      );
      expect(result.data?.content).toBe('null');
    });

    it('should handle object template with non-string content field', async () => {
      const templateObject = {
        content: { nested: 'object' },
        metadata: { isTemplate: true }
      };

      mockFileOperationsService.createTemplate.mockResolvedValue({
        fileType: 'command',
        template: templateObject as any
      });

      const result = await FileCRUDService.createFile(baseOptions);

      expect(result.success).toBe(true);
      const expectedContent = JSON.stringify(templateObject, null, 2);
      expect(mockFileSystemService.writeTextToFile).toHaveBeenCalledWith(
        '/project/.claude/commands/test-command.md',
        expectedContent
      );
      expect(result.data?.content).toBe(expectedContent);
    });

    it('should return error when file already exists', async () => {
      mockFileSystemService.fileExists.mockResolvedValue(true);

      const result = await FileCRUDService.createFile(baseOptions);

      expect(result.success).toBe(false);
      expect(result.message).toBe('File already exists');
      expect(result.error).toContain('test-command.md already exists');
      expect(mockFileSystemService.writeTextToFile).not.toHaveBeenCalled();
    });

    it('should add .md extension for command files without extension', async () => {
      const optionsWithoutExtension = {
        ...baseOptions,
        fileName: 'test-command'
      };

      mockFileOperationsService.createTemplate.mockResolvedValue({
        fileType: 'command',
        template: '# Test Command'
      });

      const result = await FileCRUDService.createFile(optionsWithoutExtension);

      expect(result.success).toBe(true);
      expect(mockFileSystemService.writeTextToFile).toHaveBeenCalledWith(
        '/project/.claude/commands/test-command.md',
        '# Test Command'
      );
      expect(result.data?.name).toBe('test-command.md');
    });

    it('should generate default filename when none provided', async () => {
      const optionsWithoutFilename = {
        ...baseOptions,
        fileName: undefined
      };

      mockFileOperationsService.createTemplate.mockResolvedValue({
        fileType: 'command',
        template: '# New Command'
      });

      const result = await FileCRUDService.createFile(optionsWithoutFilename);

      expect(result.success).toBe(true);
      expect(mockFileSystemService.writeTextToFile).toHaveBeenCalledWith(
        '/project/.claude/commands/new-command.md',
        '# New Command'
      );
      expect(result.data?.name).toBe('new-command.md');
    });

    it('should handle FileOperationsService errors', async () => {
      mockFileOperationsService.createTemplate.mockRejectedValue(
        new Error('Template service unavailable')
      );

      const result = await FileCRUDService.createFile(baseOptions);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to create file');
      expect(result.error).toContain('Template service unavailable');
      expect(mockFileSystemService.writeTextToFile).not.toHaveBeenCalled();
    });

    it('should handle FileSystemService write errors', async () => {
      mockFileOperationsService.createTemplate.mockResolvedValue({
        fileType: 'command',
        template: '# Test Command'
      });
      mockFileSystemService.writeTextToFile.mockRejectedValue(
        new Error('Permission denied')
      );

      const result = await FileCRUDService.createFile(baseOptions);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to create file');
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('memory files', () => {
    it('should handle memory file creation with string template', async () => {
      const memoryContent = '# Project Memory\n\nThis is the project memory file.';
      mockFileOperationsService.createTemplate.mockResolvedValue({
        fileType: 'memory',
        template: memoryContent
      });

      const options: CreateFileOptions = {
        fileType: 'memory',
        fileName: 'CLAUDE.md',
        directoryPath: '/project',
        templateOptions: {}
      };

      const result = await FileCRUDService.createFile(options);

      expect(result.success).toBe(true);
      expect(mockFileSystemService.writeTextToFile).toHaveBeenCalledWith(
        '/project/CLAUDE.md',
        memoryContent
      );
    });
  });

  describe('settings files', () => {
    it('should handle settings file creation with object template', async () => {
      const settingsContent = '{\n  "hooks": {},\n  "preferences": {}\n}';
      const structuredTemplate = {
        content: settingsContent,
        type: 'settings',
        metadata: {
          isTemplate: true,
          type: 'project'
        }
      };

      mockFileOperationsService.createTemplate.mockResolvedValue({
        fileType: 'settings',
        template: structuredTemplate as any
      });

      const options: CreateFileOptions = {
        fileType: 'settings',
        fileName: 'settings.json',
        directoryPath: '/project/.claude',
        templateOptions: { type: 'project' }
      };

      const result = await FileCRUDService.createFile(options);

      expect(result.success).toBe(true);
      expect(mockFileSystemService.writeTextToFile).toHaveBeenCalledWith(
        '/project/.claude/settings.json',
        settingsContent
      );
    });
  });

  describe('deleteFile', () => {
    const testFilePath = '/project/.claude/commands/test-command.md';

    it('should successfully delete an existing file', async () => {
      mockFileSystemService.fileExists.mockResolvedValue(true);
      mockFileSystemService.deleteFile.mockResolvedValue(undefined);

      const result = await FileCRUDService.deleteFile(testFilePath);

      expect(result.success).toBe(true);
      expect(result.message).toBe('File deleted successfully');
      expect(result.data?.path).toBe(testFilePath);
      expect(result.data?.name).toBe('test-command.md');
      expect(mockFileSystemService.deleteFile).toHaveBeenCalledWith(testFilePath);
    });

    it('should return error when file does not exist', async () => {
      mockFileSystemService.fileExists.mockResolvedValue(false);

      const result = await FileCRUDService.deleteFile(testFilePath);

      expect(result.success).toBe(false);
      expect(result.message).toBe('File not found');
      expect(result.error).toBe(`File ${testFilePath} does not exist`);
      expect(mockFileSystemService.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle file system service errors during existence check', async () => {
      mockFileSystemService.fileExists.mockRejectedValue(new Error('Permission denied'));

      const result = await FileCRUDService.deleteFile(testFilePath);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to delete file');
      expect(result.error).toContain('Permission denied');
      expect(mockFileSystemService.deleteFile).not.toHaveBeenCalled();
    });

    it('should handle file system service errors during deletion', async () => {
      mockFileSystemService.fileExists.mockResolvedValue(true);
      mockFileSystemService.deleteFile.mockRejectedValue(new Error('File is locked'));

      const result = await FileCRUDService.deleteFile(testFilePath);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to delete file');
      expect(result.error).toContain('File is locked');
    });

    it('should extract correct filename from path', async () => {
      mockFileSystemService.fileExists.mockResolvedValue(true);
      mockFileSystemService.deleteFile.mockResolvedValue(undefined);

      const deepPath = '/very/deep/path/to/file/settings.json';
      const result = await FileCRUDService.deleteFile(deepPath);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('settings.json');
      expect(result.data?.path).toBe(deepPath);
    });

    it('should handle paths without filename gracefully', async () => {
      mockFileSystemService.fileExists.mockResolvedValue(true);
      mockFileSystemService.deleteFile.mockResolvedValue(undefined);

      const pathWithoutFile = '/path/ending/with/slash/';
      const result = await FileCRUDService.deleteFile(pathWithoutFile);

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('');
      expect(result.data?.path).toBe(pathWithoutFile);
    });
  });
});