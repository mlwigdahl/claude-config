/**
 * Edge case tests for settings hierarchy precedence
 * Tests complex scenarios that could break settings resolution
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import * as path from 'path';
import { tmpdir } from 'os';
import { discoverSettingsFiles } from '../discovery.js';
import { SettingsFileType, SettingsConfig } from '../../types/settings.js';

describe('Settings Hierarchy Precedence Edge Cases', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'claude-config-settings-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('command line settings precedence', () => {
    it('should enforce exact Claude Code precedence order', async () => {
      // Create all types of settings files
      const settingsFiles = [
        {
          type: SettingsFileType.USER,
          path: join(testDir, '.claude', 'settings.json'),
          content: { model: 'user-model', hooks: { PreToolUse: { Bash: { command: 'echo user' } } } }
        },
        {
          type: SettingsFileType.PROJECT_SHARED,
          path: join(testDir, 'project', '.claude', 'settings.json'),
          content: { model: 'shared-model', hooks: { PreToolUse: { Bash: { command: 'echo shared' } } } }
        },
        {
          type: SettingsFileType.PROJECT_LOCAL,
          path: join(testDir, 'project', '.claude', 'settings.local.json'),
          content: { model: 'local-model', hooks: { PreToolUse: { Bash: { command: 'echo local' } } } }
        },
        {
          type: SettingsFileType.COMMAND_LINE,
          path: 'command-line',
          content: { model: 'cli-model', hooks: { PreToolUse: { Bash: { command: 'echo cli' } } } }
        },
        {
          type: SettingsFileType.ENTERPRISE,
          path: '/etc/claude-code/settings.json',
          content: { model: 'enterprise-model', hooks: { PreToolUse: { Bash: { command: 'echo enterprise' } } } }
        }
      ];

      // Create directories
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });
      await fs.mkdir(join(testDir, 'project', '.claude'), { recursive: true });

      // Create physical files (except command line and enterprise)
      for (const file of settingsFiles) {
        if (file.type !== SettingsFileType.COMMAND_LINE && file.type !== SettingsFileType.ENTERPRISE) {
          await fs.writeFile(file.path, JSON.stringify(file.content, null, 2));
        }
      }

      const discovered = await discoverSettingsFiles(join(testDir, 'project'));
      
      // Check precedence values match Claude Code spec
      const precedenceMap = discovered.reduce((map, file) => {
        map[file.type] = file.precedence;
        return map;
      }, {} as Record<SettingsFileType, number>);

      // Enterprise (5) > Command line (4) > Local project (3) > Shared project (2) > User (1)
      expect(precedenceMap[SettingsFileType.ENTERPRISE]).toBe(5);
      expect(precedenceMap[SettingsFileType.COMMAND_LINE]).toBe(4);
      expect(precedenceMap[SettingsFileType.PROJECT_LOCAL]).toBe(3);
      expect(precedenceMap[SettingsFileType.PROJECT_SHARED]).toBe(2);
      expect(precedenceMap[SettingsFileType.USER]).toBe(1);
    });

    it('should handle command line settings override project settings', async () => {
      // Create project settings
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });
      const projectSettings: SettingsConfig = {
        model: 'claude-3-sonnet',
        hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo project' }] }] }
      };
      await fs.writeFile(
        join(testDir, '.claude', 'settings.json'),
        JSON.stringify(projectSettings, null, 2)
      );

      // Simulate command line settings
      const commandLineSettings: SettingsConfig = {
        model: 'claude-3-opus',
        hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo cli' }] }] }
      };

      const discovered = await discoverSettingsFiles(testDir);
      
      // Add command line settings manually (would be injected by CLI)
      discovered.push({
        type: SettingsFileType.COMMAND_LINE,
        path: 'command-line',
        content: commandLineSettings,
        precedence: 4,
        exists: true,
        isActive: true
      });

      // Sort by precedence and merge
      discovered.sort((a, b) => a.precedence - b.precedence);
      
      const merged = discovered.reduce((acc, file) => {
        return { ...acc, ...file.content };
      }, {} as SettingsConfig);

      expect(merged.model).toBe('claude-3-opus'); // CLI should override project
      const preToolUseHooks = merged.hooks?.PreToolUse;
      expect(preToolUseHooks?.[0]?.hooks?.[0]?.command).toBe('echo cli');
    });
  });

  describe('complex hierarchy scenarios', () => {
    it('should handle nested monorepo settings correctly', async () => {
      // Create complex monorepo structure
      // root/
      //   .claude/settings.json (shared)
      //   apps/
      //     web/
      //       .claude/settings.json (web shared)
      //       .claude/settings.local.json (web local)
      //     api/
      //       .claude/settings.json (api shared)

      const structure = [
        {
          path: join(testDir, '.claude', 'settings.json'),
          content: { model: 'root-shared', timeout: 60 }
        },
        {
          path: join(testDir, 'apps', 'web', '.claude', 'settings.json'),
          content: { model: 'web-shared', maxTokens: 1000 }
        },
        {
          path: join(testDir, 'apps', 'web', '.claude', 'settings.local.json'),
          content: { model: 'web-local', debug: true }
        },
        {
          path: join(testDir, 'apps', 'api', '.claude', 'settings.json'),
          content: { model: 'api-shared', temperature: 0.7 }
        }
      ];

      // Create directories and files
      for (const item of structure) {
        const dir = path.dirname(item.path);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(item.path, JSON.stringify(item.content, null, 2));
      }

      // Test web app settings resolution
      const webSettings = await discoverSettingsFiles(join(testDir, 'apps', 'web'));
      webSettings.sort((a, b) => a.precedence - b.precedence);
      
      const webMerged = webSettings.reduce((acc, file) => {
        return { ...acc, ...file.content };
      }, {} as any);

      // The discovery function only looks at standard locations, not parent directories
      // So only the web directory settings should be found
      expect(webMerged.model).toBe('web-local'); // Local should override shared
      expect(webMerged.maxTokens).toBe(1000); // Should inherit from web shared
      expect(webMerged.debug).toBe(true); // From web local
      // timeout from root won't be inherited since parent directories aren't traversed

      // Test api app settings resolution
      const apiSettings = await discoverSettingsFiles(join(testDir, 'apps', 'api'));
      apiSettings.sort((a, b) => a.precedence - b.precedence);
      
      const apiMerged = apiSettings.reduce((acc, file) => {
        return { ...acc, ...file.content };
      }, {} as any);

      expect(apiMerged.model).toBe('api-shared'); // API shared should override root
      expect(apiMerged.temperature).toBe(0.7); // From api shared
      // timeout from root won't be inherited since parent directories aren't traversed
    });

    it('should handle conflicting hook configurations', async () => {
      const structure = [
        {
          path: join(testDir, '.claude', 'settings.json'),
          content: {
            hooks: {
              PreToolUse: {
                Bash: 'echo "user hook"',
                Read: 'echo "user read"'
              },
              PostToolUse: {
                Write: 'echo "user write"'
              }
            }
          }
        },
        {
          path: join(testDir, 'project', '.claude', 'settings.json'),
          content: {
            hooks: {
              PreToolUse: {
                Bash: 'echo "project hook"',
                Edit: 'echo "project edit"'
              },
              PostToolUse: {
                Write: 'echo "project write"'
              }
            }
          }
        },
        {
          path: join(testDir, 'project', '.claude', 'settings.local.json'),
          content: {
            hooks: {
              PreToolUse: {
                Bash: 'echo "local hook"'
              }
            }
          }
        }
      ];

      for (const item of structure) {
        const dir = path.dirname(item.path);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(item.path, JSON.stringify(item.content, null, 2));
      }

      const discovered = await discoverSettingsFiles(join(testDir, 'project'));
      discovered.sort((a, b) => a.precedence - b.precedence);

      // Merge hooks with precedence
      const mergedHooks = discovered.reduce((acc, file) => {
        if (file.content?.hooks) {
          for (const [eventType, eventHooks] of Object.entries(file.content.hooks)) {
            if (!acc[eventType]) acc[eventType] = {};
            Object.assign(acc[eventType], eventHooks);
          }
        }
        return acc;
      }, {} as any);

      // The discovery function only looks at project/.claude/, not parent directories
      // So only the project directory settings should be found
      expect(mergedHooks.PreToolUse.Bash).toBe('echo "local hook"'); // Local wins
      expect(mergedHooks.PreToolUse.Edit).toBe('echo "project edit"'); // Only in project
      expect(mergedHooks.PostToolUse.Write).toBe('echo "project write"'); // Project wins
      // User hooks won't be found since they're not in the project directory
    });
  });

  describe('file system edge cases', () => {
    it('should handle missing parent directories gracefully', async () => {
      // Try to discover settings from non-existent path
      const discovered = await discoverSettingsFiles(join(testDir, 'nonexistent', 'path'));
      
      expect(discovered).toBeInstanceOf(Array);
      expect(discovered.length).toBe(5); // Should return all standard settings paths
    });

    it('should handle corrupted settings files', async () => {
      // Create invalid JSON file
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });
      await fs.writeFile(
        join(testDir, '.claude', 'settings.json'),
        '{ invalid json content'
      );

      const discovered = await discoverSettingsFiles(testDir);
      
      // Should not crash, but should include invalid file with undefined content
      expect(discovered).toBeInstanceOf(Array);
      expect(discovered.length).toBe(5); // Should return all standard settings paths
      const validFiles = discovered.filter(f => f.exists);
      expect(validFiles.length).toBe(1); // Only the corrupted file exists
    });

    it('should handle permission denied scenarios', async () => {
      // Create file with restricted permissions
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });
      const restrictedFile = join(testDir, '.claude', 'settings.json');
      await fs.writeFile(restrictedFile, '{"model": "test"}');
      
      // Make file unreadable (skip on Windows)
      if (process.platform !== 'win32') {
        await fs.chmod(restrictedFile, 0o000);
        
        const discovered = await discoverSettingsFiles(testDir);
        
        // Should handle permission error gracefully
        expect(discovered).toBeInstanceOf(Array);
        
        // Restore permissions for cleanup
        await fs.chmod(restrictedFile, 0o644);
      }
    });

    it('should handle symbolic links correctly', async () => {
      // Skip on Windows as symlinks require admin privileges
      if (process.platform === 'win32') {
        console.log('Skipping symlink test on Windows');
        return;
      }
      // Create original settings file
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });
      await fs.mkdir(join(testDir, 'shared'), { recursive: true });
      
      const originalFile = join(testDir, 'shared', 'settings.json');
      await fs.writeFile(originalFile, JSON.stringify({ model: 'shared-model' }));
      
      // Create symlink
      const linkFile = join(testDir, '.claude', 'settings.json');
      await fs.symlink(originalFile, linkFile);
      
      const discovered = await discoverSettingsFiles(testDir);
      
      expect(discovered.length).toBeGreaterThan(0);
      const settingsFile = discovered.find(f => f.path === linkFile);
      expect(settingsFile?.content?.model).toBe('shared-model');
    });
  });

  describe('performance and scalability', () => {
    it('should handle deep directory hierarchies efficiently', async () => {
      // Create deep nested structure
      const depth = 20;
      let currentPath = testDir;
      
      for (let i = 0; i < depth; i++) {
        currentPath = join(currentPath, `level${i}`);
        await fs.mkdir(currentPath, { recursive: true });
        
        // Add settings file every 5 levels
        if (i % 5 === 0) {
          await fs.mkdir(join(currentPath, '.claude'), { recursive: true });
          await fs.writeFile(
            join(currentPath, '.claude', 'settings.json'),
            JSON.stringify({ model: `level-${i}-model` })
          );
        }
      }

      const startTime = Date.now();
      const discovered = await discoverSettingsFiles(currentPath);
      const endTime = Date.now();

      expect(discovered.length).toBe(5); // Should return all standard settings paths (regardless of depth)
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly
    });

    it('should handle large settings files efficiently', async () => {
      // Create large settings file
      const largeHooks: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        largeHooks[`Tool${i}`] = `echo "hook ${i}"`;
      }

      const largeSettings = {
        model: 'claude-3-sonnet',
        hooks: { PreToolUse: largeHooks }
      };

      await fs.mkdir(join(testDir, '.claude'), { recursive: true });
      await fs.writeFile(
        join(testDir, '.claude', 'settings.json'),
        JSON.stringify(largeSettings, null, 2)
      );

      const startTime = Date.now();
      const discovered = await discoverSettingsFiles(testDir);
      const endTime = Date.now();

      expect(discovered.length).toBe(5); // Should return all standard settings paths
      const settingsFile = discovered.find(f => f.exists && f.content?.hooks);
      expect(settingsFile?.content?.hooks?.PreToolUse).toHaveProperty('Tool999');
      expect(endTime - startTime).toBeLessThan(2000); // Should handle large files
    });
  });
});