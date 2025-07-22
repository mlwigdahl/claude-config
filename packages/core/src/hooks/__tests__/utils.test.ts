/**
 * Tests for simplified hooks utilities
 */

import { describe, it, expect } from '@jest/globals';
import { 
  extractHooksFromSettings,
  mergeHooksConfigs,
  getHooksForEvent,
  matchesHookPattern,
  findMatchingHooks,
  validateAndReportHooks,
  getHooksStatistics
} from '../utils.js';
import { HookEventType } from '../../types/hooks.js';
import { SettingsConfig } from '../../types/settings.js';
import { HooksConfig } from '../validation.js';

describe('Simplified Hooks Utils', () => {
  describe('extractHooksFromSettings', () => {
    it('should extract hooks from settings configuration', () => {
      const settings: SettingsConfig = {
        hooks: {
          'PreToolUse': [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo "before bash"' }]
            },
            {
              matcher: 'Read',
              hooks: [{ type: 'command', command: 'echo "before read"', timeout: 30 }]
            }
          ],
          'PostToolUse': [
            {
              matcher: 'Write',
              hooks: [{ type: 'command', command: 'echo "after write"' }]
            }
          ]
        }
      };

      const result = extractHooksFromSettings(settings);
      expect(result).toEqual({
        'PreToolUse': {
          'Bash': { type: 'command', command: 'echo "before bash"' },
          'Read': { type: 'command', command: 'echo "before read"', timeout: 30 }
        },
        'PostToolUse': {
          'Write': { type: 'command', command: 'echo "after write"' }
        }
      });
    });

    it('should handle settings without hooks', () => {
      const settings: SettingsConfig = {
        model: 'claude-3-sonnet'
      };

      const result = extractHooksFromSettings(settings);
      expect(result).toEqual({});
    });

    it('should throw error for invalid event types', () => {
      const settings: SettingsConfig = {
        hooks: {
          'InvalidEventType': [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo "test"' }]
            }
          ]
        } as any // Type assertion to bypass TypeScript validation for this test
      };

      expect(() => extractHooksFromSettings(settings)).toThrow(
        'Invalid hook event type: "InvalidEventType". Valid event types are: PreToolUse, PostToolUse, Notification, Stop, SubagentStop, PreCompact'
      );
    });
  });

  describe('mergeHooksConfigs', () => {
    it('should merge hooks configs by precedence', () => {
      const configs = [
        {
          hooks: {
            'PreToolUse': {
              'Bash': { type: 'command', command: 'echo "user"' },
              'Read': { type: 'command', command: 'echo "user read"' }
            }
          } as HooksConfig,
          precedence: 1
        },
        {
          hooks: {
            'PreToolUse': {
              'Bash': { type: 'command', command: 'echo "project"' },
              'Write': { type: 'command', command: 'echo "project write"' }
            }
          } as HooksConfig,
          precedence: 2
        }
      ];

      const result = mergeHooksConfigs(configs);
      expect(result).toEqual({
        'PreToolUse': {
          'Bash': { type: 'command', command: 'echo "project"' }, // Higher precedence wins
          'Read': { type: 'command', command: 'echo "user read"' }, // Only in user config
          'Write': { type: 'command', command: 'echo "project write"' } // Only in project config
        }
      });
    });

    it('should handle empty configs', () => {
      const result = mergeHooksConfigs([]);
      expect(result).toEqual({});
    });

    it('should handle single config', () => {
      const configs = [
        {
          hooks: {
            'PreToolUse': {
              'Bash': { type: 'command', command: 'echo "test"' }
            }
          } as HooksConfig,
          precedence: 1
        }
      ];

      const result = mergeHooksConfigs(configs);
      expect(result).toEqual({
        'PreToolUse': {
          'Bash': { type: 'command', command: 'echo "test"' }
        }
      });
    });
  });

  describe('getHooksForEvent', () => {
    it('should get hooks for specific event type', () => {
      const hooks: HooksConfig = {
        'PreToolUse': {
          'Bash': { type: 'command', command: 'echo "before bash"' },
          'Read': { type: 'command', command: 'echo "before read"' }
        },
        'PostToolUse': {
          'Write': { type: 'command', command: 'echo "after write"' }
        }
      };

      const result = getHooksForEvent(hooks, HookEventType.PRE_TOOL_USE);
      expect(result).toEqual({
        'Bash': { type: 'command', command: 'echo "before bash"' },
        'Read': { type: 'command', command: 'echo "before read"' }
      });
    });

    it('should return empty object for non-existent event', () => {
      const hooks: HooksConfig = {};
      const result = getHooksForEvent(hooks, HookEventType.PRE_TOOL_USE);
      expect(result).toEqual({});
    });
  });

  describe('matchesHookPattern', () => {
    it('should match exact tool names', () => {
      expect(matchesHookPattern('Bash', 'Bash')).toBe(true);
      expect(matchesHookPattern('Read', 'Write')).toBe(false);
    });

    it('should match regex patterns', () => {
      expect(matchesHookPattern('Bash', 'Ba.*')).toBe(true);
      expect(matchesHookPattern('Read', 'Read|Write')).toBe(true);
      expect(matchesHookPattern('Write', 'Read|Write')).toBe(true);
      expect(matchesHookPattern('Edit', 'Read|Write')).toBe(false);
    });

    it('should handle case insensitive matching', () => {
      expect(matchesHookPattern('bash', 'Bash')).toBe(true);
      expect(matchesHookPattern('READ', 'read')).toBe(true);
    });

    it('should handle invalid regex gracefully', () => {
      expect(matchesHookPattern('Bash', '[invalid')).toBe(false);
      expect(matchesHookPattern('[invalid', '[invalid')).toBe(true);
    });

    it('should match wildcard patterns', () => {
      expect(matchesHookPattern('Bash', '.*')).toBe(true);
      expect(matchesHookPattern('AnyTool', '.*')).toBe(true);
      expect(matchesHookPattern('Read', '.*Read.*')).toBe(true);
    });
  });

  describe('findMatchingHooks', () => {
    it('should find all matching hooks for a tool and event', () => {
      const hooks: HooksConfig = {
        'PreToolUse': {
          'Bash': { type: 'command', command: 'echo "exact match"' },
          'Ba.*': { type: 'command', command: 'echo "regex match"' },
          '.*': { type: 'command', command: 'echo "wildcard match"' }
        }
      };

      const result = findMatchingHooks(hooks, HookEventType.PRE_TOOL_USE, 'Bash');
      expect(result).toHaveLength(3);
      expect(result.map(r => r.pattern)).toEqual(['Bash', 'Ba.*', '.*']);
    });

    it('should return empty array for no matches', () => {
      const hooks: HooksConfig = {
        'PreToolUse': {
          'Read': { type: 'command', command: 'echo "read only"' }
        }
      };

      const result = findMatchingHooks(hooks, HookEventType.PRE_TOOL_USE, 'Bash');
      expect(result).toHaveLength(0);
    });

    it('should handle non-existent event types', () => {
      const hooks: HooksConfig = {
        'PostToolUse': {
          'Bash': { type: 'command', command: 'echo "post only"' }
        }
      };

      const result = findMatchingHooks(hooks, HookEventType.PRE_TOOL_USE, 'Bash');
      expect(result).toHaveLength(0);
    });
  });

  describe('validateAndReportHooks', () => {
    it('should provide user-friendly validation results', () => {
      const hooks: HooksConfig = {
        'PreToolUse': {
          'Bash': { type: 'command', command: 'echo "safe command"' },
          'Read': { type: 'command', command: 'sudo rm -rf /' } // Dangerous command
        }
      };

      const result = validateAndReportHooks(hooks);
      expect(result.valid).toBe(true); // Structure is valid
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(i => i.type === 'security')).toBe(true);
      expect(result.summary).toContain('1 event types configured');
    });

    it('should handle invalid configurations', () => {
      const hooks: HooksConfig = {
        'InvalidEvent': {
          'Bash': { type: 'command', command: 'echo "test"' }
        }
      };

      const result = validateAndReportHooks(hooks);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.type === 'error')).toBe(true);
      expect(result.summary).toContain('errors');
    });
  });

  describe('getHooksStatistics', () => {
    it('should provide statistics about hooks configuration', () => {
      const hooks: HooksConfig = {
        'PreToolUse': {
          'Bash': { type: 'command', command: 'echo "test"', timeout: 30 },
          'Read': { type: 'command', command: 'cat file.txt' }
        },
        'PostToolUse': {
          'Write': { type: 'command', command: 'sudo touch file', timeout: 45 }
        }
      };

      const result = getHooksStatistics(hooks);
      expect(result.totalHooks).toBe(3);
      expect(result.eventTypes).toEqual(['PreToolUse', 'PostToolUse']);
      expect(result.toolPatterns).toEqual(['Bash', 'Read', 'Write']);
      expect(result.averageTimeout).toBe(37.5); // (30 + 45) / 2
      expect(result.securityIssueCount).toBe(1); // sudo command
    });

    it('should handle empty hooks configuration', () => {
      const hooks: HooksConfig = {};
      const result = getHooksStatistics(hooks);
      expect(result.totalHooks).toBe(0);
      expect(result.eventTypes).toEqual([]);
      expect(result.toolPatterns).toEqual([]);
      expect(result.averageTimeout).toBe(60); // Default
      expect(result.securityIssueCount).toBe(0);
    });

    it('should handle hooks without timeouts', () => {
      const hooks: HooksConfig = {
        'PreToolUse': {
          'Bash': { type: 'command', command: 'echo "no timeout"' },
          'Read': { type: 'command', command: 'cat file.txt' }
        }
      };

      const result = getHooksStatistics(hooks);
      expect(result.totalHooks).toBe(2);
      expect(result.averageTimeout).toBe(60); // Default when no timeouts specified
    });
  });
});