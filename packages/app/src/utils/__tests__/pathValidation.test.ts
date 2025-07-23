/**
 * Tests for path validation utilities
 */

import { validateDirectoryPath, getPreferredDirectoryPath, getDefaultDirectoryForFileType } from '../pathValidation';

describe('pathValidation', () => {
  describe('validateDirectoryPath', () => {
    it('should accept any path for memory files', () => {
      const result = validateDirectoryPath('/some/path', 'memory', '/project/root');
      expect(result.isValid).toBe(true);
      expect(result.suggestedPath).toBe('/project/root');
    });

    it('should accept any path for settings files', () => {
      const result = validateDirectoryPath('/some/path', 'settings', '/project/root');
      expect(result.isValid).toBe(true);
      expect(result.suggestedPath).toBe('/project/root');
    });

    it('should require .claude/commands path for command files', () => {
      const result = validateDirectoryPath('/some/path', 'command', '/project/root');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toContain('.claude/commands');
      expect(result.suggestedPath).toBe('/some/path/.claude/commands');
    });

    it('should accept valid .claude/commands path for command files', () => {
      const result = validateDirectoryPath('/project/.claude/commands', 'command', '/project');
      expect(result.isValid).toBe(true);
    });

    it('should accept path ending with .claude/commands for command files', () => {
      const result = validateDirectoryPath('/project/.claude/commands', 'command', '/project');
      expect(result.isValid).toBe(true);
    });

    it('should return error for empty path', () => {
      const result = validateDirectoryPath('', 'memory');
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Directory path is required');
    });

    it('should handle unknown file types', () => {
      const result = validateDirectoryPath('/some/path', 'unknown' as any);
      expect(result.isValid).toBe(false);
      expect(result.errorMessage).toBe('Unknown file type');
    });
  });

  describe('getPreferredDirectoryPath', () => {
    it('should return project root when no selection for memory files', () => {
      const result = getPreferredDirectoryPath('memory', undefined, '/project/root');
      expect(result).toBe('/project/root');
    });

    it('should return selected directory for memory files', () => {
      const result = getPreferredDirectoryPath('memory', '/selected/dir', '/project/root');
      expect(result).toBe('/selected/dir');
    });

    it('should extract directory from file path for memory files', () => {
      const result = getPreferredDirectoryPath('memory', '/selected/dir/file.txt', '/project/root');
      expect(result).toBe('/selected/dir');
    });

    it('should return .claude/commands path for command files', () => {
      const result = getPreferredDirectoryPath('command', '/selected/dir', '/project/root');
      expect(result).toBe('/selected/dir/.claude/commands');
    });

    it('should preserve existing .claude/commands path for command files', () => {
      const result = getPreferredDirectoryPath('command', '/project/.claude/commands/subdir', '/project/root');
      expect(result).toBe('/project/.claude/commands/subdir');
    });

    it('should handle missing project root', () => {
      const result = getPreferredDirectoryPath('memory', '/selected/dir');
      expect(result).toBe('/selected/dir');
    });
  });

  describe('getDefaultDirectoryForFileType', () => {
    it('should return project root for memory files', () => {
      const result = getDefaultDirectoryForFileType('memory', '/project/root');
      expect(result).toBe('/project/root');
    });

    it('should return project root for settings files', () => {
      const result = getDefaultDirectoryForFileType('settings', '/project/root');
      expect(result).toBe('/project/root');
    });

    it('should return .claude/commands for command files', () => {
      const result = getDefaultDirectoryForFileType('command', '/project/root');
      expect(result).toBe('/project/root/.claude/commands');
    });

    it('should handle missing project root', () => {
      const result = getDefaultDirectoryForFileType('memory');
      expect(result).toBe('');
    });

    it('should handle unknown file types', () => {
      const result = getDefaultDirectoryForFileType('unknown' as any, '/project/root');
      expect(result).toBe('');
    });
  });
});