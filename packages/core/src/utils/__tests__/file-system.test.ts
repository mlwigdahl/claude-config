/**
 * Tests for FileSystemUtils
 */

import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import { ConsolidatedFileSystem } from '../consolidated-filesystem.js';
import { FileSystemUtils } from '../file-system.js';
import { ApplicationError, ErrorCode } from '../error-handling.js';

describe('FileSystemUtils', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), 'claude-fs-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
    await ConsolidatedFileSystem.ensureDirectory(testDir);
  });

  afterEach(async () => {
    await ConsolidatedFileSystem.removeDirectory(testDir, true);
  });

  describe('ensureDirectory', () => {
    it('should create directory recursively', async () => {
      const nestedDir = path.join(testDir, 'level1', 'level2', 'level3');
      
      await FileSystemUtils.ensureDirectory(nestedDir);
      
      const exists = await ConsolidatedFileSystem.fileExists(nestedDir);
      expect(exists).toBe(true);
      
      const isDir = await ConsolidatedFileSystem.directoryExists(nestedDir);
      expect(isDir).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      const existingDir = path.join(testDir, 'existing');
      await ConsolidatedFileSystem.ensureDirectory(existingDir);
      
      await expect(FileSystemUtils.ensureDirectory(existingDir)).resolves.not.toThrow();
      
      const exists = await ConsolidatedFileSystem.fileExists(existingDir);
      expect(exists).toBe(true);
    });

    it('should handle permission errors', async () => {
      // Create a directory path that would cause permission issues
      const invalidDir = path.join('/root', 'invalid-permissions');
      
      await expect(FileSystemUtils.ensureDirectory(invalidDir)).rejects.toThrow(ApplicationError);
      
      try {
        await FileSystemUtils.ensureDirectory(invalidDir);
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect((error as ApplicationError).code).toBe(ErrorCode.PERMISSION_DENIED);
      }
    });
  });

  describe('fileExists', () => {
    it('should return true for existing files', async () => {
      const filePath = path.join(testDir, 'test-file.txt');
      await ConsolidatedFileSystem.writeFile(filePath, 'test content');
      
      const exists = await FileSystemUtils.fileExists(filePath);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent files', async () => {
      const filePath = path.join(testDir, 'non-existent.txt');
      
      const exists = await FileSystemUtils.fileExists(filePath);
      expect(exists).toBe(false);
    });

    it('should return true for existing directories', async () => {
      const dirPath = path.join(testDir, 'test-dir');
      await ConsolidatedFileSystem.ensureDirectory(dirPath);
      
      const exists = await FileSystemUtils.fileExists(dirPath);
      expect(exists).toBe(true);
    });

    it('should handle permission errors gracefully', async () => {
      // Test with a path that might have permission issues
      const restrictedPath = path.join('/root', 'restricted-file');
      
      // Should not throw, just return false
      const exists = await FileSystemUtils.fileExists(restrictedPath);
      expect(typeof exists).toBe('boolean');
    });
  });

  describe('isDirectory', () => {
    it('should return true for directories', async () => {
      const dirPath = path.join(testDir, 'test-dir');
      await ConsolidatedFileSystem.ensureDirectory(dirPath);
      
      const isDir = await FileSystemUtils.isDirectory(dirPath);
      expect(isDir).toBe(true);
    });

    it('should return false for files', async () => {
      const filePath = path.join(testDir, 'test-file.txt');
      await ConsolidatedFileSystem.writeFile(filePath, 'test content');
      
      const isDir = await FileSystemUtils.isDirectory(filePath);
      expect(isDir).toBe(false);
    });

    it('should return false for non-existent paths', async () => {
      const nonExistentPath = path.join(testDir, 'non-existent');
      
      const isDir = await FileSystemUtils.isDirectory(nonExistentPath);
      expect(isDir).toBe(false);
    });

    it('should handle permission errors gracefully', async () => {
      const restrictedPath = path.join('/root', 'restricted-dir');
      
      // Should not throw, just return false
      const isDir = await FileSystemUtils.isDirectory(restrictedPath);
      expect(typeof isDir).toBe('boolean');
    });
  });

  describe('getFileStats', () => {
    it('should return file stats for existing files', async () => {
      const filePath = path.join(testDir, 'test-file.txt');
      const content = 'test content';
      await ConsolidatedFileSystem.writeFile(filePath, content);
      
      const stats = await FileSystemUtils.getFileStats(filePath);
      
      expect(stats).not.toBeNull();
      expect(stats!.size).toBe(content.length + 1);
      expect(typeof stats!.lastModified.getTime).toBe('function');
      expect(stats!.lastModified.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should return null for non-existent files', async () => {
      const filePath = path.join(testDir, 'non-existent.txt');
      
      const stats = await FileSystemUtils.getFileStats(filePath);
      expect(stats).toBeNull();
    });

    it('should handle permission errors gracefully', async () => {
      const restrictedPath = path.join('/root', 'restricted-file');
      
      // Should not throw, just return null
      const stats = await FileSystemUtils.getFileStats(restrictedPath);
      expect(stats).toBeNull();
    });
  });

  describe('readFileContent', () => {
    it('should read file content as UTF-8', async () => {
      const filePath = path.join(testDir, 'test-file.txt');
      const content = 'Hello, world! 🌍';
      await fs.writeFile(filePath, content, 'utf-8');
      
      const readContent = await FileSystemUtils.readFileContent(filePath);
      expect(readContent).toBe(content);
    });

    it('should throw FILE_NOT_FOUND for missing files', async () => {
      const filePath = path.join(testDir, 'non-existent.txt');
      
      await expect(FileSystemUtils.readFileContent(filePath)).rejects.toThrow(ApplicationError);
      
      try {
        await FileSystemUtils.readFileContent(filePath);
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect((error as ApplicationError).code).toBe(ErrorCode.FILE_NOT_FOUND);
        expect((error as ApplicationError).filePath).toBe(filePath);
      }
    });

    it('should throw PERMISSION_DENIED for access errors', async () => {
      const filePath = path.join(testDir, 'restricted-file.txt');
      await ConsolidatedFileSystem.writeFile(filePath, 'content');
      
      // Make file unreadable (skip on Windows)
      if (process.platform !== 'win32') {
        await fs.chmod(filePath, 0o000);
        
        await expect(FileSystemUtils.readFileContent(filePath)).rejects.toThrow(ApplicationError);
        
        try {
          await FileSystemUtils.readFileContent(filePath);
        } catch (error) {
          expect(error).toBeInstanceOf(ApplicationError);
          expect((error as ApplicationError).code).toBe(ErrorCode.PERMISSION_DENIED);
        }
        
        // Restore permissions for cleanup
        await fs.chmod(filePath, 0o644);
      }
    });
  });

  describe('writeFileContent', () => {
    it('should write content to file', async () => {
      const filePath = path.join(testDir, 'test-file.txt');
      const content = 'Hello, world! 🌍';
      
      await FileSystemUtils.writeFileContent(filePath, content);
      
      const readContent = await ConsolidatedFileSystem.readFile(filePath);
      expect(readContent).toBe(content + '\n');
    });

    it('should create parent directories', async () => {
      const filePath = path.join(testDir, 'nested', 'deep', 'file.txt');
      const content = 'nested content';
      
      await FileSystemUtils.writeFileContent(filePath, content);
      
      const readContent = await ConsolidatedFileSystem.readFile(filePath);
      expect(readContent).toBe(content + '\n');
      
      // Verify parent directories were created
      const parentDir = path.dirname(filePath);
      const stats = await ConsolidatedFileSystem.getFileStats(parentDir);
      expect(stats.isDirectory).toBe(true);
    });

    it('should handle overwrite option', async () => {
      const filePath = path.join(testDir, 'test-file.txt');
      const originalContent = 'original content';
      const newContent = 'new content';
      
      await ConsolidatedFileSystem.writeFile(filePath, originalContent);
      
      await FileSystemUtils.writeFileContent(filePath, newContent, { overwrite: true });
      
      const readContent = await ConsolidatedFileSystem.readFile(filePath);
      expect(readContent).toBe(newContent + '\n');
    });

    it('should throw FILE_EXISTS without overwrite', async () => {
      const filePath = path.join(testDir, 'test-file.txt');
      const originalContent = 'original content';
      const newContent = 'new content';
      
      await ConsolidatedFileSystem.writeFile(filePath, originalContent);
      
      await expect(
        FileSystemUtils.writeFileContent(filePath, newContent, { overwrite: false })
      ).rejects.toThrow(ApplicationError);
      
      try {
        await FileSystemUtils.writeFileContent(filePath, newContent, { overwrite: false });
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect((error as ApplicationError).code).toBe(ErrorCode.FILE_ALREADY_EXISTS);
      }
    });

    it('should handle permission errors', async () => {
      // Create a read-only directory
      const readOnlyDir = path.join(testDir, 'readonly');
      await ConsolidatedFileSystem.ensureDirectory(readOnlyDir);
      
      if (process.platform !== 'win32') {
        await fs.chmod(readOnlyDir, 0o444);
        
        const filePath = path.join(readOnlyDir, 'test-file.txt');
        
        await expect(
          FileSystemUtils.writeFileContent(filePath, 'content')
        ).rejects.toThrow(ApplicationError);
        
        try {
          await FileSystemUtils.writeFileContent(filePath, 'content');
        } catch (error) {
          expect(error).toBeInstanceOf(ApplicationError);
          expect((error as ApplicationError).code).toBe(ErrorCode.PERMISSION_DENIED);
        }
        
        // Restore permissions for cleanup
        await fs.chmod(readOnlyDir, 0o755);
      }
    });
  });

  describe('moveFile', () => {
    it('should move file to new location', async () => {
      const sourcePath = path.join(testDir, 'source.txt');
      const targetPath = path.join(testDir, 'target.txt');
      const content = 'file content';
      
      await ConsolidatedFileSystem.writeFile(sourcePath, content);
      
      await FileSystemUtils.moveFile(sourcePath, targetPath);
      
      // Source should no longer exist
      const sourceExists = await ConsolidatedFileSystem.fileExists(sourcePath);
      expect(sourceExists).toBe(false);
      
      // Target should exist with correct content
      const targetContent = await ConsolidatedFileSystem.readFile(targetPath);
      expect(targetContent).toBe(content + '\n');
    });

    it('should create target directory', async () => {
      const sourcePath = path.join(testDir, 'source.txt');
      const targetPath = path.join(testDir, 'nested', 'target.txt');
      const content = 'file content';
      
      await ConsolidatedFileSystem.writeFile(sourcePath, content);
      
      await FileSystemUtils.moveFile(sourcePath, targetPath);
      
      const targetContent = await ConsolidatedFileSystem.readFile(targetPath);
      expect(targetContent).toBe(content + '\n');
      
      // Verify target directory was created
      const targetDir = path.dirname(targetPath);
      const stats = await ConsolidatedFileSystem.getFileStats(targetDir);
      expect(stats.isDirectory).toBe(true);
    });

    it('should handle overwrite option', async () => {
      const sourcePath = path.join(testDir, 'source.txt');
      const targetPath = path.join(testDir, 'target.txt');
      const sourceContent = 'source content';
      const targetContent = 'target content';
      
      await ConsolidatedFileSystem.writeFile(sourcePath, sourceContent);
      await ConsolidatedFileSystem.writeFile(targetPath, targetContent);
      
      await FileSystemUtils.moveFile(sourcePath, targetPath, { overwrite: true });
      
      const finalContent = await ConsolidatedFileSystem.readFile(targetPath);
      expect(finalContent).toBe(sourceContent + '\n');
    });

    it('should throw FILE_NOT_FOUND for missing source', async () => {
      const sourcePath = path.join(testDir, 'non-existent.txt');
      const targetPath = path.join(testDir, 'target.txt');
      
      await expect(
        FileSystemUtils.moveFile(sourcePath, targetPath)
      ).rejects.toThrow(ApplicationError);
      
      try {
        await FileSystemUtils.moveFile(sourcePath, targetPath);
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect((error as ApplicationError).code).toBe(ErrorCode.FILE_NOT_FOUND);
      }
    });

    it('should throw FILE_EXISTS for existing target without overwrite', async () => {
      const sourcePath = path.join(testDir, 'source.txt');
      const targetPath = path.join(testDir, 'target.txt');
      
      await fs.writeFile(sourcePath, 'source content');
      await fs.writeFile(targetPath, 'target content');
      
      await expect(
        FileSystemUtils.moveFile(sourcePath, targetPath, { overwrite: false })
      ).rejects.toThrow(ApplicationError);
      
      try {
        await FileSystemUtils.moveFile(sourcePath, targetPath, { overwrite: false });
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect((error as ApplicationError).code).toBe(ErrorCode.FILE_ALREADY_EXISTS);
      }
    });

    it('should handle permission errors', async () => {
      const sourcePath = path.join(testDir, 'source.txt');
      const targetPath = path.join('/root', 'target.txt');
      
      await ConsolidatedFileSystem.writeFile(sourcePath, 'content');
      
      await expect(
        FileSystemUtils.moveFile(sourcePath, targetPath)
      ).rejects.toThrow(ApplicationError);
      
      try {
        await FileSystemUtils.moveFile(sourcePath, targetPath);
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect((error as ApplicationError).code).toBe(ErrorCode.PERMISSION_DENIED);
      }
    });
  });

  describe('deleteFile', () => {
    it('should delete existing file', async () => {
      const filePath = path.join(testDir, 'test-file.txt');
      await ConsolidatedFileSystem.writeFile(filePath, 'content');
      
      await FileSystemUtils.deleteFile(filePath);
      
      const exists = await ConsolidatedFileSystem.fileExists(filePath);
      expect(exists).toBe(false);
    });

    it('should throw FILE_NOT_FOUND for missing file', async () => {
      const filePath = path.join(testDir, 'non-existent.txt');
      
      await expect(FileSystemUtils.deleteFile(filePath)).rejects.toThrow(ApplicationError);
      
      try {
        await FileSystemUtils.deleteFile(filePath);
      } catch (error) {
        expect(error).toBeInstanceOf(ApplicationError);
        expect((error as ApplicationError).code).toBe(ErrorCode.FILE_NOT_FOUND);
      }
    });

    it('should handle permission errors', async () => {
      const filePath = path.join(testDir, 'protected-file.txt');
      await ConsolidatedFileSystem.writeFile(filePath, 'content');
      
      if (process.platform !== 'win32') {
        // Make the directory read-only to prevent deletion
        await fs.chmod(testDir, 0o555); // Read and execute, but no write
        
        await expect(FileSystemUtils.deleteFile(filePath)).rejects.toThrow(ApplicationError);
        
        try {
          await FileSystemUtils.deleteFile(filePath);
        } catch (error) {
          expect(error).toBeInstanceOf(ApplicationError);
          expect((error as ApplicationError).code).toBe(ErrorCode.PERMISSION_DENIED);
        }
        
        // Restore permissions for cleanup
        await fs.chmod(testDir, 0o755);
      }
    });
  });

  describe('findFiles', () => {
    beforeEach(async () => {
      // Create test file structure
      const files = [
        'file1.txt',
        'file2.md',
        'file3.json',
        'nested/file4.txt',
        'nested/file5.md',
        'nested/deep/file6.txt'
      ];
      
      for (const file of files) {
        const filePath = path.join(testDir, file);
        await ConsolidatedFileSystem.ensureDirectory(path.dirname(filePath));
        await ConsolidatedFileSystem.writeFile(filePath, `content of ${file}`);
      }
    });

    it('should find files matching pattern', async () => {
      const pattern = /\.txt$/;
      const results = await FileSystemUtils.findFiles(testDir, pattern);
      
      expect(results).toHaveLength(3);
      expect(results.every(file => file.endsWith('.txt'))).toBe(true);
      expect(results.some(file => file.includes('file1.txt'))).toBe(true);
      expect(results.some(file => file.includes('file4.txt'))).toBe(true);
      expect(results.some(file => file.includes('file6.txt'))).toBe(true);
    });

    it('should handle recursive search', async () => {
      const pattern = /\.md$/;
      const results = await FileSystemUtils.findFiles(testDir, pattern, true);
      
      expect(results).toHaveLength(2);
      expect(results.every(file => file.endsWith('.md'))).toBe(true);
      expect(results.some(file => file.includes('file2.md'))).toBe(true);
      expect(results.some(file => file.includes('file5.md'))).toBe(true);
    });

    it('should handle non-recursive search', async () => {
      const pattern = /\.txt$/;
      const results = await FileSystemUtils.findFiles(testDir, pattern, false);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toMatch(/file1\.txt$/);
    });

    it('should return empty array for non-existent directory', async () => {
      const nonExistentDir = path.join(testDir, 'non-existent');
      const pattern = /\.txt$/;
      
      const results = await FileSystemUtils.findFiles(nonExistentDir, pattern);
      expect(results).toEqual([]);
    });

    it('should handle permission errors gracefully', async () => {
      const pattern = /\.txt$/;
      const restrictedDir = path.join('/root', 'restricted');
      
      // Should not throw, just return empty array
      const results = await FileSystemUtils.findFiles(restrictedDir, pattern);
      expect(results).toEqual([]);
    });
  });

  describe('resolvePath', () => {
    it('should resolve relative paths', async () => {
      const basePath = '/home/user/project';
      const relativePath = '../other/file.txt';
      
      const resolved = FileSystemUtils.resolvePath(basePath, relativePath);
      expect(resolved).toBe(path.resolve(basePath, relativePath));
    });

    it('should handle absolute paths', async () => {
      const basePath = '/home/user/project';
      const absolutePath = '/absolute/path/file.txt';
      
      const resolved = FileSystemUtils.resolvePath(basePath, absolutePath);
      expect(resolved).toBe(path.resolve(basePath, absolutePath));
    });
  });

  describe('getRelativePath', () => {
    it('should return relative path between two paths', async () => {
      const from = '/home/user/project';
      const to = '/home/user/project/src/file.txt';
      
      const relative = FileSystemUtils.getRelativePath(from, to);
      expect(relative).toBe('src/file.txt');
    });

    it('should handle paths in different directories', async () => {
      const from = '/home/user/project1';
      const to = '/home/user/project2/file.txt';
      
      const relative = FileSystemUtils.getRelativePath(from, to);
      expect(relative).toBe('../project2/file.txt');
    });
  });

  describe('isValidFileName', () => {
    it('should validate normal filenames', async () => {
      expect(FileSystemUtils.isValidFileName('normal-file.txt')).toBe(true);
      expect(FileSystemUtils.isValidFileName('file_with_underscores.md')).toBe(true);
      expect(FileSystemUtils.isValidFileName('file123.json')).toBe(true);
      expect(FileSystemUtils.isValidFileName('file.with.dots.txt')).toBe(true);
    });

    it('should reject filenames with invalid characters', async () => {
      expect(FileSystemUtils.isValidFileName('file<name>.txt')).toBe(false);
      expect(FileSystemUtils.isValidFileName('file>name.txt')).toBe(false);
      expect(FileSystemUtils.isValidFileName('file:name.txt')).toBe(false);
      expect(FileSystemUtils.isValidFileName('file"name.txt')).toBe(false);
      expect(FileSystemUtils.isValidFileName('file|name.txt')).toBe(false);
      expect(FileSystemUtils.isValidFileName('file?name.txt')).toBe(false);
      expect(FileSystemUtils.isValidFileName('file*name.txt')).toBe(false);
      expect(FileSystemUtils.isValidFileName('file\x00name.txt')).toBe(false);
    });

    it('should reject reserved names', async () => {
      expect(FileSystemUtils.isValidFileName('CON')).toBe(false);
      expect(FileSystemUtils.isValidFileName('PRN')).toBe(false);
      expect(FileSystemUtils.isValidFileName('AUX')).toBe(false);
      expect(FileSystemUtils.isValidFileName('NUL')).toBe(false);
      expect(FileSystemUtils.isValidFileName('COM1')).toBe(false);
      expect(FileSystemUtils.isValidFileName('COM9')).toBe(false);
      expect(FileSystemUtils.isValidFileName('LPT1')).toBe(false);
      expect(FileSystemUtils.isValidFileName('LPT9')).toBe(false);
      expect(FileSystemUtils.isValidFileName('con')).toBe(false); // Case insensitive
    });

    it('should reject empty filenames', async () => {
      expect(FileSystemUtils.isValidFileName('')).toBe(false);
    });

    it('should reject filenames starting or ending with dots', async () => {
      expect(FileSystemUtils.isValidFileName('.hidden-file')).toBe(false);
      expect(FileSystemUtils.isValidFileName('file-ending.')).toBe(false);
      expect(FileSystemUtils.isValidFileName('.both.')).toBe(false);
    });

    it('should reject filenames over 255 characters', async () => {
      const longName = 'a'.repeat(256);
      expect(FileSystemUtils.isValidFileName(longName)).toBe(false);
      
      const exactLimit = 'a'.repeat(255);
      expect(FileSystemUtils.isValidFileName(exactLimit)).toBe(true);
    });
  });
});