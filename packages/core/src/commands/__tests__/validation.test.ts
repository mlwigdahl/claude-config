/**
 * Tests for command validation utilities
 */

import * as path from 'path';
import * as os from 'os';
import {
  validateCommandPath,
  validateCommandName,
  validateNamespace,
  getCommandType,
  buildCommandPath,
  getStandardCommandPaths,
  parseCommandPath,
  validateCommandInvocation
} from '../validation.js';
import { SlashCommandType } from '../../types/commands.js';

describe('Command Validation', () => {
  const testProjectRoot = '/test/project';
  const homeDir = os.homedir();

  describe('validateCommandName', () => {
    it('should accept valid command names', () => {
      expect(validateCommandName('example')).toEqual({ valid: true });
      expect(validateCommandName('test-command')).toEqual({ valid: true });
      expect(validateCommandName('test_command')).toEqual({ valid: true });
      expect(validateCommandName('command123')).toEqual({ valid: true });
      expect(validateCommandName('1example')).toEqual({ valid: true });
    });

    it('should reject empty or whitespace names', () => {
      expect(validateCommandName('')).toEqual(
        expect.objectContaining({ valid: false, message: expect.stringContaining('empty') })
      );
      expect(validateCommandName('   ')).toEqual(
        expect.objectContaining({ valid: false, message: expect.stringContaining('empty') })
      );
    });

    it('should reject reserved command names', () => {
      expect(validateCommandName('help')).toEqual(
        expect.objectContaining({ 
          valid: false, 
          message: expect.stringContaining('reserved'),
          suggestion: expect.any(String)
        })
      );
      expect(validateCommandName('list')).toEqual(
        expect.objectContaining({ valid: false })
      );
    });

    it('should reject invalid patterns', () => {
      expect(validateCommandName('test command')).toEqual(
        expect.objectContaining({ valid: false, message: expect.stringContaining('letters, numbers') })
      );
      expect(validateCommandName('test.command')).toEqual(
        expect.objectContaining({ valid: false })
      );
      expect(validateCommandName('-test')).toEqual(
        expect.objectContaining({ valid: false })
      );
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(51);
      expect(validateCommandName(longName)).toEqual(
        expect.objectContaining({ 
          valid: false, 
          message: expect.stringContaining('too long') 
        })
      );
    });
  });

  describe('validateNamespace', () => {
    it('should accept valid namespaces', () => {
      expect(validateNamespace('git')).toEqual({ valid: true });
      expect(validateNamespace('git/commit')).toEqual({ valid: true });
      expect(validateNamespace('project/build/test')).toEqual({ valid: true });
      expect(validateNamespace('test-namespace')).toEqual({ valid: true });
      expect(validateNamespace('test_namespace')).toEqual({ valid: true });
    });

    it('should reject empty namespaces', () => {
      expect(validateNamespace('')).toEqual(
        expect.objectContaining({ valid: false, message: expect.stringContaining('empty') })
      );
      expect(validateNamespace('   ')).toEqual(
        expect.objectContaining({ valid: false })
      );
    });

    it('should reject invalid patterns', () => {
      expect(validateNamespace('test namespace')).toEqual(
        expect.objectContaining({ valid: false })
      );
      expect(validateNamespace('test.namespace')).toEqual(
        expect.objectContaining({ valid: false })
      );
    });

    it('should reject consecutive slashes', () => {
      expect(validateNamespace('git//commit')).toEqual(
        expect.objectContaining({ 
          valid: false, 
          message: expect.stringContaining('consecutive') 
        })
      );
    });

    it('should reject leading or trailing slashes', () => {
      expect(validateNamespace('/git')).toEqual(
        expect.objectContaining({ valid: false })
      );
      expect(validateNamespace('git/')).toEqual(
        expect.objectContaining({ valid: false })
      );
    });

    it('should reject deep nesting', () => {
      expect(validateNamespace('a/b/c/d')).toEqual(
        expect.objectContaining({ 
          valid: false, 
          message: expect.stringContaining('depth') 
        })
      );
    });

    it('should validate each namespace level', () => {
      expect(validateNamespace('git/-invalid')).toEqual(
        expect.objectContaining({ valid: false })
      );
    });
  });

  describe('getCommandType', () => {
    it('should identify user commands', () => {
      const userPath = path.join(homeDir, '.claude', 'commands', 'test.md');
      expect(getCommandType(userPath)).toBe(SlashCommandType.USER);
    });

    it('should identify project commands', () => {
      const projectPath = path.join(testProjectRoot, '.claude', 'commands', 'test.md');
      expect(getCommandType(projectPath)).toBe(SlashCommandType.PROJECT);
    });
  });

  describe('buildCommandPath', () => {
    it('should build project command path without namespace', () => {
      const expected = path.join(testProjectRoot, '.claude', 'commands', 'test.md');
      const actual = buildCommandPath(testProjectRoot, 'test');
      expect(actual).toBe(expected);
    });

    it('should build project command path with namespace', () => {
      const expected = path.join(testProjectRoot, '.claude', 'commands', 'git', 'commit.md');
      const actual = buildCommandPath(testProjectRoot, 'commit', 'git');
      expect(actual).toBe(expected);
    });

    it('should build user command path', () => {
      const expected = path.join(homeDir, '.claude', 'commands', 'test.md');
      const actual = buildCommandPath(testProjectRoot, 'test', undefined, SlashCommandType.USER);
      expect(actual).toBe(expected);
    });

    it('should handle nested namespaces', () => {
      const expected = path.join(testProjectRoot, '.claude', 'commands', 'git', 'flow', 'feature.md');
      const actual = buildCommandPath(testProjectRoot, 'feature', 'git/flow');
      expect(actual).toBe(expected);
    });
  });

  describe('getStandardCommandPaths', () => {
    it('should return standard paths', () => {
      const paths = getStandardCommandPaths(testProjectRoot);
      
      expect(paths[SlashCommandType.USER]).toBe(path.join(homeDir, '.claude', 'commands'));
      expect(paths[SlashCommandType.PROJECT]).toBe(path.join(testProjectRoot, '.claude', 'commands'));
    });
  });

  describe('parseCommandPath', () => {
    it('should parse command without namespace', () => {
      const baseDir = path.join(testProjectRoot, '.claude', 'commands');
      const filePath = path.join(baseDir, 'test.md');
      
      const { name, namespace } = parseCommandPath(filePath, baseDir);
      expect(name).toBe('test');
      expect(namespace).toBeUndefined();
    });

    it('should parse command with namespace', () => {
      const baseDir = path.join(testProjectRoot, '.claude', 'commands');
      const filePath = path.join(baseDir, 'git', 'commit.md');
      
      const { name, namespace } = parseCommandPath(filePath, baseDir);
      expect(name).toBe('commit');
      expect(namespace).toBe('git');
    });

    it('should parse command with nested namespace', () => {
      const baseDir = path.join(testProjectRoot, '.claude', 'commands');
      const filePath = path.join(baseDir, 'git', 'flow', 'feature.md');
      
      const { name, namespace } = parseCommandPath(filePath, baseDir);
      expect(name).toBe('feature');
      expect(namespace).toBe('git/flow');
    });
  });

  describe('validateCommandInvocation', () => {
    it('should accept valid invocations', () => {
      expect(validateCommandInvocation('/example')).toEqual({ valid: true });
      expect(validateCommandInvocation('/git:commit')).toEqual({ valid: true });
      expect(validateCommandInvocation('/project/build:deploy')).toEqual({ valid: true });
    });

    it('should reject invocations without leading slash', () => {
      expect(validateCommandInvocation('test')).toEqual(
        expect.objectContaining({ 
          valid: false, 
          message: expect.stringContaining('start with /') 
        })
      );
    });

    it('should reject invocations with invalid command names', () => {
      expect(validateCommandInvocation('/help')).toEqual(
        expect.objectContaining({ valid: false })
      );
    });

    it('should reject invocations with invalid namespaces', () => {
      expect(validateCommandInvocation('/git//commit')).toEqual(
        expect.objectContaining({ valid: false })
      );
    });
  });

  describe('validateCommandPath', () => {
    it('should accept valid project command paths', async () => {
      const commandPath = path.join(testProjectRoot, '.claude', 'commands', 'example.md');
      const result = await validateCommandPath(testProjectRoot, commandPath, 'example');
      
      expect(result.valid).toBe(true);
    });

    it('should accept valid user command paths', async () => {
      const commandPath = path.join(homeDir, '.claude', 'commands', 'example.md');
      const result = await validateCommandPath(testProjectRoot, commandPath, 'example');
      
      expect(result.valid).toBe(true);
    });

    it('should accept commands with namespaces', async () => {
      const commandPath = path.join(testProjectRoot, '.claude', 'commands', 'git', 'commit.md');
      const result = await validateCommandPath(testProjectRoot, commandPath, 'commit', 'git');
      
      expect(result.valid).toBe(true);
    });

    it('should reject wrong filename', async () => {
      const commandPath = path.join(testProjectRoot, '.claude', 'commands', 'wrong.md');
      const result = await validateCommandPath(testProjectRoot, commandPath, 'example');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('filename must be');
    });

    it('should reject invalid command names', async () => {
      const commandPath = path.join(testProjectRoot, '.claude', 'commands', 'help.md');
      const result = await validateCommandPath(testProjectRoot, commandPath, 'help');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('reserved');
    });

    it('should reject wrong directory', async () => {
      const commandPath = path.join(testProjectRoot, 'wrong', 'example.md');
      const result = await validateCommandPath(testProjectRoot, commandPath, 'example');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('must be in either');
    });

    it('should reject namespace mismatch', async () => {
      const commandPath = path.join(testProjectRoot, '.claude', 'commands', 'wrong', 'example.md');
      const result = await validateCommandPath(testProjectRoot, commandPath, 'example', 'git');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Namespace path mismatch');
    });

    it('should reject commands in subdirectory without namespace', async () => {
      const commandPath = path.join(testProjectRoot, '.claude', 'commands', 'git', 'example.md');
      const result = await validateCommandPath(testProjectRoot, commandPath, 'example');
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('subdirectory but no namespace');
    });
  });
});