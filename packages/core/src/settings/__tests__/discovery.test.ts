/**
 * Tests for settings discovery and hierarchy resolution
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  discoverSettingsFiles,
  resolveSettingsHierarchy,
  findSettingSource,
  getActiveSettingsFiles
} from '../discovery.js';
import { SettingsConfig, SettingsFileType } from '../../types/settings.js';

// Mock os module
jest.mock('os');

describe('Settings Discovery', () => {
  let tempDir: string;
  let projectRoot: string;
  let userClaudeDir: string;
  let projectClaudeDir: string;

  const mockedOs = os as jest.Mocked<typeof os>;

  beforeEach(async () => {
    // Use real os.tmpdir() for creating temp directory, but mock homedir
    const realOs = jest.requireActual('os');
    tempDir = await fs.mkdtemp(path.join(realOs.tmpdir(), 'claude-config-test-'));
    projectRoot = path.join(tempDir, 'project');
    userClaudeDir = path.join(tempDir, 'user-home', '.claude');
    projectClaudeDir = path.join(projectRoot, '.claude');

    await fs.mkdir(projectRoot, { recursive: true });
    await fs.mkdir(userClaudeDir, { recursive: true });
    await fs.mkdir(projectClaudeDir, { recursive: true });

    // Mock os.homedir to return our temp directory
    mockedOs.homedir.mockReturnValue(path.join(tempDir, 'user-home'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('discoverSettingsFiles', () => {
    it('should use correct precedence order per Claude Code docs', async () => {
      // According to Claude Code docs: Enterprise > Command line > Local project > Shared project > User
      const files = await discoverSettingsFiles(projectRoot);
      
      // Find each type of settings file
      const userFile = files.find(f => f.type === SettingsFileType.USER);
      const projectSharedFile = files.find(f => f.type === SettingsFileType.PROJECT_SHARED);
      const projectLocalFile = files.find(f => f.type === SettingsFileType.PROJECT_LOCAL);
      
      // Verify precedence values match documentation
      expect(userFile!.precedence).toBe(1); // Lowest
      expect(projectSharedFile!.precedence).toBe(2);
      expect(projectLocalFile!.precedence).toBe(3);
      // Note: Command line (4) and Enterprise (5) are not tested here as they need special handling
    });

    it('should discover all settings files with correct metadata', async () => {
      // Create user settings
      const userSettings: SettingsConfig = { cleanupPeriodDays: 7 };
      await fs.writeFile(
        path.join(userClaudeDir, 'settings.json'),
        JSON.stringify(userSettings)
      );

      // Create project shared settings
      const projectSettings: SettingsConfig = { cleanupPeriodDays: 30, model: 'claude-3-opus' };
      await fs.writeFile(
        path.join(projectClaudeDir, 'settings.json'),
        JSON.stringify(projectSettings)
      );

      // Create project local settings
      const localSettings: SettingsConfig = { env: { DEBUG: 'true' } };
      await fs.writeFile(
        path.join(projectClaudeDir, 'settings.local.json'),
        JSON.stringify(localSettings)
      );

      const files = await discoverSettingsFiles(projectRoot);

      // Should find 3 files (excluding enterprise)
      const existingFiles = files.filter(f => f.exists);
      expect(existingFiles).toHaveLength(3);

      // Check user settings
      const userFile = files.find(f => f.type === SettingsFileType.USER);
      expect(userFile).toBeDefined();
      expect(userFile!.exists).toBe(true);
      expect(userFile!.content).toEqual(userSettings);
      expect(userFile!.precedence).toBe(1);

      // Check project shared settings
      const projectFile = files.find(f => f.type === SettingsFileType.PROJECT_SHARED);
      expect(projectFile).toBeDefined();
      expect(projectFile!.exists).toBe(true);
      expect(projectFile!.content).toEqual(projectSettings);
      expect(projectFile!.precedence).toBe(2);

      // Check project local settings
      const localFile = files.find(f => f.type === SettingsFileType.PROJECT_LOCAL);
      expect(localFile).toBeDefined();
      expect(localFile!.exists).toBe(true);
      expect(localFile!.content).toEqual(localSettings);
      expect(localFile!.precedence).toBe(3);
    });

    it('should handle non-existent files gracefully', async () => {
      const files = await discoverSettingsFiles(projectRoot);

      // Should return metadata for all file types, but with exists: false
      const userFile = files.find(f => f.type === SettingsFileType.USER);
      expect(userFile).toBeDefined();
      expect(userFile!.exists).toBe(false);
      expect(userFile!.isActive).toBe(false);

      const projectFile = files.find(f => f.type === SettingsFileType.PROJECT_SHARED);
      expect(projectFile).toBeDefined();
      expect(projectFile!.exists).toBe(false);
      expect(projectFile!.isActive).toBe(false);
    });

    it('should handle corrupted JSON files', async () => {
      // Create file with invalid JSON
      await fs.writeFile(
        path.join(userClaudeDir, 'settings.json'),
        '{ invalid json }'
      );

      const files = await discoverSettingsFiles(projectRoot);

      const userFile = files.find(f => f.type === SettingsFileType.USER);
      expect(userFile).toBeDefined();
      expect(userFile!.exists).toBe(true);
      expect(userFile!.content).toBeUndefined(); // Should be undefined due to parse error
    });

    it('should sort files by precedence', async () => {
      // Create all settings files
      await fs.writeFile(path.join(userClaudeDir, 'settings.json'), '{}');
      await fs.writeFile(path.join(projectClaudeDir, 'settings.json'), '{}');
      await fs.writeFile(path.join(projectClaudeDir, 'settings.local.json'), '{}');

      const files = await discoverSettingsFiles(projectRoot);
      const existingFiles = files.filter(f => f.exists);

      // Should be sorted by precedence (highest first)
      // Per Claude Code docs: Enterprise (5) > Command line (4) > Local project (3) > Shared project (2) > User (1)
      expect(existingFiles[0].type).toBe(SettingsFileType.PROJECT_LOCAL); // precedence 3
      expect(existingFiles[1].type).toBe(SettingsFileType.PROJECT_SHARED); // precedence 2
      expect(existingFiles[2].type).toBe(SettingsFileType.USER); // precedence 1
    });
  });

  describe('resolveSettingsHierarchy', () => {
    it('should merge settings with correct precedence', async () => {
      // Create user settings (lowest precedence)
      const userSettings: SettingsConfig = {
        cleanupPeriodDays: 7,
        apiKeyHelper: 'user-script.sh',
        env: { USER_VAR: 'user-value' }
      };
      await fs.writeFile(
        path.join(userClaudeDir, 'settings.json'),
        JSON.stringify(userSettings)
      );

      // Create project shared settings (medium precedence)
      const projectSettings: SettingsConfig = {
        cleanupPeriodDays: 30, // Overrides user setting
        model: 'claude-3-opus',
        env: { PROJECT_VAR: 'project-value' }
      };
      await fs.writeFile(
        path.join(projectClaudeDir, 'settings.json'),
        JSON.stringify(projectSettings)
      );

      // Create project local settings (highest precedence)
      const localSettings: SettingsConfig = {
        model: 'claude-3-haiku', // Overrides project setting
        env: { LOCAL_VAR: 'local-value', PROJECT_VAR: 'overridden' }
      };
      await fs.writeFile(
        path.join(projectClaudeDir, 'settings.local.json'),
        JSON.stringify(localSettings)
      );

      const resolution = await resolveSettingsHierarchy(projectRoot);

      // Check effective settings
      expect(resolution.effectiveSettings).toEqual({
        cleanupPeriodDays: 30, // From project settings
        apiKeyHelper: 'user-script.sh', // From user settings
        model: 'claude-3-haiku', // From local settings (highest precedence)
        env: {
          USER_VAR: 'user-value', // From user settings
          PROJECT_VAR: 'overridden', // From local settings (overridden)
          LOCAL_VAR: 'local-value' // From local settings
        }
      });

      // Check conflicts are detected
      expect(resolution.conflicts).toBeDefined();
      expect(resolution.conflicts!.length).toBeGreaterThan(0);

      const modelConflict = resolution.conflicts!.find(c => c.key === 'model');
      expect(modelConflict).toBeDefined();
      expect(modelConflict!.values).toHaveLength(2);
      expect(modelConflict!.resolved).toBe('claude-3-haiku');
    });

    it('should handle permission merging', async () => {
      // User settings with permissions
      const userSettings: SettingsConfig = {
        permissions: {
          allow: ['Read', 'Write'],
          deny: ['Delete']
        }
      };
      await fs.writeFile(
        path.join(userClaudeDir, 'settings.json'),
        JSON.stringify(userSettings)
      );

      // Project settings with additional permissions
      const projectSettings: SettingsConfig = {
        permissions: {
          allow: ['Execute', 'Write'], // 'Write' should be deduplicated
          deny: ['NetworkAccess']
        }
      };
      await fs.writeFile(
        path.join(projectClaudeDir, 'settings.json'),
        JSON.stringify(projectSettings)
      );

      const resolution = await resolveSettingsHierarchy(projectRoot);

      expect(resolution.effectiveSettings.permissions).toEqual({
        allow: expect.arrayContaining(['Read', 'Write', 'Execute']),
        deny: expect.arrayContaining(['Delete', 'NetworkAccess'])
      });

      // Should not have duplicates
      expect(resolution.effectiveSettings.permissions!.allow).toHaveLength(3);
    });

    it('should return empty settings when no files exist', async () => {
      const resolution = await resolveSettingsHierarchy(projectRoot);

      expect(resolution.effectiveSettings).toEqual({});
      expect(resolution.sourceFiles.every(f => !f.exists)).toBe(true);
      expect(resolution.conflicts).toEqual([]);
    });

    it('should handle hook merging', async () => {
      const userSettings: SettingsConfig = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{
                type: 'command',
                command: 'echo "user hook"'
              }]
            }
          ]
        }
      };
      await fs.writeFile(
        path.join(userClaudeDir, 'settings.json'),
        JSON.stringify(userSettings)
      );

      const projectSettings: SettingsConfig = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read',
              hooks: [{
                type: 'command',
                command: 'echo "project hook"'
              }]
            }
          ],
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [{
                type: 'command',
                command: 'echo "post hook"'
              }]
            }
          ]
        }
      };
      await fs.writeFile(
        path.join(projectClaudeDir, 'settings.json'),
        JSON.stringify(projectSettings)
      );

      const resolution = await resolveSettingsHierarchy(projectRoot);

      expect(resolution.effectiveSettings.hooks).toEqual({
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'echo "user hook"' }]
          },
          {
            matcher: 'Read', 
            hooks: [{ type: 'command', command: 'echo "project hook"' }]
          }
        ],
        PostToolUse: [
          {
            matcher: 'Write',
            hooks: [{ type: 'command', command: 'echo "post hook"' }]
          }
        ]
      });
    });
  });

  describe('findSettingSource', () => {
    it('should find the source of a specific setting', async () => {
      // Create user settings
      const userSettings: SettingsConfig = { cleanupPeriodDays: 7 };
      await fs.writeFile(
        path.join(userClaudeDir, 'settings.json'),
        JSON.stringify(userSettings)
      );

      // Create project settings that override
      const projectSettings: SettingsConfig = { 
        cleanupPeriodDays: 30,
        model: 'claude-3-opus'
      };
      await fs.writeFile(
        path.join(projectClaudeDir, 'settings.json'),
        JSON.stringify(projectSettings)
      );

      // Find source of cleanupPeriodDays (should be project due to higher precedence)
      const cleanupSource = await findSettingSource(projectRoot, 'cleanupPeriodDays');
      expect(cleanupSource).toBeDefined();
      expect(cleanupSource!.type).toBe(SettingsFileType.PROJECT_SHARED);

      // Find source of model (only in project)
      const modelSource = await findSettingSource(projectRoot, 'model');
      expect(modelSource).toBeDefined();
      expect(modelSource!.type).toBe(SettingsFileType.PROJECT_SHARED);

      // Find source of non-existent setting
      const nonExistentSource = await findSettingSource(projectRoot, 'nonExistent');
      expect(nonExistentSource).toBeUndefined();
    });
  });

  describe('getActiveSettingsFiles', () => {
    it('should return only active settings files', async () => {
      // Create user settings
      await fs.writeFile(path.join(userClaudeDir, 'settings.json'), '{}');

      // Create project settings
      await fs.writeFile(path.join(projectClaudeDir, 'settings.json'), '{}');

      // Don't create local settings

      const activeFiles = await getActiveSettingsFiles(projectRoot);

      expect(activeFiles).toHaveLength(2);
      expect(activeFiles.every(f => f.exists && f.isActive)).toBe(true);
      
      const types = activeFiles.map(f => f.type);
      expect(types).toContain(SettingsFileType.USER);
      expect(types).toContain(SettingsFileType.PROJECT_SHARED);
      expect(types).not.toContain(SettingsFileType.PROJECT_LOCAL);
    });
  });
});