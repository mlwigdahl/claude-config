/**
 * Tests for base CRUD operations
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MemoryFileOperations } from '../memory.js';
import { SettingsFileOperations } from '../settings.js';
import { CommandFileOperations } from '../commands.js';
import { operations, createOperations } from '../index.js';

describe('Base CRUD Operations', () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-config-base-ops-'));
    projectRoot = path.join(tempDir, 'project');
    await fs.mkdir(projectRoot);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Factory Functions', () => {
    it('should create appropriate operations instances', () => {
      expect(operations.memory).toBeInstanceOf(MemoryFileOperations);
      expect(operations.settings).toBeInstanceOf(SettingsFileOperations);
      expect(operations.command).toBeInstanceOf(CommandFileOperations);
    });

    it('should create operations via factory function', () => {
      expect(createOperations('memory')).toBeInstanceOf(MemoryFileOperations);
      expect(createOperations('settings')).toBeInstanceOf(SettingsFileOperations);
      expect(createOperations('command')).toBeInstanceOf(CommandFileOperations);
    });

    it('should throw error for unknown file type', () => {
      expect(() => createOperations('unknown' as any)).toThrow('Unknown file type: unknown');
    });
  });

  describe('Dry Run Functionality', () => {
    it('should perform dry run for memory operations', async () => {
      const result = await operations.memory.create(
        projectRoot,
        'CLAUDE.md',
        'Test content',
        { dryRun: true }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('dry run');
      
      // File should not exist
      const filePath = path.join(projectRoot, 'CLAUDE.md');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should perform dry run for settings operations', async () => {
      const result = await operations.settings.create(
        projectRoot,
        '.claude/settings.json',
        { permissions: { allow: [] } },
        { dryRun: true }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('dry run');
      
      // File should not exist
      const filePath = path.join(projectRoot, '.claude/settings.json');
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle file not found errors consistently', async () => {
      const memoryResult = await operations.memory.update(
        projectRoot,
        'CLAUDE.md', // Valid memory filename
        'content'
      );
      
      const settingsResult = await operations.settings.update(
        projectRoot,
        '.claude/settings.json', // Valid settings path
        {}
      );

      expect(memoryResult.success).toBe(false);
      expect(settingsResult.success).toBe(false);
      expect(memoryResult.error?.code).toBe('FILE_NOT_FOUND');
      expect(settingsResult.error?.code).toBe('FILE_NOT_FOUND');
    });

    it('should handle invalid paths consistently', async () => {
      const memoryResult = await operations.memory.create(
        projectRoot,
        'invalid-name.md',
        'content'
      );
      
      expect(memoryResult.success).toBe(false);
      expect(memoryResult.error?.code).toBe('INVALID_PATH');
    });
  });

  describe('Backup Functionality', () => {
    it('should create backups when requested', async () => {
      // Create initial file
      const content = 'Initial content';
      const createResult = await operations.memory.create(projectRoot, 'CLAUDE.md', content);
      expect(createResult.success).toBe(true);
      
      // Update with backup
      const result = await operations.memory.update(
        projectRoot,
        'CLAUDE.md',
        'Updated content',
        { backup: true }
      );

      if (!result.success) {
        throw new Error(`Update failed: ${result.message} (code: ${result.error?.code})`);
      }

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('Backup created'))).toBe(true);
      
      // Check that backup was created
      const projectDir = await fs.readdir(projectRoot);
      const backupFiles = projectDir.filter(f => f.includes('CLAUDE.md.backup'));
      expect(backupFiles.length).toBe(1);
    });
  });

  describe('Template Method Pattern', () => {
    it('should follow consistent workflow across all operations', async () => {
      // Test that all operations support the same base options and follow the same patterns
      const baseOptions = {
        dryRun: false,
        backup: false,
        force: false,
      };

      // Memory
      const memoryResult = await operations.memory.create(
        projectRoot,
        'CLAUDE.md',
        'content',
        baseOptions
      );
      expect(memoryResult.success).toBe(true);

      // Settings  
      const settingsResult = await operations.settings.create(
        projectRoot,
        '.claude/settings.json',
        { permissions: { allow: [] } },
        baseOptions
      );
      expect(settingsResult.success).toBe(true);

      // Commands
      const commandResult = await operations.command.createCommand(
        projectRoot,
        'test-cmd',
        'Test command content',
        undefined,
        baseOptions
      );
      expect(commandResult.success).toBe(true);
      
      // All should have the same result structure
      expect(memoryResult).toHaveProperty('success');
      expect(memoryResult).toHaveProperty('message');
      expect(memoryResult).toHaveProperty('filePath');
      
      expect(settingsResult).toHaveProperty('success');
      expect(settingsResult).toHaveProperty('message');
      expect(settingsResult).toHaveProperty('filePath');
      
      expect(commandResult).toHaveProperty('success');
      expect(commandResult).toHaveProperty('message');
      expect(commandResult).toHaveProperty('filePath');
    });
  });

  describe('Integration with Existing Operations', () => {
    it('should maintain backward compatibility with function exports', async () => {
      // Import the legacy function exports
      const { createMemoryFile } = await import('../memory.js');
      const { createSettingsFile } = await import('../settings.js');
      const { createSlashCommand } = await import('../commands.js');

      // These should still work
      const memoryResult = await createMemoryFile(
        projectRoot,
        'CLAUDE.md',
        'Test content'
      );
      expect(memoryResult.success).toBe(true);

      const settingsResult = await createSettingsFile(
        projectRoot,
        '.claude/settings.json',
        { permissions: { allow: [] } }
      );
      expect(settingsResult.success).toBe(true);

      const commandResult = await createSlashCommand(
        projectRoot,
        'test-cmd',
        'Test command'
      );
      expect(commandResult.success).toBe(true);
    });
  });
});