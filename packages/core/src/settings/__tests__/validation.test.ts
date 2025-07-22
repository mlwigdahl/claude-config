/**
 * Tests for settings validation utilities
 */

import * as path from 'path';
import * as os from 'os';
import {
  validateSettingsPath,
  getSettingsFileType,
  getStandardSettingsPaths,
  validatePermissionPattern,
  validateHookEventType,
  validateHookMatcher
} from '../validation.js';
import { SettingsFileType } from '../../types/settings.js';

describe('Settings Validation', () => {
  const testProjectRoot = '/test/project';
  const homeDir = os.homedir();

  describe('validateSettingsPath', () => {
    it('should accept valid user settings path', async () => {
      const userSettingsPath = path.join(homeDir, '.claude', 'settings.json');
      const result = await validateSettingsPath(testProjectRoot, userSettingsPath);
      
      expect(result.valid).toBe(true);
    });

    it('should accept valid project shared settings path', async () => {
      const projectSettingsPath = path.join(testProjectRoot, '.claude', 'settings.json');
      const result = await validateSettingsPath(testProjectRoot, projectSettingsPath);
      
      expect(result.valid).toBe(true);
    });

    it('should accept valid project local settings path', async () => {
      const projectLocalPath = path.join(testProjectRoot, '.claude', 'settings.local.json');
      const result = await validateSettingsPath(testProjectRoot, projectLocalPath);
      
      expect(result.valid).toBe(true);
    });

    it('should reject invalid filename', async () => {
      const invalidPath = path.join(testProjectRoot, '.claude', 'config.json');
      const result = await validateSettingsPath(testProjectRoot, invalidPath);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid settings filename');
    });

    it('should reject wrong directory', async () => {
      const wrongDirPath = path.join(testProjectRoot, 'config', 'settings.json');
      const result = await validateSettingsPath(testProjectRoot, wrongDirPath);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('must be in a .claude directory');
    });

    it('should reject settings.local.json in user directory', async () => {
      const userLocalPath = path.join(homeDir, '.claude', 'settings.local.json');
      const result = await validateSettingsPath(testProjectRoot, userLocalPath);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('settings.local.json is only valid for project-level settings');
    });

    it('should reject path outside valid locations', async () => {
      const invalidPath = '/random/path/.claude/settings.json';
      const result = await validateSettingsPath(testProjectRoot, invalidPath);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('must be in either');
    });
  });

  describe('getSettingsFileType', () => {
    it('should identify user settings file', () => {
      const userPath = path.join(homeDir, '.claude', 'settings.json');
      const type = getSettingsFileType(userPath);
      
      expect(type).toBe(SettingsFileType.USER);
    });

    it('should identify project shared settings file', () => {
      const projectPath = path.join(testProjectRoot, '.claude', 'settings.json');
      const type = getSettingsFileType(projectPath);
      
      expect(type).toBe(SettingsFileType.PROJECT_SHARED);
    });

    it('should identify project local settings file', () => {
      const projectLocalPath = path.join(testProjectRoot, '.claude', 'settings.local.json');
      const type = getSettingsFileType(projectLocalPath);
      
      expect(type).toBe(SettingsFileType.PROJECT_LOCAL);
    });
  });

  describe('getStandardSettingsPaths', () => {
    it('should return all standard paths', () => {
      const paths = getStandardSettingsPaths(testProjectRoot);
      
      expect(paths[SettingsFileType.USER]).toBe(path.join(homeDir, '.claude', 'settings.json'));
      expect(paths[SettingsFileType.PROJECT_SHARED]).toBe(path.join(testProjectRoot, '.claude', 'settings.json'));
      expect(paths[SettingsFileType.PROJECT_LOCAL]).toBe(path.join(testProjectRoot, '.claude', 'settings.local.json'));
      expect(paths[SettingsFileType.ENTERPRISE]).toBe('/etc/claude/settings.json');
    });
  });

  describe('validatePermissionPattern', () => {
    it('should accept valid patterns', () => {
      expect(validatePermissionPattern('Bash')).toBe(true);
      expect(validatePermissionPattern('*')).toBe(true);
      expect(validatePermissionPattern('Bash(*)')).toBe(true);
      expect(validatePermissionPattern('Read[*.ts]')).toBe(true);
    });

    it('should reject empty or whitespace patterns', () => {
      expect(validatePermissionPattern('')).toBe(false);
      expect(validatePermissionPattern('   ')).toBe(false);
    });

    it('should reject patterns with invalid characters', () => {
      expect(validatePermissionPattern('Bash;rm -rf')).toBe(false);
      expect(validatePermissionPattern('tool<script>')).toBe(false);
    });
  });

  describe('validateHookEventType', () => {
    it('should accept valid event types', () => {
      expect(validateHookEventType('PreToolUse')).toBe(true);
      expect(validateHookEventType('PostToolUse')).toBe(true);
      expect(validateHookEventType('Notification')).toBe(true);
      expect(validateHookEventType('Stop')).toBe(true);
      expect(validateHookEventType('SubagentStop')).toBe(true);
      expect(validateHookEventType('PreCompact')).toBe(true);
    });

    it('should reject invalid event types', () => {
      expect(validateHookEventType('InvalidEvent')).toBe(false);
      expect(validateHookEventType('pretooluse')).toBe(false);
      expect(validateHookEventType('')).toBe(false);
    });
  });

  describe('validateHookMatcher', () => {
    it('should accept exact string matchers', () => {
      expect(validateHookMatcher('Bash')).toBe(true);
      expect(validateHookMatcher('Bash(npm run test)')).toBe(true);
    });

    it('should accept valid regex matchers', () => {
      expect(validateHookMatcher('/Bash.*/')).toBe(true);
      expect(validateHookMatcher('/Read\\([^)]+\\.ts\\)/')).toBe(true);
    });

    it('should reject invalid regex matchers', () => {
      expect(validateHookMatcher('/[invalid/')).toBe(false);
      expect(validateHookMatcher('/unclosed(')).toBe(false);
    });

    it('should reject empty matchers', () => {
      expect(validateHookMatcher('')).toBe(false);
      expect(validateHookMatcher('   ')).toBe(false);
    });
  });
});