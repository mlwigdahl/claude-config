/**
 * Tests for Markdown file utilities
 */

import * as path from 'path';
import * as os from 'os';
import { ConsolidatedFileSystem } from '../consolidated-filesystem.js';
import { ErrorCode } from '../error-handling.js';
import {
  readMarkdownFile,
  writeMarkdownFile,
  updateMarkdownFile,
  parseFrontmatter,
  serializeFrontmatter,
  validateFrontmatter,
  validateSpecialSyntax,
  validateCommandContent
} from '../markdown-file.js';
import { SlashCommandContent } from '../../types/commands.js';

describe('Markdown File Utilities', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), 'claude-config-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
    await ConsolidatedFileSystem.ensureDirectory(tempDir);
  });

  afterEach(async () => {
    await ConsolidatedFileSystem.removeDirectory(tempDir, true);
  });

  describe('readMarkdownFile', () => {
    it('should read plain Markdown file', async () => {
      const testFile = path.join(tempDir, 'test.md');
      const content = 'This is a test command.\n\nUse $ARGUMENTS to pass parameters.';
      
      await ConsolidatedFileSystem.writeFile(testFile, content);
      
      const result = await readMarkdownFile(testFile);
      expect(result.content).toBe(content + '\n');
      expect(result.rawContent).toBe(content + '\n');
      expect(result.frontmatter).toBeUndefined();
    });

    it('should read Markdown file with frontmatter', async () => {
      const testFile = path.join(tempDir, 'test.md');
      const content = `---
description: Test command
allowed-tools:
  - Read
  - Write
---
This is a test command.

Use $ARGUMENTS to pass parameters.`;
      
      await ConsolidatedFileSystem.writeFile(testFile, content);
      
      const result = await readMarkdownFile(testFile);
      expect(result.frontmatter).toEqual({
        description: 'Test command',
        'allowed-tools': ['Read', 'Write']
      });
      expect(result.content).toBe('This is a test command.\n\nUse $ARGUMENTS to pass parameters.\n');
      expect(result.rawContent).toBe(content + '\n');
    });

    it('should handle empty files', async () => {
      const testFile = path.join(tempDir, 'empty.md');
      await ConsolidatedFileSystem.writeFile(testFile, '');
      
      const result = await readMarkdownFile(testFile);
      expect(result.content).toBe('');
      expect(result.rawContent).toBe('');
      expect(result.frontmatter).toBeUndefined();
    });

    it('should throw error for non-existent file', async () => {
      const testFile = path.join(tempDir, 'nonexistent.md');
      
      await expect(readMarkdownFile(testFile)).rejects.toMatchObject({
        code: ErrorCode.FILE_NOT_FOUND
      });
    });

    it('should handle malformed frontmatter', async () => {
      const testFile = path.join(tempDir, 'malformed.md');
      const content = `---
invalid: yaml: content:
---
Command content`;
      
      await ConsolidatedFileSystem.writeFile(testFile, content);
      
      await expect(readMarkdownFile(testFile)).rejects.toMatchObject({
        code: ErrorCode.MARKDOWN_PARSE_ERROR
      });
    });
  });

  describe('writeMarkdownFile', () => {
    it('should write plain Markdown file', async () => {
      const testFile = path.join(tempDir, 'output.md');
      const content: SlashCommandContent = {
        content: 'This is a test command.',
        rawContent: 'This is a test command.'
      };
      
      await writeMarkdownFile(testFile, content);
      
      const written = await ConsolidatedFileSystem.readFile(testFile);
      expect(written).toBe('This is a test command.\n');
    });

    it('should write Markdown file with frontmatter', async () => {
      const testFile = path.join(tempDir, 'output.md');
      const content: SlashCommandContent = {
        frontmatter: {
          description: 'Test command',
          'allowed-tools': ['Read', 'Write']
        },
        content: 'This is a test command.',
        rawContent: ''
      };
      
      await writeMarkdownFile(testFile, content);
      
      const written = await ConsolidatedFileSystem.readFile(testFile);
      expect(written).toContain('---');
      expect(written).toContain('description: Test command');
      expect(written).toContain('allowed-tools:');
      expect(written).toContain('This is a test command.');
    });

    it('should create directories if they don\'t exist', async () => {
      const nestedPath = path.join(tempDir, 'nested', 'dir', 'test.md');
      const content: SlashCommandContent = {
        content: 'Test content',
        rawContent: 'Test content'
      };
      
      await writeMarkdownFile(nestedPath, content);
      
      const exists = await ConsolidatedFileSystem.fileExists(nestedPath);
      expect(exists).toBe(true);
    });

    it('should create backup when requested', async () => {
      const testFile = path.join(tempDir, 'backup-test.md');
      const originalContent: SlashCommandContent = {
        content: 'Original content',
        rawContent: 'Original content'
      };
      const newContent: SlashCommandContent = {
        content: 'Updated content',
        rawContent: 'Updated content'
      };
      
      // Write original file
      await writeMarkdownFile(testFile, originalContent);
      
      // Update with backup
      await writeMarkdownFile(testFile, newContent, { createBackup: true });
      
      // Check backup was created
      const files = await ConsolidatedFileSystem.listDirectory(tempDir);
      const backupFiles = files.filter(f => f.includes('backup-test.md.backup'));
      expect(backupFiles.length).toBe(1);
    });
  });

  describe('updateMarkdownFile', () => {
    it('should merge updates with existing content', async () => {
      const testFile = path.join(tempDir, 'merge-test.md');
      const originalContent: SlashCommandContent = {
        frontmatter: {
          description: 'Original description'
        },
        content: 'Original content',
        rawContent: ''
      };
      const updates: Partial<SlashCommandContent> = {
        frontmatter: {
          description: 'Updated description',
          'allowed-tools': ['Read']
        }
      };
      
      await writeMarkdownFile(testFile, originalContent);
      
      const result = await updateMarkdownFile(testFile, updates);
      
      expect(result.frontmatter).toEqual({
        description: 'Updated description',
        'allowed-tools': ['Read']
      });
      expect(result.content).toBe('Original content\n');
    });

    it('should create file if it doesn\'t exist', async () => {
      const testFile = path.join(tempDir, 'new-file.md');
      const updates: Partial<SlashCommandContent> = {
        content: 'New content'
      };
      
      const result = await updateMarkdownFile(testFile, updates);
      
      expect(result.content).toBe('New content');
      
      const written = await readMarkdownFile(testFile);
      expect(written.content).toBe('New content\n');
    });
  });

  describe('parseFrontmatter', () => {
    it('should parse content without frontmatter', () => {
      const content = 'This is plain markdown content.';
      const result = parseFrontmatter(content);
      
      expect(result.content).toBe(content);
      expect(result.rawContent).toBe(content);
      expect(result.frontmatter).toBeUndefined();
    });

    it('should parse content with frontmatter', () => {
      const content = `---
description: Test command
allowed-tools:
  - Read
---
This is the content.`;
      
      const result = parseFrontmatter(content);
      
      expect(result.frontmatter).toEqual({
        description: 'Test command',
        'allowed-tools': ['Read']
      });
      expect(result.content).toBe('This is the content.');
      expect(result.rawContent).toBe(content);
    });

    it('should handle content with incomplete frontmatter', () => {
      const content = `---
description: Test
This is content without closing delimiter.`;
      
      const result = parseFrontmatter(content);
      
      // Should treat as plain content since no closing delimiter
      expect(result.content).toBe(content);
      expect(result.frontmatter).toBeUndefined();
    });

    it('should handle empty frontmatter', () => {
      const content = `---
---
Content after empty frontmatter.`;
      
      const result = parseFrontmatter(content);
      
      expect(result.content).toBe('Content after empty frontmatter.');
      expect(result.frontmatter).toBeUndefined();
    });
  });

  describe('serializeFrontmatter', () => {
    it('should serialize content without frontmatter', () => {
      const content: SlashCommandContent = {
        content: 'This is plain content.',
        rawContent: ''
      };
      
      const result = serializeFrontmatter(content);
      expect(result).toBe('This is plain content.');
    });

    it('should serialize content with frontmatter', () => {
      const content: SlashCommandContent = {
        frontmatter: {
          description: 'Test command',
          'allowed-tools': ['Read', 'Write']
        },
        content: 'This is the content.',
        rawContent: ''
      };
      
      const result = serializeFrontmatter(content);
      
      expect(result).toContain('---');
      expect(result).toContain('description: Test command');
      expect(result).toContain('allowed-tools:');
      expect(result).toContain('- Read');
      expect(result).toContain('- Write');
      expect(result).toContain('This is the content.');
    });
  });

  describe('validateFrontmatter', () => {
    it('should accept valid frontmatter', () => {
      const frontmatter = {
        description: 'Test command',
        'allowed-tools': ['Read', 'Write']
      };
      
      expect(validateFrontmatter(frontmatter)).toBe(true);
    });

    it('should accept frontmatter with only description', () => {
      const frontmatter = {
        description: 'Test command'
      };
      
      expect(validateFrontmatter(frontmatter)).toBe(true);
    });

    it('should accept frontmatter with only allowed-tools', () => {
      const frontmatter = {
        'allowed-tools': ['Read']
      };
      
      expect(validateFrontmatter(frontmatter)).toBe(true);
    });

    it('should reject non-object frontmatter', () => {
      expect(validateFrontmatter('string')).toBe(false);
      expect(validateFrontmatter(['array'])).toBe(false);
      expect(validateFrontmatter(null)).toBe(false);
    });

    it('should reject invalid field types', () => {
      expect(validateFrontmatter({ description: 123 })).toBe(false);
      expect(validateFrontmatter({ 'allowed-tools': 'not-array' })).toBe(false);
      expect(validateFrontmatter({ 'allowed-tools': [123] })).toBe(false);
    });
  });

  describe('validateSpecialSyntax', () => {
    it('should accept valid special syntax', () => {
      const content = `This command uses $ARGUMENTS.

!echo "Hello World"

@path/to/file.txt

Think about this problem.`;
      
      const result = validateSpecialSyntax(content);
      expect(result.valid).toBe(true);
    });

    it('should detect empty bash commands', () => {
      const content = '!';
      
      const result = validateSpecialSyntax(content);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].type).toBe('BASH_COMMAND');
    });

    it('should detect empty file references', () => {
      const content = 'Include file: @';
      
      const result = validateSpecialSyntax(content);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].type).toBe('FILE_REFERENCE');
    });

    it('should warn about unsafe file paths', () => {
      const content = '@../../../etc/passwd';
      
      const result = validateSpecialSyntax(content);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain('unsafe');
    });
  });

  describe('validateCommandContent', () => {
    it('should validate complete command content', () => {
      const content: SlashCommandContent = {
        frontmatter: {
          description: 'Test command',
          'allowed-tools': ['Read']
        },
        content: 'Use $ARGUMENTS for parameters.\n\n!echo "Hello"',
        rawContent: ''
      };
      
      const result = validateCommandContent(content);
      expect(result.valid).toBe(true);
    });

    it('should detect invalid frontmatter', () => {
      const content: SlashCommandContent = {
        frontmatter: {
          description: 123 // Invalid type
        } as any,
        content: 'Command content',
        rawContent: ''
      };
      
      const result = validateCommandContent(content);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should detect invalid special syntax', () => {
      const content: SlashCommandContent = {
        content: '! \n@',
        rawContent: ''
      };
      
      const result = validateCommandContent(content);
      expect(result.valid).toBe(false);
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });
});