/**
 * Critical edge case tests for memory import depth validation
 * These tests ensure compliance with Claude Code's "max 5 hops" requirement
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validateImportChainDepth } from '../validation.js';

describe('Memory Import Depth Edge Cases', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(join(tmpdir(), 'claude-config-memory-depth-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('recursive import chain depth validation', () => {
    it('should reject import chains exceeding 5 hops depth', async () => {
      // Create a 7-hop chain: A → B → C → D → E → F → G
      const files = [
        { name: 'A.md', imports: ['@B.md'] },
        { name: 'B.md', imports: ['@C.md'] },
        { name: 'C.md', imports: ['@D.md'] },
        { name: 'D.md', imports: ['@E.md'] },
        { name: 'E.md', imports: ['@F.md'] },
        { name: 'F.md', imports: ['@G.md'] },
        { name: 'G.md', imports: [] }
      ];

      // Create test files
      for (const file of files) {
        const content = [
          '# Test File',
          ...file.imports,
          'Some content here'
        ].join('\n');
        await fs.writeFile(join(testDir, file.name), content);
      }

      const result = validateImportChainDepth(join(testDir, 'A.md'));
      expect(result.valid).toBe(false);
      expect(result.depth).toBe(6);
      expect(result.error).toContain('exceeds Claude Code');
    });

    it('should accept import chains at exactly 5 hops depth', async () => {
      // Create a 5-hop chain: A → B → C → D → E
      const files = [
        { name: 'A.md', imports: ['@B.md'] },
        { name: 'B.md', imports: ['@C.md'] },
        { name: 'C.md', imports: ['@D.md'] },
        { name: 'D.md', imports: ['@E.md'] },
        { name: 'E.md', imports: [] }
      ];

      for (const file of files) {
        const content = [
          '# Test File',
          ...file.imports,
          'Some content here'
        ].join('\n');
        await fs.writeFile(join(testDir, file.name), content);
      }

      const result = validateImportChainDepth(join(testDir, 'A.md'));
      expect(result.valid).toBe(true);
      expect(result.depth).toBe(4);
    });

    it('should calculate maximum depth in diamond import patterns', async () => {
      // Create diamond pattern: A→B→D, A→C→D, B→E, C→E
      // Max depth should be 3 (A→B→E or A→C→E)
      const files = [
        { name: 'A.md', imports: ['@B.md', '@C.md'] },
        { name: 'B.md', imports: ['@D.md', '@E.md'] },
        { name: 'C.md', imports: ['@D.md', '@E.md'] },
        { name: 'D.md', imports: [] },
        { name: 'E.md', imports: [] }
      ];

      for (const file of files) {
        const content = [
          '# Test File',
          ...file.imports,
          'Some content here'
        ].join('\n');
        await fs.writeFile(join(testDir, file.name), content);
      }

      const result = validateImportChainDepth(join(testDir, 'A.md'));
      expect(result.valid).toBe(true);
      expect(result.depth).toBe(2);
    });

    it('should handle complex import graphs with cycles', async () => {
      // Create cycle: A→B→C→A, but also A→D→E (depth 3)
      const files = [
        { name: 'A.md', imports: ['@B.md', '@D.md'] },
        { name: 'B.md', imports: ['@C.md'] },
        { name: 'C.md', imports: ['@A.md'] }, // Creates cycle
        { name: 'D.md', imports: ['@E.md'] },
        { name: 'E.md', imports: [] }
      ];

      for (const file of files) {
        const content = [
          '# Test File',
          ...file.imports,
          'Some content here'
        ].join('\n');
        await fs.writeFile(join(testDir, file.name), content);
      }

      const result = validateImportChainDepth(join(testDir, 'A.md'));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Circular');
    });

    it('should handle deep branching patterns efficiently', async () => {
      // Create tree: A has 3 children, each child has 2 children, etc.
      // A → B1,B2,B3 → C1,C2,C3,C4,C5,C6 → D1-D12
      const files = [
        { name: 'A.md', imports: ['@B1.md', '@B2.md', '@B3.md'] },
        { name: 'B1.md', imports: ['@C1.md', '@C2.md'] },
        { name: 'B2.md', imports: ['@C3.md', '@C4.md'] },
        { name: 'B3.md', imports: ['@C5.md', '@C6.md'] },
        { name: 'C1.md', imports: ['@D1.md', '@D2.md'] },
        { name: 'C2.md', imports: ['@D3.md', '@D4.md'] },
        { name: 'C3.md', imports: ['@D5.md', '@D6.md'] },
        { name: 'C4.md', imports: ['@D7.md', '@D8.md'] },
        { name: 'C5.md', imports: ['@D9.md', '@D10.md'] },
        { name: 'C6.md', imports: ['@D11.md', '@D12.md'] }
      ];

      // Add leaf nodes
      for (let i = 1; i <= 12; i++) {
        files.push({ name: `D${i}.md`, imports: [] });
      }

      for (const file of files) {
        const content = [
          '# Test File',
          ...file.imports,
          'Some content here'
        ].join('\n');
        await fs.writeFile(join(testDir, file.name), content);
      }

      const result = validateImportChainDepth(join(testDir, 'A.md'));
      expect(result.valid).toBe(true);
      expect(result.depth).toBe(3); // A→B→C→D
    });
  });

  describe('edge cases for import discovery', () => {
    it('should handle missing import files gracefully', async () => {
      const content = [
        '# Test File',
        '@missing-file.md',
        '@another-missing.md'
      ].join('\n');

      await fs.writeFile(join(testDir, 'test.md'), content);

      const result = validateImportChainDepth(join(testDir, 'test.md'));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Import file not found');
    });

    it('should handle relative path imports correctly', async () => {
      // Create nested directory structure
      await fs.mkdir(join(testDir, 'subdir'));
      
      const mainFile = [
        '# Main File',
        '@subdir/nested.md'
      ].join('\n');
      
      const nestedFile = [
        '# Nested File',
        '@../another.md'
      ].join('\n');

      const anotherFile = [
        '# Another File',
        'No imports here'
      ].join('\n');

      await fs.writeFile(join(testDir, 'main.md'), mainFile);
      await fs.writeFile(join(testDir, 'subdir', 'nested.md'), nestedFile);
      await fs.writeFile(join(testDir, 'another.md'), anotherFile);

      const result = validateImportChainDepth(join(testDir, 'main.md'));
      expect(result.valid).toBe(true);
      expect(result.depth).toBe(2); // main→nested→another
    });

    it('should handle very large import chains efficiently', async () => {
      // Test performance with exactly 5 hops but many files
      const files = [];
      const batchSize = 10;
      
      // Create 5 levels with 10 files each
      for (let level = 0; level < 5; level++) {
        for (let i = 0; i < batchSize; i++) {
          const fileName = `level${level}_${i}.md`;
          const imports = level < 4 ? 
            Array.from({ length: batchSize }, (_, j) => `@level${level + 1}_${j}.md`) :
            [];
          
          files.push({ name: fileName, imports });
        }
      }

      // Create all files
      for (const file of files) {
        const content = [
          '# Test File',
          ...file.imports,
          'Some content here'
        ].join('\n');
        await fs.writeFile(join(testDir, file.name), content);
      }

      const startTime = Date.now();
      const result = validateImportChainDepth(join(testDir, 'level0_0.md'));
      const endTime = Date.now();

      expect(result.valid).toBe(true);
      expect(result.depth).toBe(4);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in < 5 seconds
    });
  });
});