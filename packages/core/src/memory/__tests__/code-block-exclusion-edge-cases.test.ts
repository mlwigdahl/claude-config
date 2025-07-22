/**
 * Edge case tests for code block import exclusion
 * Tests complex markdown scenarios that could break import parsing
 */

import { describe, it, expect } from '@jest/globals';
import { extractImports } from '../validation.js';

describe('Code Block Import Exclusion Edge Cases', () => {
  describe('complex markdown structures', () => {
    it('should handle nested code blocks in markdown code blocks', () => {
      const content = `
# Memory File

This is normal content.

\`\`\`markdown
# This is a markdown code block
@ignore-this-import.md

\`\`\`javascript
@also-ignore-this.md
\`\`\`
\`\`\`

@valid-import.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual(['valid-import.md']);
    });

    it('should handle mixed code spans and blocks', () => {
      const content = `
# Memory File

Regular content with \`@inline-ignore.md\` inline code.

\`\`\`
@block-ignore.md
\`\`\`

More content.

@valid-import1.md

Code span again: \`@another-inline-ignore.md\`

@valid-import2.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual(['valid-import1.md', 'valid-import2.md']);
    });

    it('should handle indented code blocks (4 spaces)', () => {
      const content = `
# Memory File

Regular content.

    @ignore-indented.md
    This is an indented code block
    @also-ignore-indented.md

@valid-import.md

    Another indented block
    @ignore-this-too.md

@another-valid-import.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual(['valid-import.md', 'another-valid-import.md']);
    });

    it('should handle tab-indented code blocks', () => {
      const content = `
# Memory File

Regular content.

\t@ignore-tab-indented.md
\tThis is a tab-indented code block

@valid-import.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual(['valid-import.md']);
    });
  });

  describe('malformed markdown edge cases', () => {
    it('should handle unclosed code blocks', () => {
      const content = `
# Memory File

\`\`\`
@ignore-unclosed.md

@this-should-also-be-ignored.md

# This block is never closed
@and-this-too.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual([]); // All should be ignored due to unclosed block
    });

    it('should handle mismatched code fence markers', () => {
      const content = `
# Memory File

\`\`\`
@ignore-in-backticks.md
~~~

@valid-after-mismatch.md

~~~
@ignore-in-tildes.md
\`\`\`

@valid-after-close.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual(['valid-after-mismatch.md', 'valid-after-close.md']);
    });

    it('should handle code blocks with language specifiers', () => {
      const content = `
# Memory File

\`\`\`javascript
@ignore-in-js.md
const x = 1;
\`\`\`

\`\`\`python
@ignore-in-python.md
print("hello")
\`\`\`

\`\`\`markdown
@ignore-in-markdown.md
# This is markdown
\`\`\`

@valid-import.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual(['valid-import.md']);
    });

    it('should handle empty code blocks', () => {
      const content = `
# Memory File

\`\`\`
\`\`\`

@valid-after-empty.md

\`\`\`javascript
\`\`\`

@another-valid.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual(['valid-after-empty.md', 'another-valid.md']);
    });
  });

  describe('inline code edge cases', () => {
    it('should handle multiple inline code spans in same line', () => {
      const content = `
# Memory File

This line has \`@ignore1.md\` and \`@ignore2.md\` inline code.

@valid-import.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual(['valid-import.md']);
    });

    it('should handle inline code with backticks inside', () => {
      const content = `
# Memory File

This is tricky: \`\`@ignore-double-backtick.md\`\`

@valid-import.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual(['valid-import.md']);
    });

    it('should handle escaped backticks', () => {
      const content = '# Memory File\n\nThis has escaped backticks: \\`content\\`\n\\`@this-is-not-code.md\\`\n\n@valid-import.md\n';

      const imports = extractImports(content);
      expect(imports).toEqual(['this-is-not-code.md', 'valid-import.md']);
    });
  });

  describe('whitespace and formatting edge cases', () => {
    it('should handle imports with extra whitespace', () => {
      const content = `
# Memory File

  @import-with-leading-spaces.md
\t@import-with-tab.md
@import-normal.md  
@import-with-trailing-spaces.md   
`;

      const imports = extractImports(content);
      expect(imports).toEqual([
        'import-with-leading-spaces.md',
        // 'import-with-tab.md' is ignored because 1 tab makes it an indented code block
        'import-normal.md',
        'import-with-trailing-spaces.md'
      ]);
    });

    it('should handle imports at line boundaries', () => {
      const content = `@first-line.md
# Memory File

Content here.

@middle-import.md
More content.
@last-line.md`;

      const imports = extractImports(content);
      expect(imports).toEqual(['first-line.md', 'middle-import.md', 'last-line.md']);
    });

    it('should handle imports with special characters', () => {
      const content = `
# Memory File

@file-with-dashes.md
@file_with_underscores.md
@file.with.dots.md
@file123with456numbers.md
@file+with+plus.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual([
        'file-with-dashes.md',
        'file_with_underscores.md',
        'file.with.dots.md',
        'file123with456numbers.md',
        'file+with+plus.md'
      ]);
    });
  });

  describe('complex real-world scenarios', () => {
    it('should handle documentation with code examples', () => {
      const content = `
# Claude Config Documentation

This is how to use memory files:

\`\`\`markdown
# Your Memory File
@shared-context.md
@project-specific.md
\`\`\`

The actual imports for this documentation:

@docs-shared.md
@examples.md

Here's some JavaScript code:

\`\`\`javascript
// This import should be ignored
import { something } from '@ignored-js-import.md';
\`\`\`

More documentation content:

@final-import.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual(['docs-shared.md', 'examples.md', 'final-import.md']);
    });

    it('should handle mixed content with quotes and code', () => {
      const content = `
# Memory File

Note: "This is a quote with import reference inside"
@quote-import.md

\`\`\`
@ignore-in-code.md
\`\`\`

Note: 'Single quotes with import reference'
@single-quote-import.md

@valid-import.md

\`This is inline code with @ignore-inline.md\`

@another-valid.md
`;

      const imports = extractImports(content);
      expect(imports).toEqual([
        'quote-import.md',
        'single-quote-import.md', 
        'valid-import.md',
        'another-valid.md'
      ]);
    });

    it('should handle performance with large files', () => {
      // Create a large markdown file with mixed content
      const lines = [];
      lines.push('# Large Memory File');
      
      for (let i = 0; i < 1000; i++) {
        if (i % 10 === 0) {
          lines.push(`@valid-import-${i}.md`);
        } else if (i % 5 === 0) {
          lines.push('```');
          lines.push(`@ignore-in-block-${i}.md`);
          lines.push('```');
        } else {
          lines.push(`Content line ${i} with \`@ignore-inline-${i}.md\``);
        }
      }

      const content = lines.join('\n');
      const startTime = Date.now();
      const imports = extractImports(content);
      const endTime = Date.now();

      expect(imports).toHaveLength(100); // Should find 100 valid imports
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
    });
  });
});