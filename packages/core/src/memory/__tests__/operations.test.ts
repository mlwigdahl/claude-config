import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { MemoryFileOperations } from '../operations.js';
import { ErrorCode } from '../../utils/error-handling.js';

describe('MemoryFileOperations', () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-config-test-'));
    projectRoot = tempDir;
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('createMemoryFile', () => {
    it('should create a valid memory file', async () => {
      const content = '# Test Memory\n\nThis is a test memory file.';
      const result = await MemoryFileOperations.createMemoryFile(
        projectRoot,
        'CLAUDE.md',
        content
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('created successfully');
      expect(result.filePath).toBeDefined();

      // Verify file was created
      const filePath = path.join(projectRoot, 'CLAUDE.md');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify content
      const savedContent = await fs.readFile(filePath, 'utf-8');
      expect(savedContent).toBe(content + '\n');
    });

    it('should fail with invalid file name', async () => {
      const content = '# Test Memory';
      const result = await MemoryFileOperations.createMemoryFile(
        projectRoot,
        'invalid-name.md',
        content
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PATH);
    });

    it('should fail when file already exists without overwrite', async () => {
      const content = '# Test Memory';
      const filePath = path.join(projectRoot, 'CLAUDE.md');
      await fs.writeFile(filePath, 'existing content');

      const result = await MemoryFileOperations.createMemoryFile(
        projectRoot,
        'CLAUDE.md',
        content
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.FILE_ALREADY_EXISTS);
    });

    it('should overwrite existing file when overwrite option is true', async () => {
      const content = '# Test Memory';
      const filePath = path.join(projectRoot, 'CLAUDE.md');
      await fs.writeFile(filePath, 'existing content');

      const result = await MemoryFileOperations.createMemoryFile(
        projectRoot,
        'CLAUDE.md',
        content,
        { overwrite: true }
      );

      expect(result.success).toBe(true);
      
      // Verify content was overwritten
      const savedContent = await fs.readFile(filePath, 'utf-8');
      expect(savedContent).toBe(content + '\n');
    });

    it('should validate content when validateContent option is true', async () => {
      const invalidContent = ''; // Empty content
      const result = await MemoryFileOperations.createMemoryFile(
        projectRoot,
        'CLAUDE.md',
        invalidContent,
        { validateContent: true }
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_CONTENT);
    });

    it('should perform dry run without creating file', async () => {
      const content = '# Test Memory';
      const result = await MemoryFileOperations.createMemoryFile(
        projectRoot,
        'CLAUDE.md',
        content,
        { dryRun: true }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Dry run');

      // Verify file was not created
      const filePath = path.join(projectRoot, 'CLAUDE.md');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });
  });

  describe('updateMemoryFile', () => {
    beforeEach(async () => {
      // Create initial memory file
      const initialContent = '# Initial Memory\n\nInitial content.';
      await fs.writeFile(path.join(projectRoot, 'CLAUDE.md'), initialContent);
    });

    it('should update existing memory file', async () => {
      const newContent = '# Updated Memory\n\nUpdated content.';
      const result = await MemoryFileOperations.updateMemoryFile(
        projectRoot,
        'CLAUDE.md',
        newContent
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('updated successfully');

      // Verify content was updated
      const filePath = path.join(projectRoot, 'CLAUDE.md');
      const savedContent = await fs.readFile(filePath, 'utf-8');
      expect(savedContent).toBe(newContent + '\n');
    });

    it('should fail when file does not exist', async () => {
      const result = await MemoryFileOperations.updateMemoryFile(
        projectRoot,
        'nonexistent.md',
        'content'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PATH);
    });

    it('should preserve imports when preserveImports option is true', async () => {
      // Create file with imports
      const contentWithImports = '@some-import.md\n\n# Memory\n\nContent.';
      await fs.writeFile(path.join(projectRoot, 'CLAUDE.md'), contentWithImports);

      const newContent = '# Updated Memory\n\nNew content without imports.';
      const result = await MemoryFileOperations.updateMemoryFile(
        projectRoot,
        'CLAUDE.md',
        newContent,
        { preserveImports: true }
      );

      expect(result.success).toBe(true);

      // Verify imports were preserved
      const filePath = path.join(projectRoot, 'CLAUDE.md');
      const savedContent = await fs.readFile(filePath, 'utf-8');
      expect(savedContent).toContain('@some-import.md');
      expect(savedContent).toContain('# Updated Memory');
    });
  });

  describe('moveMemoryFile', () => {
    beforeEach(async () => {
      // Create initial memory file
      const content = '# Memory File\n\nContent to move.';
      await fs.writeFile(path.join(projectRoot, 'CLAUDE.md'), content);
    });

    it('should move memory file to new location', async () => {
      // For simplicity, let's test moving to user directory
      const userClaudeDir = path.join(os.homedir(), '.claude');
      await fs.mkdir(userClaudeDir, { recursive: true });
      const targetPath = path.join(userClaudeDir, 'CLAUDE.md');
      
      // Remove any existing file
      try {
        await fs.unlink(targetPath);
      } catch {
        // File doesn't exist, that's fine
      }

      const result = await MemoryFileOperations.moveMemoryFile(
        projectRoot,
        'CLAUDE.md',
        path.relative(projectRoot, targetPath),
        { overwrite: true }
      );

      if (!result.success) {
        console.log('Move failed:', result.message, result.error);
      }
      expect(result.success).toBe(true);
      expect(result.message).toContain('moved successfully');

      // Verify source file was moved
      const sourcePath = path.join(projectRoot, 'CLAUDE.md');
      const sourceExists = await fs.access(sourcePath).then(() => true).catch(() => false);
      expect(sourceExists).toBe(false);

      // Verify target file exists
      const targetExists = await fs.access(targetPath).then(() => true).catch(() => false);
      expect(targetExists).toBe(true);
      
      // Clean up
      try {
        await fs.unlink(targetPath);
      } catch {
        // Cleanup failed, but test passed
      }
    });

    it('should fail when source file does not exist', async () => {
      const result = await MemoryFileOperations.moveMemoryFile(
        projectRoot,
        'nonexistent.md',
        'CLAUDE.md'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PATH);
    });

    it('should fail with invalid target path', async () => {
      const result = await MemoryFileOperations.moveMemoryFile(
        projectRoot,
        'CLAUDE.md',
        'invalid-name.md'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PATH);
    });
  });

  describe('deleteMemoryFile', () => {
    beforeEach(async () => {
      // Create memory file to delete
      const content = '# Memory File\n\nContent to delete.';
      await fs.writeFile(path.join(projectRoot, 'CLAUDE.md'), content);
    });

    it('should delete memory file', async () => {
      const result = await MemoryFileOperations.deleteMemoryFile(
        projectRoot,
        'CLAUDE.md'
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');

      // Verify file was deleted
      const filePath = path.join(projectRoot, 'CLAUDE.md');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });

    it('should fail when file does not exist', async () => {
      const result = await MemoryFileOperations.deleteMemoryFile(
        projectRoot,
        'nonexistent.md'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PATH);
    });

    it('should perform dry run without deleting file', async () => {
      const result = await MemoryFileOperations.deleteMemoryFile(
        projectRoot,
        'CLAUDE.md',
        { dryRun: true }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('Dry run');

      // Verify file still exists
      const filePath = path.join(projectRoot, 'CLAUDE.md');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    });
  });

  describe('getStandardMemoryPaths', () => {
    it('should return correct standard paths', () => {
      const paths = MemoryFileOperations.getStandardMemoryPaths(projectRoot);
      
      expect(paths.project).toBe(path.join(projectRoot, 'CLAUDE.md'));
      expect(paths.user).toBe(path.join(os.homedir(), '.claude', 'CLAUDE.md'));
    });
  });

  describe('getMemoryFileType', () => {
    it('should identify project memory file', () => {
      const filePath = path.join(projectRoot, 'CLAUDE.md');
      const type = MemoryFileOperations.getMemoryFileType(projectRoot, filePath);
      
      expect(type).toBe('project');
    });

    it('should identify user memory file', () => {
      const filePath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
      const type = MemoryFileOperations.getMemoryFileType(projectRoot, filePath);
      
      expect(type).toBe('user');
    });

    it('should identify parent memory file', () => {
      const filePath = path.join(path.dirname(projectRoot), 'CLAUDE.md');
      const type = MemoryFileOperations.getMemoryFileType(projectRoot, filePath);
      
      expect(type).toBe('parent');
    });
  });
});