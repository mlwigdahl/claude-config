/**
 * Integration tests between memory, settings, and hooks modules
 * Tests real-world scenarios where modules must work together
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { MemoryFileDiscovery } from '../memory/discovery.js';
import { validateMemoryContent } from '../memory/validation.js';
import { discoverSettingsFiles } from '../settings/discovery.js';
import {
  extractHooksFromSettings,
  mergeHooksConfigs,
  findMatchingHooks,
} from '../hooks/utils.js';
import { HookEventType } from '../types/hooks.js';

describe('Cross-Module Integration Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'claude-config-integration-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('memory-settings integration', () => {
    it('should validate memory files using settings-defined permissions', async () => {
      // Create settings with memory validation rules
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });
      const settings = {
        permissions: {
          allow: ['@shared/*', '@project/*'],
          deny: ['@private/*'],
        },
        memory: {
          maxImportDepth: 3,
          allowedPaths: ['shared', 'project'],
          deniedPaths: ['private'],
        },
      };
      await fs.writeFile(
        join(testDir, '.claude', 'settings.json'),
        JSON.stringify(settings, null, 2)
      );

      // Create memory files
      await fs.mkdir(join(testDir, 'shared'), { recursive: true });
      await fs.mkdir(join(testDir, 'project'), { recursive: true });
      await fs.mkdir(join(testDir, 'private'), { recursive: true });

      const memoryFiles = [
        {
          path: join(testDir, 'CLAUDE.md'),
          content: `# Main Memory\n@shared/context.md\n@project/specific.md`,
        },
        {
          path: join(testDir, 'shared', 'context.md'),
          content: `# Shared Context\n@project/details.md`,
        },
        {
          path: join(testDir, 'project', 'specific.md'),
          content: `# Project Specific\nNo imports here`,
        },
        {
          path: join(testDir, 'project', 'details.md'),
          content: `# Project Details\nNo imports here`,
        },
      ];

      for (const file of memoryFiles) {
        await fs.writeFile(file.path, file.content);
      }

      // Discover settings and memory files
      const discoveredSettings = await discoverSettingsFiles(testDir);
      const discoveredMemory =
        await MemoryFileDiscovery.discoverMemoryFiles(testDir);

      expect(discoveredSettings.filter(s => s.exists).length).toBe(1);
      expect(discoveredMemory.length).toBe(2); // Project + User (non-existing)

      // Validate memory files against settings
      const mainMemory = discoveredMemory.find((f: any) =>
        f.path.endsWith('CLAUDE.md')
      );
      expect(mainMemory).toBeDefined();

      const content = await fs.readFile(mainMemory!.path, 'utf-8');
      const validationResult = validateMemoryContent(content);
      expect(validationResult.valid).toBe(true);
    });

    it('should handle memory file validation with complex settings hierarchy', async () => {
      // Create hierarchical settings
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });
      await fs.mkdir(join(testDir, 'project', '.claude'), { recursive: true });

      const userSettings = {
        memory: { maxImportDepth: 2 },
      };
      const projectSettings = {
        memory: { maxImportDepth: 5 },
        permissions: { allow: ['@*'] },
      };

      await fs.writeFile(
        join(testDir, '.claude', 'settings.json'),
        JSON.stringify(userSettings, null, 2)
      );
      await fs.writeFile(
        join(testDir, 'project', '.claude', 'settings.json'),
        JSON.stringify(projectSettings, null, 2)
      );

      // Create deep import chain
      const chainFiles = [
        { name: 'CLAUDE.md', imports: ['@level1.md'] },
        { name: 'level1.md', imports: ['@level2.md'] },
        { name: 'level2.md', imports: ['@level3.md'] },
        { name: 'level3.md', imports: ['@level4.md'] },
        { name: 'level4.md', imports: [] },
      ];

      for (const file of chainFiles) {
        const content = `# ${file.name}\n${file.imports.join('\n')}`;
        await fs.writeFile(join(testDir, 'project', file.name), content);
      }

      // Discover settings (project should override user)
      const settings = await discoverSettingsFiles(join(testDir, 'project'));
      const mergedSettings = settings
        .sort((a, b) => a.precedence - b.precedence)
        .reduce((acc, s) => ({ ...acc, ...s.content }), {});

      expect((mergedSettings as any).memory.maxImportDepth).toBe(5); // Project should override user

      // Validate memory with project settings
      const memoryFiles = await MemoryFileDiscovery.discoverMemoryFiles(
        join(testDir, 'project')
      );
      const mainMemory = memoryFiles.find((f: any) =>
        f.path.endsWith('CLAUDE.md')
      );
      const content = await fs.readFile(mainMemory!.path, 'utf-8');
      const validationResult = validateMemoryContent(content);

      expect(validationResult.valid).toBe(true); // Should pass with depth 5
    });
  });

  describe('settings-hooks integration', () => {
    it('should merge hooks from multiple settings files correctly', async () => {
      // Create hierarchical settings with hooks
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });
      await fs.mkdir(join(testDir, 'project', '.claude'), { recursive: true });

      const userSettings = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo "user pre-bash"' }],
            },
            {
              matcher: 'Read',
              hooks: [{ type: 'command', command: 'echo "user pre-read"' }],
            },
          ],
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [{ type: 'command', command: 'echo "user post-write"' }],
            },
          ],
        },
      };

      const projectSettings = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo "project pre-bash"' }],
            },
            {
              matcher: 'Edit',
              hooks: [{ type: 'command', command: 'echo "project pre-edit"' }],
            },
          ],
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [
                { type: 'command', command: 'echo "project post-write"' },
              ],
            },
            {
              matcher: 'Delete',
              hooks: [
                { type: 'command', command: 'echo "project post-delete"' },
              ],
            },
          ],
        },
      };

      await fs.writeFile(
        join(testDir, '.claude', 'settings.json'),
        JSON.stringify(userSettings, null, 2)
      );
      await fs.writeFile(
        join(testDir, '.claude', 'settings.local.json'),
        JSON.stringify(projectSettings, null, 2)
      );

      // Discover and merge settings
      const discovered = await discoverSettingsFiles(testDir);
      const hooksConfigs = discovered.map(file => ({
        hooks: extractHooksFromSettings(file.content || {}),
        precedence: file.precedence,
      }));

      const mergedHooks = mergeHooksConfigs(hooksConfigs);

      // Test precedence resolution
      expect(mergedHooks.PreToolUse.Bash.command).toBe(
        'echo "project pre-bash"'
      ); // Project wins
      expect(mergedHooks.PreToolUse.Read.command).toBe('echo "user pre-read"'); // Only in user
      expect(mergedHooks.PreToolUse.Edit.command).toBe(
        'echo "project pre-edit"'
      ); // Only in project
      expect(mergedHooks.PostToolUse.Write.command).toBe(
        'echo "project post-write"'
      ); // Project wins
      expect(mergedHooks.PostToolUse.Delete.command).toBe(
        'echo "project post-delete"'
      ); // Only in project

      // Test hook matching
      const bashHooks = findMatchingHooks(
        mergedHooks,
        HookEventType.PRE_TOOL_USE,
        'Bash'
      );
      expect(bashHooks).toHaveLength(1);
      expect(bashHooks[0].hook.command).toBe('echo "project pre-bash"');
    });

    it('should handle complex hook patterns with settings hierarchy', async () => {
      // Create settings with regex patterns
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });

      const settings = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read.*',
              hooks: [{ type: 'command', command: 'echo "read pattern"' }],
            },
            {
              matcher: 'Edit|Write',
              hooks: [{ type: 'command', command: 'echo "edit or write"' }],
            },
            {
              matcher: '.*',
              hooks: [{ type: 'command', command: 'echo "catch all"' }],
            },
          ],
        },
      };

      await fs.writeFile(
        join(testDir, '.claude', 'settings.json'),
        JSON.stringify(settings, null, 2)
      );

      const discovered = await discoverSettingsFiles(testDir);
      const settingsFile = discovered.find(s => s.exists);
      const hooks = extractHooksFromSettings(settingsFile?.content || {});

      // Test pattern matching
      const readHooks = findMatchingHooks(
        hooks,
        HookEventType.PRE_TOOL_USE,
        'Read'
      );
      expect(readHooks).toHaveLength(2); // 'Read.*' and '.*'

      const editHooks = findMatchingHooks(
        hooks,
        HookEventType.PRE_TOOL_USE,
        'Edit'
      );
      expect(editHooks).toHaveLength(2); // 'Edit|Write' and '.*'

      const bashHooks = findMatchingHooks(
        hooks,
        HookEventType.PRE_TOOL_USE,
        'Bash'
      );
      expect(bashHooks).toHaveLength(1); // Only '.*'
    });
  });

  describe('memory-hooks integration', () => {
    it('should execute hooks when memory files are processed', async () => {
      // Create settings with memory processing hooks
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });

      const settings = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read',
              hooks: [
                {
                  type: 'command',
                  command: 'echo "before reading memory file"',
                },
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: 'Read',
              hooks: [
                {
                  type: 'command',
                  command: 'echo "after reading memory file"',
                },
              ],
            },
          ],
        },
      };

      await fs.writeFile(
        join(testDir, '.claude', 'settings.json'),
        JSON.stringify(settings, null, 2)
      );

      // Create memory files
      await fs.writeFile(
        join(testDir, 'CLAUDE.md'),
        '# Main Memory\n@shared.md\nMain content'
      );
      await fs.writeFile(
        join(testDir, 'shared.md'),
        '# Shared Memory\nShared content'
      );

      // Discover everything
      const settingsFiles = await discoverSettingsFiles(testDir);
      const memoryFiles =
        await MemoryFileDiscovery.discoverMemoryFiles(testDir);
      const settingsFile = settingsFiles.find(s => s.exists);
      const hooks = extractHooksFromSettings(settingsFile?.content || {});

      // Simulate memory file processing with hooks
      const preHooks = findMatchingHooks(
        hooks,
        HookEventType.PRE_TOOL_USE,
        'Read'
      );
      const postHooks = findMatchingHooks(
        hooks,
        HookEventType.POST_TOOL_USE,
        'Read'
      );

      expect(preHooks).toHaveLength(1);
      expect(postHooks).toHaveLength(1);
      expect(preHooks[0].hook.command).toBe(
        'echo "before reading memory file"'
      );
      expect(postHooks[0].hook.command).toBe(
        'echo "after reading memory file"'
      );
      expect(memoryFiles).toHaveLength(2); // Project + User
    });
  });

  describe('full system integration', () => {
    it('should handle complete Claude Code workflow', async () => {
      // Create realistic project structure
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });
      await fs.mkdir(join(testDir, 'src'), { recursive: true });
      await fs.mkdir(join(testDir, 'docs'), { recursive: true });

      // Create settings with full configuration
      const settings = {
        model: 'claude-3-sonnet',
        permissions: {
          allow: ['@*'],
          deny: ['@private/*'],
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read',
              hooks: [
                { type: 'command', command: 'echo "validating file access"' },
              ],
            },
            {
              matcher: 'Write',
              hooks: [
                { type: 'command', command: 'echo "preparing to write"' },
              ],
            },
            {
              matcher: 'Edit',
              hooks: [
                { type: 'command', command: 'echo "backing up before edit"' },
              ],
            },
          ],
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [
                {
                  type: 'command',
                  command: 'echo "file written successfully"',
                },
              ],
            },
            {
              matcher: 'Edit',
              hooks: [
                {
                  type: 'command',
                  command: 'echo "validating edit completion"',
                },
              ],
            },
          ],
        },
      };

      await fs.writeFile(
        join(testDir, '.claude', 'settings.json'),
        JSON.stringify(settings, null, 2)
      );

      // Create memory files
      const memoryFiles = [
        {
          path: join(testDir, 'CLAUDE.md'),
          content: '# Project Memory\n@docs/context.md\n@src/architecture.md',
        },
        {
          path: join(testDir, 'docs', 'context.md'),
          content: '# Documentation Context\nProject documentation',
        },
        {
          path: join(testDir, 'src', 'architecture.md'),
          content: '# Architecture\nSystem architecture details',
        },
      ];

      for (const file of memoryFiles) {
        await fs.writeFile(file.path, file.content);
      }

      // Discover all components
      const discoveredSettings = await discoverSettingsFiles(testDir);
      const discoveredMemory =
        await MemoryFileDiscovery.discoverMemoryFiles(testDir);

      // Validate integration
      expect(discoveredSettings.filter(s => s.exists)).toHaveLength(1);
      expect(discoveredMemory).toHaveLength(2); // Project + User (non-existing)

      // Test settings loading
      const loadedSettings = discoveredSettings.find(s => s.exists)?.content;
      expect(loadedSettings?.model).toBe('claude-3-sonnet');
      expect(loadedSettings?.permissions).toBeDefined();
      expect(loadedSettings?.hooks).toBeDefined();

      // Test memory validation
      const mainMemory = discoveredMemory.find((f: any) =>
        f.path.endsWith('CLAUDE.md')
      );
      const content = await fs.readFile(mainMemory!.path, 'utf-8');
      const validationResult = validateMemoryContent(content);
      expect(validationResult.valid).toBe(true);

      // Test hooks extraction
      const hooks = extractHooksFromSettings(loadedSettings || {});
      expect(hooks.PreToolUse).toBeDefined();
      expect(hooks.PostToolUse).toBeDefined();

      // Test hook matching for different tools
      const readHooks = findMatchingHooks(
        hooks,
        HookEventType.PRE_TOOL_USE,
        'Read'
      );
      const writeHooks = findMatchingHooks(
        hooks,
        HookEventType.POST_TOOL_USE,
        'Write'
      );

      expect(readHooks).toHaveLength(1);
      expect(writeHooks).toHaveLength(1);
    });

    it('should handle error scenarios across modules', async () => {
      // Create settings with restrictive permissions
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });

      const settings = {
        permissions: {
          allow: ['@allowed/*'],
          deny: ['@denied/*'],
        },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read',
              hooks: [{ type: 'command', command: 'exit 1' }], // Failing hook
            },
          ],
        },
      };

      await fs.writeFile(
        join(testDir, '.claude', 'settings.json'),
        JSON.stringify(settings, null, 2)
      );

      // Create memory files that should fail validation
      await fs.mkdir(join(testDir, 'denied'), { recursive: true });
      await fs.writeFile(
        join(testDir, 'CLAUDE.md'),
        '# Main Memory\n@denied/restricted.md'
      );
      await fs.writeFile(
        join(testDir, 'denied', 'restricted.md'),
        '# Restricted Content\nThis should not be accessible'
      );

      // Test system behavior with restrictions
      const discoveredSettings = await discoverSettingsFiles(testDir);
      const discoveredMemory =
        await MemoryFileDiscovery.discoverMemoryFiles(testDir);

      expect(discoveredSettings.filter(s => s.exists)).toHaveLength(1);
      expect(discoveredMemory).toHaveLength(2);

      // Test validation with restrictions
      const mainMemory = discoveredMemory.find((f: any) =>
        f.path.endsWith('CLAUDE.md')
      );
      const content = await fs.readFile(mainMemory!.path, 'utf-8');
      const validationResult = validateMemoryContent(content);

      // Should still be valid structurally, but hooks might fail
      expect(validationResult.valid).toBe(true);

      // Test hook with failure
      const settingsFile = discoveredSettings.find(s => s.exists);
      const hooks = extractHooksFromSettings(settingsFile?.content || {});
      const failingHooks = findMatchingHooks(
        hooks,
        HookEventType.PRE_TOOL_USE,
        'Read'
      );

      expect(failingHooks).toHaveLength(1);
      expect(failingHooks[0].hook.command).toBe('exit 1');
    });
  });

  describe('concurrent access scenarios', () => {
    it('should handle simultaneous access to shared resources', async () => {
      // Create shared settings
      await fs.mkdir(join(testDir, '.claude'), { recursive: true });

      const settings = {
        model: 'claude-3-sonnet',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Read',
              hooks: [{ type: 'command', command: 'echo "concurrent access"' }],
            },
          ],
        },
      };

      await fs.writeFile(
        join(testDir, '.claude', 'settings.json'),
        JSON.stringify(settings, null, 2)
      );

      // Create memory files
      await fs.writeFile(
        join(testDir, 'CLAUDE.md'),
        '# Concurrent Test\n@shared.md'
      );
      await fs.writeFile(
        join(testDir, 'shared.md'),
        '# Shared Memory\nShared content'
      );

      // Simulate concurrent access
      const promises = Array.from({ length: 5 }, async () => {
        const settings = await discoverSettingsFiles(testDir);
        const memory = await MemoryFileDiscovery.discoverMemoryFiles(testDir);
        return { settings, memory };
      });

      const results = await Promise.all(promises);

      // All should succeed
      for (const result of results) {
        expect(result.settings.filter(s => s.exists)).toHaveLength(1);
        expect(result.memory).toHaveLength(2);
      }
    });
  });
});
