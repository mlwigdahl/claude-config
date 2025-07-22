/**
 * Tests for JSON file utilities
 */

import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import { ConsolidatedFileSystem } from '../consolidated-filesystem.js';
import { ErrorCode } from '../error-handling.js';
import {
  readJsonFile,
  writeJsonFile,
  updateJsonFile,
  validateSettingsSchema
} from '../json-file.js';
import { SettingsConfig } from '../../types/settings.js';

describe('JSON File Utilities', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'claude-config-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
    await ConsolidatedFileSystem.ensureDirectory(tempDir);
  });

  afterEach(async () => {
    await ConsolidatedFileSystem.removeDirectory(tempDir, true);
  });

  describe('readJsonFile', () => {
    it('should read valid JSON file', async () => {
      const testFile = path.join(tempDir, 'test.json');
      const testData = { test: 'value', number: 42 };
      const jsonString = JSON.stringify(testData);
      
      console.log('Test data:', testData);
      console.log('JSON string:', jsonString);
      console.log('Writing to:', testFile);
      
      await ConsolidatedFileSystem.writeFile(testFile, jsonString);
      
      // Add a small delay to ensure file system operations complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('File exists after write:', await ConsolidatedFileSystem.fileExists(testFile));
      
      // Test with basic fs to compare
      const testFile2 = path.join(tempDir, 'test2.json');
      console.log('Testing basic fs operations...');
      await fs.writeFile(testFile2, jsonString, 'utf8');
      const basicFsContent = await fs.readFile(testFile2, 'utf8');
      console.log('Basic fs content:', basicFsContent);
      console.log('Basic fs content length:', basicFsContent.length);
      
      const rawContent = await ConsolidatedFileSystem.readFile(testFile);
      console.log('ConsolidatedFS content:', rawContent);
      console.log('ConsolidatedFS content length:', rawContent.length);
      
      const result = await readJsonFile(testFile);
      console.log('Parsed result:', result);
      expect(result).toEqual(testData);
    });

    it('should handle empty files', async () => {
      const testFile = path.join(tempDir, 'empty.json');
      await ConsolidatedFileSystem.writeFile(testFile, '');
      
      const result = await readJsonFile(testFile);
      expect(result).toEqual({});
    });

    it('should throw error for non-existent file', async () => {
      const testFile = path.join(tempDir, 'nonexistent.json');
      
      await expect(readJsonFile(testFile)).rejects.toMatchObject({
        code: ErrorCode.FILE_NOT_FOUND
      });
    });

    it('should throw error for invalid JSON', async () => {
      const testFile = path.join(tempDir, 'invalid.json');
      await ConsolidatedFileSystem.writeFile(testFile, '{ invalid json }');
      
      await expect(readJsonFile(testFile)).rejects.toMatchObject({
        code: ErrorCode.JSON_PARSE_ERROR
      });
    });
  });

  describe('writeJsonFile', () => {
    it('should write JSON file with pretty formatting', async () => {
      const testFile = path.join(tempDir, 'output.json');
      const testData = { test: 'value', nested: { key: 'value' } };
      
      await writeJsonFile(testFile, testData);
      
      const written = await ConsolidatedFileSystem.readFile(testFile);
      expect(written).toContain('  "test": "value"'); // Pretty printed
      expect(written.endsWith('\n')).toBe(true); // Ends with newline
      
      const parsed = JSON.parse(written);
      expect(parsed).toEqual(testData);
    });

    it('should create directories if they don\'t exist', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'test.json');
      const testData = { test: 'value' };
      
      await writeJsonFile(nestedPath, testData);
      
      const exists = await ConsolidatedFileSystem.fileExists(nestedPath);
      expect(exists).toBe(true);
    });

    it('should create backup when requested', async () => {
      const testFile = path.join(tempDir, 'backup-test.json');
      const originalData = { original: true };
      const newData = { updated: true };
      
      // Write original file
      await writeJsonFile(testFile, originalData);
      
      // Update with backup
      await writeJsonFile(testFile, newData, { createBackup: true });
      
      // Check backup was created
      const files = await ConsolidatedFileSystem.listDirectory(tempDir);
      const backupFiles = files.filter(f => f.includes('backup-test.json.backup'));
      expect(backupFiles.length).toBe(1);
    });
  });

  describe('updateJsonFile', () => {
    it('should merge updates with existing content', async () => {
      const testFile = path.join(tempDir, 'merge-test.json');
      const originalData = { keep: 'this', replace: 'old' };
      const updates = { replace: 'new', add: 'added' };
      
      await writeJsonFile(testFile, originalData);
      
      const result = await updateJsonFile(testFile, updates);
      
      expect(result).toEqual({
        keep: 'this',
        replace: 'new',
        add: 'added'
      });
    });

    it('should create file if it doesn\'t exist', async () => {
      const testFile = path.join(tempDir, 'new-file.json');
      const updates = { new: 'content' };
      
      const result = await updateJsonFile(testFile, updates);
      
      expect(result).toEqual(updates);
      
      const written = await readJsonFile(testFile);
      expect(written).toEqual(updates);
    });

    it('should merge arrays when mergeArrays is true', async () => {
      const testFile = path.join(tempDir, 'array-merge.json');
      const originalData = { permissions: { allow: ['Read', 'Write'] } };
      const updates = { permissions: { allow: ['Execute'], deny: ['Delete'] } };
      
      await writeJsonFile(testFile, originalData);
      
      const result = await updateJsonFile(testFile, updates, { mergeArrays: true });
      
      expect(result.permissions.allow).toContain('Read');
      expect(result.permissions.allow).toContain('Write');
      expect(result.permissions.allow).toContain('Execute');
      expect(result.permissions.deny).toEqual(['Delete']);
    });
  });

  describe('validateSettingsSchema', () => {
    it('should accept valid settings', () => {
      const validSettings: SettingsConfig = {
        apiKeyHelper: 'my-script.sh',
        cleanupPeriodDays: 30,
        env: { NODE_ENV: 'production' },
        permissions: {
          allow: ['Read', 'Write'],
          deny: ['Execute']
        },
        model: 'claude-3-opus',
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{
                type: 'command',
                command: 'echo "Before bash"',
                timeout: 30
              }]
            }
          ]
        }
      };
      
      const result = validateSettingsSchema(validSettings);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject non-object settings', () => {
      const result = validateSettingsSchema('invalid');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].message).toContain('must be a JSON object');
    });

    it('should reject invalid field types', () => {
      const invalidSettings = {
        apiKeyHelper: 123, // Should be string
        cleanupPeriodDays: 'thirty', // Should be number
        env: 'not-object', // Should be object
        permissions: [], // Should be object
        model: true // Should be string
      };
      
      const result = validateSettingsSchema(invalidSettings);
      
      expect(result.valid).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject unknown fields', () => {
      const settingsWithUnknown = {
        validField: 'apiKeyHelper',
        unknownField: 'value'
      };
      
      const result = validateSettingsSchema(settingsWithUnknown);
      
      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Unknown field'))).toBe(true);
    });

    it('should validate hook structure', () => {
      const invalidHooks = {
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{
                type: 'invalid-type', // Should be 'command'
                command: 123, // Should be string
                timeout: -5 // Should be positive
              }]
            }
          ]
        }
      };
      
      const result = validateSettingsSchema(invalidHooks);
      
      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Hook type must be "command"'))).toBe(true);
      expect(result.errors!.some(e => e.message.includes('Hook command must be a string'))).toBe(true);
      expect(result.errors!.some(e => e.message.includes('Hook timeout must be a positive number'))).toBe(true);
    });

    it('should validate hook event types', () => {
      const invalidEventType = {
        hooks: {
          InvalidEventType: [
            {
              matcher: 'Bash',
              hooks: [{
                type: 'command',
                command: 'echo "test"'
              }]
            }
          ]
        }
      };
      
      const result = validateSettingsSchema(invalidEventType);
      
      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Invalid hook event type: "InvalidEventType"'))).toBe(true);
      expect(result.errors!.some(e => e.message.includes('Valid event types are: PreToolUse, PostToolUse, Notification, Stop, SubagentStop, PreCompact'))).toBe(true);
    });

    it('should validate permission structure', () => {
      const invalidPermissions = {
        permissions: {
          allow: 'not-array', // Should be array
          deny: ['valid', 123] // Array elements should be strings
        }
      };
      
      const result = validateSettingsSchema(invalidPermissions);
      
      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('permissions.allow must be an array'))).toBe(true);
    });

    it('should validate environment variables', () => {
      const invalidEnv = {
        env: {
          VALID_VAR: 'string-value',
          INVALID_VAR: 123 // Should be string
        }
      };
      
      const result = validateSettingsSchema(invalidEnv);
      
      expect(result.valid).toBe(false);
      expect(result.errors!.some(e => e.message.includes('Environment variable INVALID_VAR must be a string'))).toBe(true);
    });
  });
});