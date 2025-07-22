/**
 * Tests for settings operations
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  createSettingsFile,
  updateSettingsFile,
  moveSettingsFile,
  deleteSettingsFile
} from '../operations.js';
import { SettingsConfig } from '../../types/settings.js';
import { ErrorCode } from '../../utils/error-handling.js';

describe('Settings Operations', () => {
  let tempDir: string;
  let projectRoot: string;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-config-test-'));
    projectRoot = path.join(tempDir, 'project');
    await fs.mkdir(projectRoot);
    
    // Mock console.error to suppress error output in tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    
    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  describe('createSettingsFile', () => {
    it('should create a valid settings file', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const settings: SettingsConfig = {
        apiKeyHelper: 'test-script.sh',
        cleanupPeriodDays: 30
      };

      const result = await createSettingsFile(projectRoot, settingsPath, settings);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(settingsPath);
      expect(result.settings).toEqual(settings);

      // Verify file was created
      const fileExists = await fs.access(settingsPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify content
      const content = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
      expect(content).toEqual(settings);
    });

    it('should reject invalid settings path', async () => {
      const invalidPath = path.join(projectRoot, 'wrong-dir', 'settings.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      const result = await createSettingsFile(projectRoot, invalidPath, settings);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PATH);
    });

    it('should reject invalid settings content', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const invalidSettings = { cleanupPeriodDays: -5 }; // Negative value

      const result = await createSettingsFile(projectRoot, settingsPath, invalidSettings);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.SCHEMA_VALIDATION_ERROR);
    });

    it('should reject creating file that already exists', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create file first
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(settings));

      const result = await createSettingsFile(projectRoot, settingsPath, settings);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.FILE_ALREADY_EXISTS);
    });

    it('should overwrite existing file with force option', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const originalSettings: SettingsConfig = { cleanupPeriodDays: 30 };
      const newSettings: SettingsConfig = { cleanupPeriodDays: 60 };

      // Create file first
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(originalSettings));

      const result = await createSettingsFile(projectRoot, settingsPath, newSettings, { force: true });

      expect(result.success).toBe(true);

      // Verify content was updated
      const content = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
      expect(content).toEqual(newSettings);
    });

    it('should perform dry run when requested', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      const result = await createSettingsFile(projectRoot, settingsPath, settings, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.message).toContain('[DRY RUN]');

      // Verify file was NOT created
      const fileExists = await fs.access(settingsPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });
  });

  describe('updateSettingsFile', () => {
    it('should update existing settings file', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const originalSettings: SettingsConfig = { 
        cleanupPeriodDays: 30,
        apiKeyHelper: 'original.sh'
      };
      const updates: Partial<SettingsConfig> = { 
        cleanupPeriodDays: 60,
        model: 'claude-3-opus'
      };

      // Create original file
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(originalSettings));

      const result = await updateSettingsFile(projectRoot, settingsPath, updates);

      expect(result.success).toBe(true);
      expect(result.settings).toEqual({
        cleanupPeriodDays: 60,
        apiKeyHelper: 'original.sh',
        model: 'claude-3-opus'
      });
    });

    it('should reject updating non-existent file', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const updates: Partial<SettingsConfig> = { cleanupPeriodDays: 60 };

      const result = await updateSettingsFile(projectRoot, settingsPath, updates);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('should use replace merge strategy', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const originalSettings: SettingsConfig = { 
        cleanupPeriodDays: 30,
        apiKeyHelper: 'original.sh'
      };
      const replacement: SettingsConfig = { 
        model: 'claude-3-opus'
      };

      // Create original file
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(originalSettings));

      const result = await updateSettingsFile(
        projectRoot, 
        settingsPath, 
        replacement, 
        { mergeStrategy: 'replace' }
      );

      expect(result.success).toBe(true);
      expect(result.settings).toEqual(replacement);
    });

    it('should create backup when requested', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const originalSettings: SettingsConfig = { cleanupPeriodDays: 30 };
      const updates: Partial<SettingsConfig> = { cleanupPeriodDays: 60 };

      // Create original file
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(originalSettings));

      await updateSettingsFile(projectRoot, settingsPath, updates, { backup: true });

      // Check backup was created
      const files = await fs.readdir(path.dirname(settingsPath));
      const backupFiles = files.filter(f => f.includes('settings.json.backup'));
      expect(backupFiles.length).toBe(1);
    });
  });

  describe('moveSettingsFile', () => {
    it('should move settings file to new location', async () => {
      const sourcePath = path.join(projectRoot, '.claude', 'settings.json');
      const targetPath = path.join(projectRoot, '.claude', 'settings.local.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create source file
      await fs.mkdir(path.dirname(sourcePath), { recursive: true });
      await fs.writeFile(sourcePath, JSON.stringify(settings));

      const result = await moveSettingsFile(projectRoot, sourcePath, targetPath);

      expect(result.success).toBe(true);
      expect(result.filePath).toBe(targetPath);

      // Verify source no longer exists
      const sourceExists = await fs.access(sourcePath).then(() => true).catch(() => false);
      expect(sourceExists).toBe(false);

      // Verify target exists with correct content
      const targetExists = await fs.access(targetPath).then(() => true).catch(() => false);
      expect(targetExists).toBe(true);

      const content = JSON.parse(await fs.readFile(targetPath, 'utf-8'));
      expect(content).toEqual(settings);
    });

    it('should reject moving non-existent file', async () => {
      const sourcePath = path.join(projectRoot, '.claude', 'settings.json');
      const targetPath = path.join(projectRoot, '.claude', 'settings.local.json');

      const result = await moveSettingsFile(projectRoot, sourcePath, targetPath);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('should reject moving to existing target without force', async () => {
      const sourcePath = path.join(projectRoot, '.claude', 'settings.json');
      const targetPath = path.join(projectRoot, '.claude', 'settings.local.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create both files
      await fs.mkdir(path.dirname(sourcePath), { recursive: true });
      await fs.writeFile(sourcePath, JSON.stringify(settings));
      await fs.writeFile(targetPath, JSON.stringify({ model: 'test' }));

      const result = await moveSettingsFile(projectRoot, sourcePath, targetPath);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.FILE_ALREADY_EXISTS);
    });

    it('should include warning about scope changes', async () => {
      const sourcePath = path.join(projectRoot, '.claude', 'settings.json');
      const targetPath = path.join(projectRoot, '.claude', 'settings.local.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create source file
      await fs.mkdir(path.dirname(sourcePath), { recursive: true });
      await fs.writeFile(sourcePath, JSON.stringify(settings));

      const result = await moveSettingsFile(projectRoot, sourcePath, targetPath);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain('precedence');
    });
  });

  describe('deleteSettingsFile', () => {
    it('should delete existing settings file', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create file
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(settings));

      const result = await deleteSettingsFile(projectRoot, settingsPath);

      expect(result.success).toBe(true);

      // Verify file was deleted
      const fileExists = await fs.access(settingsPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });

    it('should reject deleting non-existent file', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');

      const result = await deleteSettingsFile(projectRoot, settingsPath);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('should create backup when requested', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create file
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(settings));

      const result = await deleteSettingsFile(projectRoot, settingsPath, { backup: true });

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('Backup created'))).toBe(true);

      // Check backup was created
      const files = await fs.readdir(path.dirname(settingsPath));
      const backupFiles = files.filter(f => f.includes('settings.json.backup'));
      expect(backupFiles.length).toBe(1);
    });

    it('should include warnings for critical files', async () => {
      // Create a shared project settings file instead, which should trigger a warning
      const sharedSettingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create shared project settings file
      await fs.mkdir(path.dirname(sharedSettingsPath), { recursive: true });
      await fs.writeFile(sharedSettingsPath, JSON.stringify(settings));

      const result = await deleteSettingsFile(projectRoot, sharedSettingsPath);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('shared project settings'))).toBe(true);
    });
  });

  describe('deep merge strategy', () => {
    it.skip('should use deep-merge strategy for complex objects', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const originalSettings: SettingsConfig = {
        cleanupPeriodDays: 30,
        hooks: {
          PreToolUse: [
            { matcher: 'Bash', hooks: [{ type: 'command' as const, command: 'echo "original bash"' }] },
            { matcher: 'Read', hooks: [{ type: 'command' as const, command: 'echo "original read"' }] }
          ],
          PostToolUse: [
            { matcher: 'Write', hooks: [{ type: 'command' as const, command: 'echo "original write"' }] }
          ]
        }
      };

      const updates = {
        cleanupPeriodDays: 60,
        hooks: {
          PreToolUse: [
            { matcher: 'Bash', hooks: [{ type: 'command' as const, command: 'echo "updated bash"' }] },
            { matcher: 'Edit', hooks: [{ type: 'command' as const, command: 'echo "new edit"' }] }
          ],
          PostToolUse: [
            { matcher: 'Delete', hooks: [{ type: 'command' as const, command: 'echo "new delete"' }] }
          ]
        }
      };

      // Create original file
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(originalSettings));

      const result = await updateSettingsFile(
        projectRoot,
        settingsPath,
        updates,
        { mergeStrategy: 'deep-merge' }
      );

      expect(result.success).toBe(true);
      expect(result.settings!.cleanupPeriodDays).toBe(60);
      
      // Helper function to find hook by matcher
      const findHook = (hooks: any[], matcher: string) => 
        hooks?.find(h => h.matcher === matcher)?.hooks?.[0];
      
      const preToolUseHooks = result.settings!.hooks!.PreToolUse!;
      const postToolUseHooks = result.settings!.hooks!.PostToolUse!;
      
      expect(findHook(preToolUseHooks, 'Bash')?.command).toBe('echo "updated bash"');
      expect(findHook(preToolUseHooks, 'Read')?.command).toBe('echo "original read"');
      expect(findHook(preToolUseHooks, 'Edit')?.command).toBe('echo "new edit"');
      expect(findHook(postToolUseHooks, 'Write')?.command).toBe('echo "original write"');
      expect(findHook(postToolUseHooks, 'Delete')?.command).toBe('echo "new delete"');
    });
  });

  describe('error handling', () => {
    it('should handle write failures gracefully in createSettingsFile', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create directory but make it read-only
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      
      if (process.platform !== 'win32') {
        await fs.chmod(path.dirname(settingsPath), 0o555);

        const result = await createSettingsFile(projectRoot, settingsPath, settings);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error!.code).toBe('PERMISSION_DENIED');

        // Restore permissions for cleanup
        await fs.chmod(path.dirname(settingsPath), 0o755);
      }
    });

    it('should handle backup creation failures', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const originalSettings: SettingsConfig = { cleanupPeriodDays: 30 };
      const updates: Partial<SettingsConfig> = { cleanupPeriodDays: 60 };

      // Create original file
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(originalSettings));

      // Make directory read-only to prevent backup creation
      if (process.platform !== 'win32') {
        await fs.chmod(path.dirname(settingsPath), 0o555);

        const result = await updateSettingsFile(
          projectRoot,
          settingsPath,
          updates,
          { backup: true }
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        // Restore permissions for cleanup
        await fs.chmod(path.dirname(settingsPath), 0o755);
      }
    });

    it('should reject invalid merged settings', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const originalSettings: SettingsConfig = { cleanupPeriodDays: 30 };
      const invalidUpdates = { cleanupPeriodDays: -10 }; // Invalid value

      // Create original file
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(originalSettings));

      const result = await updateSettingsFile(projectRoot, settingsPath, invalidUpdates);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SCHEMA_VALIDATION_ERROR');
    });

    it('should handle directory creation failure during move', async () => {
      const sourcePath = path.join(projectRoot, '.claude', 'settings.json');
      const targetPath = path.join(projectRoot, 'protected', 'settings.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create source file
      await fs.mkdir(path.dirname(sourcePath), { recursive: true });
      await fs.writeFile(sourcePath, JSON.stringify(settings));

      // Create protected directory that we can't write to
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      
      if (process.platform !== 'win32') {
        await fs.chmod(path.dirname(targetPath), 0o555);

        const result = await moveSettingsFile(projectRoot, sourcePath, targetPath);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();

        // Restore permissions for cleanup
        await fs.chmod(path.dirname(targetPath), 0o755);
      }
    });

    it('should handle rename failure during move', async () => {
      const sourcePath = path.join(projectRoot, '.claude', 'settings.json');
      const targetPath = path.join('/root', 'settings.json'); // Permission denied path
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create source file
      await fs.mkdir(path.dirname(sourcePath), { recursive: true });
      await fs.writeFile(sourcePath, JSON.stringify(settings));

      const result = await moveSettingsFile(projectRoot, sourcePath, targetPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('INVALID_PATH');
    });

    it('should handle unexpected errors in createSettingsFile', async () => {
      const settingsPath = '/invalid/path/settings.json';
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Use an invalid path that will trigger validation error
      const result = await createSettingsFile(projectRoot, settingsPath, settings);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('INVALID_PATH');
    });

    it('should handle invalid source path in moveSettingsFile', async () => {
      const sourcePath = path.join(projectRoot, 'invalid', 'settings.json');
      const targetPath = path.join(projectRoot, '.claude', 'settings.json');

      const result = await moveSettingsFile(projectRoot, sourcePath, targetPath);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PATH');
    });

    it('should handle invalid target path in moveSettingsFile', async () => {
      const sourcePath = path.join(projectRoot, '.claude', 'settings.json');
      const targetPath = path.join(projectRoot, 'invalid', 'settings.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create source file
      await fs.mkdir(path.dirname(sourcePath), { recursive: true });
      await fs.writeFile(sourcePath, JSON.stringify(settings));

      const result = await moveSettingsFile(projectRoot, sourcePath, targetPath);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PATH');
    });

    it('should handle corrupted settings file during readJsonFile', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      
      // Create corrupted JSON file
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, '{ invalid json content');

      const result = await deleteSettingsFile(projectRoot, settingsPath);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle file system errors during unlink', async () => {
      const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create file
      await fs.mkdir(path.dirname(settingsPath), { recursive: true });
      await fs.writeFile(settingsPath, JSON.stringify(settings));

      // Make directory read-only to prevent deletion
      if (process.platform !== 'win32') {
        await fs.chmod(path.dirname(settingsPath), 0o555);

        const result = await deleteSettingsFile(projectRoot, settingsPath);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error!.code).toBe('EACCES');

        // Restore permissions for cleanup
        await fs.chmod(path.dirname(settingsPath), 0o755);
      }
    });

    it('should handle user settings deletion warnings', async () => {
      // Create user settings path
      const userSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
      const settings: SettingsConfig = { cleanupPeriodDays: 30 };

      // Create directory and file
      await fs.mkdir(path.dirname(userSettingsPath), { recursive: true });
      await fs.writeFile(userSettingsPath, JSON.stringify(settings));

      const result = await deleteSettingsFile(projectRoot, userSettingsPath);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('user settings'))).toBe(true);

      // Clean up
      await fs.rm(userSettingsPath, { force: true });
    });
  });
});