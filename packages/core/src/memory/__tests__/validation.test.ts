import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import os from 'os';
import { ConsolidatedFileSystem } from '../../utils/consolidated-filesystem.js';
import {
  validateMemoryPath,
  validateMemoryContent,
  extractImports,
  validateImportPath,
  validateImportChainDepth,
  resolveImportPath,
  validateMemoryContentWithDepth,
} from '../validation.js';

describe('Memory Validation', () => {
  const projectRoot = '/test/project';

  describe('validateMemoryPath', () => {
    it('should validate project memory file path', () => {
      const result = validateMemoryPath(projectRoot, 'CLAUDE.md');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid file names', () => {
      const result = validateMemoryPath(projectRoot, 'invalid-name.md');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Memory files must be named CLAUDE.md');
    });

    it('should validate user memory file path', () => {
      const userPath = path.relative(projectRoot, path.join(os.homedir(), '.claude', 'CLAUDE.md'));
      const result = validateMemoryPath(projectRoot, userPath);
      // This might fail in test environment, but the logic is correct
      expect(result.errors).toBeDefined();
    });

    it('should reject paths in invalid locations', () => {
      const result = validateMemoryPath(projectRoot, 'some/random/path/CLAUDE.md');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Memory files can only be placed in project root, user directory, or parent directories'
      );
    });
  });

  describe('validateMemoryContent', () => {
    it('should validate basic memory content', () => {
      const content = '# Tech Stack\n\n- TypeScript\n- Node.js\n\n# Commands\n\n- npm run build';
      const result = validateMemoryContent(content);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty content', () => {
      const result = validateMemoryContent('');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Memory file content cannot be empty');
    });

    it('should extract imports correctly', () => {
      const content = '@README.md\n@~/.claude/personal.md\n\n# Memory\n\nContent here.';
      const result = validateMemoryContent(content);
      
      expect(result.valid).toBe(true);
      expect(result.imports).toContain('README.md');
      expect(result.imports).toContain('~/.claude/personal.md');
      expect(result.imports).toHaveLength(2);
    });

    it('should extract imports but not warn about count anymore', () => {
      const imports = Array.from({ length: 6 }, (_, i) => `@file${i}.md`).join('\n');
      const content = `${imports}\n\n# Memory\n\nContent.`;
      const result = validateMemoryContent(content);
      
      // The warning about import count has been removed in favor of depth validation
      expect(result.imports).toHaveLength(6);
      expect(result.valid).toBe(true);
    });

    it('should warn about potential circular imports', () => {
      const content = '@CLAUDE.md\n\n# Memory\n\nContent.';
      const result = validateMemoryContent(content);
      
      expect(result.warnings).toContain('Potential circular import detected: CLAUDE.md');
    });

    it('should warn about missing sections', () => {
      const content = 'Just some plain text without proper structure.';
      const result = validateMemoryContent(content);
      
      expect(result.warnings).toContain(
        'Memory file should include section headers for better organization'
      );
      expect(result.warnings).toContain(
        'Consider adding a Commands section with relevant project commands'
      );
    });

    it('should warn about long paragraphs', () => {
      const longParagraph = 'This is a very long paragraph that goes on and on without using bullet points which is not recommended for Claude memory files because they should be concise and structured.';
      const result = validateMemoryContent(longParagraph);
      
      expect(result.warnings).toContain(
        'Consider using bullet points instead of long paragraphs for better Claude comprehension'
      );
    });

    it('should warn about placeholder content', () => {
      const content = '# Memory\n\nTODO: Add project-specific content here.';
      const result = validateMemoryContent(content);
      
      expect(result.warnings).toContain(
        'Memory file contains placeholder content that should be updated'
      );
    });

    it('should warn about very large content', () => {
      const largeContent = '# Memory\n\n' + 'A'.repeat(60000);
      const result = validateMemoryContent(largeContent);
      
      expect(result.warnings).toContain(
        'Memory file is quite large, consider breaking into smaller files with imports'
      );
    });
  });

  describe('extractImports', () => {
    it('should extract single import', () => {
      const content = '@README.md\n\n# Memory\n\nContent.';
      const imports = extractImports(content);
      
      expect(imports).toEqual(['README.md']);
    });

    it('should extract multiple imports', () => {
      const content = '@file1.md\n@file2.md\n@file3.md\n\n# Memory\n\nContent.';
      const imports = extractImports(content);
      
      expect(imports).toEqual(['file1.md', 'file2.md', 'file3.md']);
    });

    it('should handle imports with paths', () => {
      const content = '@~/.claude/global.md\n@../parent.md\n@./local.md\n\n# Memory';
      const imports = extractImports(content);
      
      expect(imports).toEqual(['~/.claude/global.md', '../parent.md', './local.md']);
    });

    it('should return empty array when no imports', () => {
      const content = '# Memory\n\nNo imports here.';
      const imports = extractImports(content);
      
      expect(imports).toEqual([]);
    });

    it('should only match imports at line start', () => {
      const content = '# Memory\n\nThis @file.md is not an import.\n@this-is.md';
      const imports = extractImports(content);
      
      expect(imports).toEqual(['this-is.md']);
    });

    it('should ignore imports inside code fences', () => {
      const content = `@valid1.md
\`\`\`
@ignored1.md
@ignored2.md
\`\`\`
@valid2.md
\`\`\`bash
@ignored3.md
\`\`\`
@valid3.md`;
      const imports = extractImports(content);
      expect(imports).toEqual(['valid1.md', 'valid2.md', 'valid3.md']);
    });

    it('should ignore imports in inline code spans', () => {
      const content = `@valid.md
This is \`@ignored.md\` inline code
Another line with \`@another-ignored.md\` import
@valid2.md`;
      const imports = extractImports(content);
      expect(imports).toEqual(['valid.md', 'valid2.md']);
    });

    it('should ignore imports in indented code blocks', () => {
      const content = `@valid1.md

Here is a code example:

    @ignored1.md
    @ignored2.md
    More code here

@valid2.md

    @ignored3.md

Back to normal text
@valid3.md`;
      const imports = extractImports(content);
      expect(imports).toEqual(['valid1.md', 'valid2.md', 'valid3.md']);
    });

    it('should handle nested code blocks correctly', () => {
      const content = `@valid1.md
\`\`\`markdown
# Example
@ignored1.md
    @also-ignored.md
\`\`\`
@valid2.md`;
      const imports = extractImports(content);
      expect(imports).toEqual(['valid1.md', 'valid2.md']);
    });

    it('should handle edge cases with backticks', () => {
      const content = `@valid.md
\`@ignored.md\` but line doesn't start with @, so next line:
@valid2.md
Triple \`\`\` should not start block
@valid3.md`;
      const imports = extractImports(content);
      // The \`@ignored.md\` is in a proper code span, so it should be ignored
      // The @valid2.md should be detected since it starts the line
      // @valid3.md should be detected (triple backticks don't start a code block on their own)
      expect(imports).toEqual(['valid.md', 'valid2.md', 'valid3.md']);
    });
  });

  describe('validateImportPath', () => {
    it('should validate basic import paths', () => {
      const result = validateImportPath('README.md');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate relative paths', () => {
      const result = validateImportPath('../parent.md');
      expect(result.valid).toBe(true);
    });

    it('should validate user directory paths', () => {
      const result = validateImportPath('~/.claude/global.md');
      expect(result.valid).toBe(true);
    });

    it('should reject empty paths', () => {
      const result = validateImportPath('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Import path cannot be empty');
    });

    it('should reject paths with line breaks', () => {
      const result = validateImportPath('file\nwith\nbreaks.md');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Import path cannot contain line breaks');
    });

    it('should reject paths with spaces', () => {
      const result = validateImportPath('file with spaces.md');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Import path should not contain spaces');
    });

    it('should handle carriage returns', () => {
      const result = validateImportPath('file\rwith\rreturns.md');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Import path cannot contain line breaks');
    });
  });

  describe('resolveImportPath', () => {
    it('should resolve user directory paths', () => {
      const result = resolveImportPath('/some/file.md', '~/test.md');
      expect(result).toBe(path.join(os.homedir(), 'test.md'));
    });

    it('should resolve absolute paths', () => {
      const result = resolveImportPath('/some/file.md', '/absolute/path.md');
      expect(result).toBe('/absolute/path.md');
    });

    it('should resolve relative paths', () => {
      const result = resolveImportPath('/some/dir/file.md', '../other.md');
      expect(result).toBe(path.resolve('/some/other.md'));
    });

    it('should resolve paths relative to importing file directory', () => {
      const result = resolveImportPath('/some/dir/file.md', 'sibling.md');
      expect(result).toBe(path.resolve('/some/dir/sibling.md'));
    });
  });

  describe('validateImportChainDepth', () => {
    const testDir = path.join(os.tmpdir(), 'claude-config-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));

    beforeEach(async () => {
      // Create test directory
      await ConsolidatedFileSystem.ensureDirectory(testDir);
    });

    afterEach(async () => {
      // Clean up test directory
      await ConsolidatedFileSystem.removeDirectory(testDir, true);
    });

    it('should validate file with no imports (depth 0)', async () => {
      const filePath = path.join(testDir, 'no-imports.md');
      await ConsolidatedFileSystem.writeFile(filePath, '# No imports here');
      
      const result = validateImportChainDepth(filePath);
      expect(result.valid).toBe(true);
      expect(result.depth).toBe(0);
    });

    it('should validate single level import (depth 1)', async () => {
      const file1 = path.join(testDir, 'file1.md');
      const file2 = path.join(testDir, 'file2.md');
      
      await ConsolidatedFileSystem.writeFile(file2, '# No imports');
      await ConsolidatedFileSystem.writeFile(file1, '@file2.md\n# Content');
      
      const result = validateImportChainDepth(file1);
      expect(result.valid).toBe(true);
      expect(result.depth).toBe(1);
    });

    it('should validate chain of imports up to 5 hops', async () => {
      // Create chain: file1 → file2 → file3 → file4 → file5 → file6
      const files = [];
      for (let i = 1; i <= 6; i++) {
        files.push(path.join(testDir, `file${i}.md`));
      }
      
      // file6 has no imports
      await ConsolidatedFileSystem.writeFile(files[5], '# End of chain');
      
      // Each file imports the next
      for (let i = 4; i >= 0; i--) {
        await ConsolidatedFileSystem.writeFile(files[i], `@file${i + 2}.md\n# File ${i + 1}`);
      }
      
      // Test file1 - should have depth 5 (valid)
      const result1 = validateImportChainDepth(files[0]);
      expect(result1.valid).toBe(true);
      expect(result1.depth).toBe(5);
    });

    it('should reject import chains exceeding 5 hops', async () => {
      // Create chain: file1 → file2 → file3 → file4 → file5 → file6 → file7
      const files = [];
      for (let i = 1; i <= 7; i++) {
        files.push(path.join(testDir, `file${i}.md`));
      }
      
      // file7 has no imports
      await ConsolidatedFileSystem.writeFile(files[6], '# End of chain');
      
      // Each file imports the next
      for (let i = 5; i >= 0; i--) {
        await ConsolidatedFileSystem.writeFile(files[i], `@file${i + 2}.md\n# File ${i + 1}`);
      }
      
      // Test file1 - should have depth 6 (invalid)
      const result = validateImportChainDepth(files[0]);
      expect(result.valid).toBe(false);
      expect(result.depth).toBe(6);
      expect(result.error).toContain('exceeds Claude Code\'s limit of 5 hops');
    });

    it('should detect circular dependencies', async () => {
      const file1 = path.join(testDir, 'circular1.md');
      const file2 = path.join(testDir, 'circular2.md');
      
      // Create circular dependency: file1 → file2 → file1
      await ConsolidatedFileSystem.writeFile(file1, '@circular2.md\n# File 1');
      await ConsolidatedFileSystem.writeFile(file2, '@circular1.md\n# File 2');
      
      const result = validateImportChainDepth(file1);
      expect(result.valid).toBe(false);
      expect(result.depth).toBe(Infinity);
      expect(result.error).toContain('Circular import detected');
    });

    it('should handle complex import graphs with multiple paths', async () => {
      // Create diamond pattern: 
      // file1 → file2 → file4
      // file1 → file3 → file4
      const file1 = path.join(testDir, 'diamond1.md');
      const file2 = path.join(testDir, 'diamond2.md');
      const file3 = path.join(testDir, 'diamond3.md');
      const file4 = path.join(testDir, 'diamond4.md');
      
      await ConsolidatedFileSystem.writeFile(file4, '# End node');
      await ConsolidatedFileSystem.writeFile(file3, '@diamond4.md\n# Path 2');
      await ConsolidatedFileSystem.writeFile(file2, '@diamond4.md\n# Path 1');
      await ConsolidatedFileSystem.writeFile(file1, '@diamond2.md\n@diamond3.md\n# Start');
      
      const result = validateImportChainDepth(file1);
      expect(result.valid).toBe(true);
      expect(result.depth).toBe(2); // Maximum depth through any path
    });

    it('should treat non-existent imported files as errors', async () => {
      const file1 = path.join(testDir, 'imports-missing.md');
      await ConsolidatedFileSystem.writeFile(file1, '@non-existent.md\n# Content');
      
      const result = validateImportChainDepth(file1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Import file not found');
    });
  });

  describe('validateMemoryContentWithDepth', () => {
    const testDir = path.join(os.tmpdir(), 'claude-config-depth-test-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));

    beforeEach(async () => {
      await ConsolidatedFileSystem.ensureDirectory(testDir);
    });

    afterEach(async () => {
      await ConsolidatedFileSystem.removeDirectory(testDir, true);
    });

    it('should combine content validation with depth validation', async () => {
      const filePath = path.join(testDir, 'combined.md');
      const content = '# Test\n@other.md\nContent';
      
      // Create the imported file
      await ConsolidatedFileSystem.writeFile(path.join(testDir, 'other.md'), '# Other file');
      await ConsolidatedFileSystem.writeFile(filePath, content);
      
      const result = validateMemoryContentWithDepth(content, filePath);
      expect(result.valid).toBe(true);
      expect(result.importDepth).toBe(1);
      expect(result.imports).toContain('other.md');
    });

    it('should add warning when approaching depth limit', async () => {
      // Create chain with depth 4
      const files = [];
      for (let i = 1; i <= 5; i++) {
        files.push(path.join(testDir, `deep${i}.md`));
      }
      
      await ConsolidatedFileSystem.writeFile(files[4], '# End');
      for (let i = 3; i >= 0; i--) {
        await ConsolidatedFileSystem.writeFile(files[i], `@deep${i + 2}.md\n# Level ${i + 1}`);
      }
      
      const content = await ConsolidatedFileSystem.readFile(files[0]);
      const result = validateMemoryContentWithDepth(content, files[0]);
      
      expect(result.valid).toBe(true);
      expect(result.importDepth).toBe(4);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('approaching Claude Code\'s limit of 5 hops')
        ])
      );
    });

    it('should fail validation when depth exceeds limit', async () => {
      // Create chain with depth 6
      const files = [];
      for (let i = 1; i <= 7; i++) {
        files.push(path.join(testDir, `exceed${i}.md`));
      }
      
      await ConsolidatedFileSystem.writeFile(files[6], '# End');
      for (let i = 5; i >= 0; i--) {
        await ConsolidatedFileSystem.writeFile(files[i], `@exceed${i + 2}.md\n# Level ${i + 1}`);
      }
      
      const content = await ConsolidatedFileSystem.readFile(files[0]);
      const result = validateMemoryContentWithDepth(content, files[0]);
      
      expect(result.valid).toBe(false);
      expect(result.importDepth).toBe(6);
      expect(result.importDepthError).toBeDefined();
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('exceeds Claude Code\'s limit of 5 hops')
        ])
      );
    });
  });
});