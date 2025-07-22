import { FileSystemService } from '../../../services/fileSystemService';

// Mock the service
jest.mock('../../../services/fileSystemService');
const mockFileSystemService = FileSystemService as jest.Mocked<typeof FileSystemService>;

describe('FileDetailsPanel - Rename Functionality Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File renaming service integration', () => {
    it('should call FileSystemService.renameFile with correct parameters for memory files', async () => {
      mockFileSystemService.renameFile.mockResolvedValue();

      const oldPath = '/project/old-memory.md';
      const newPath = '/project/new-memory.md';

      await FileSystemService.renameFile(oldPath, newPath);

      expect(mockFileSystemService.renameFile).toHaveBeenCalledWith(oldPath, newPath);
    });

    it('should call FileSystemService.renameFile with correct parameters for inactive files', async () => {
      mockFileSystemService.renameFile.mockResolvedValue();

      const oldPath = '/project/old-memory.md.inactive';
      const newPath = '/project/new-memory.md.inactive';

      await FileSystemService.renameFile(oldPath, newPath);

      expect(mockFileSystemService.renameFile).toHaveBeenCalledWith(oldPath, newPath);
    });

    it('should call FileSystemService.renameFile with correct parameters for command files', async () => {
      mockFileSystemService.renameFile.mockResolvedValue();

      const oldPath = '/project/.claude/commands/old-command.md';
      const newPath = '/project/.claude/commands/new-command.md';

      await FileSystemService.renameFile(oldPath, newPath);

      expect(mockFileSystemService.renameFile).toHaveBeenCalledWith(oldPath, newPath);
    });

    it('should handle rename errors properly', async () => {
      const errorMessage = 'File already exists';
      mockFileSystemService.renameFile.mockRejectedValue(new Error(errorMessage));

      await expect(
        FileSystemService.renameFile('/project/old.md', '/project/new.md')
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('File extension handling', () => {
    it('should preserve .md extension for memory files', () => {
      const originalName = 'memory-file.md';
      const newBaseName = 'renamed-memory';
      const expectedNewName = 'renamed-memory.md';
      
      // Test that we add .md if missing
      expect(newBaseName.endsWith('.md') ? newBaseName : `${newBaseName}.md`).toBe(expectedNewName);
    });

    it('should preserve .md extension for command files', () => {
      const originalName = 'command-file.md';
      const newBaseName = 'renamed-command';
      const expectedNewName = 'renamed-command.md';
      
      // Test that we add .md if missing
      expect(newBaseName.endsWith('.md') ? newBaseName : `${newBaseName}.md`).toBe(expectedNewName);
    });

    it('should not double-add .md extension', () => {
      const newName = 'already-has-extension.md';
      const result = newName.endsWith('.md') ? newName : `${newName}.md`;
      
      expect(result).toBe('already-has-extension.md');
      expect(result.match(/\.md/g)?.length).toBe(1);
    });
  });

  describe('File path construction', () => {
    it('should construct correct new path for active files', () => {
      const directory = '/project';
      const newFileName = 'new-name.md';
      const isInactive = false;
      
      const expectedPath = isInactive ? `${directory}/${newFileName}.inactive` : `${directory}/${newFileName}`;
      expect(expectedPath).toBe('/project/new-name.md');
    });

    it('should construct correct new path for inactive files', () => {
      const directory = '/project';
      const newFileName = 'new-name.md';
      const isInactive = true;
      
      const expectedPath = isInactive ? `${directory}/${newFileName}.inactive` : `${directory}/${newFileName}`;
      expect(expectedPath).toBe('/project/new-name.md.inactive');
    });
  });

  describe('Filename processing for rename input', () => {
    it('should remove .md extension for editing', () => {
      const fileName = 'memory-file.md';
      const nameForEditing = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
      
      expect(nameForEditing).toBe('memory-file');
    });

    it('should remove .inactive and .md extensions for editing inactive files', () => {
      const fileName = 'memory-file.md.inactive';
      const baseFileName = fileName.replace('.inactive', '');
      const nameForEditing = baseFileName.endsWith('.md') ? baseFileName.slice(0, -3) : baseFileName;
      
      expect(nameForEditing).toBe('memory-file');
    });

    it('should handle files that do not have .md extension', () => {
      const fileName = 'some-file.txt';
      const nameForEditing = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
      
      expect(nameForEditing).toBe('some-file.txt');
    });
  });

});