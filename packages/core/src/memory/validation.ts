import path from 'path';
import os from 'os';
import * as fs from 'fs';
import { MemoryFileValidationResult } from '../types/memory.js';

/**
 * Check if a file path is in an ancestor directory of the project root
 */
function isAncestorPath(filePath: string, projectRoot: string): boolean {
  const fileDir = path.dirname(filePath);
  const projectRootResolved = path.resolve(projectRoot);
  const fileDirResolved = path.resolve(fileDir);

  // Check if the file directory is an ancestor of the project root
  const relativePath = path.relative(fileDirResolved, projectRootResolved);

  // If the relative path doesn't start with '..' and isn't empty,
  // then fileDir is an ancestor of projectRoot
  return (
    !relativePath.startsWith('..') &&
    relativePath !== '' &&
    !path.isAbsolute(relativePath)
  );
}

/**
 * Validate that a path is appropriate for memory files
 */
export function validateMemoryPath(
  projectRoot: string,
  targetPath: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Resolve the path
  const resolvedPath = path.resolve(projectRoot, targetPath);
  const fileName = path.basename(resolvedPath);

  // Check if it's a valid memory file name
  if (fileName !== 'CLAUDE.md') {
    errors.push('Memory files must be named CLAUDE.md');
  }

  // Check if path is within allowed locations
  const projectMemoryPath = path.join(projectRoot, 'CLAUDE.md');
  const userMemoryPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');

  const isProjectMemory = resolvedPath === path.resolve(projectMemoryPath);
  const isUserMemory = resolvedPath === path.resolve(userMemoryPath);

  // Check if it's in a parent directory (must be above project root)
  const isParentMemory =
    resolvedPath.endsWith('CLAUDE.md') &&
    resolvedPath !== path.resolve(projectMemoryPath) &&
    resolvedPath !== path.resolve(userMemoryPath) &&
    isAncestorPath(resolvedPath, projectRoot);

  if (!isProjectMemory && !isUserMemory && !isParentMemory) {
    errors.push(
      'Memory files can only be placed in project root, user directory, or parent directories'
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate memory file content (basic validation without file system access)
 */
export function validateMemoryContent(
  content: string
): MemoryFileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const imports: string[] = [];

  // Check basic content structure
  if (!content || content.trim().length === 0) {
    errors.push('Memory file content cannot be empty');
    return { isValid: false, errors, warnings, imports };
  }

  // Parse imports
  const importMatches = content.match(/^@([^\s\n]+)/gm);
  if (importMatches) {
    for (const match of importMatches) {
      const importPath = match.substring(1); // Remove @ prefix
      imports.push(importPath);

      // Validate import path
      if (importPath.includes('..')) {
        warnings.push(
          `Import path contains relative navigation: ${importPath}`
        );
      }

      // Check for circular imports (basic check)
      if (importPath.includes('CLAUDE.md')) {
        warnings.push(`Potential circular import detected: ${importPath}`);
      }
    }

    // Note: Import depth validation should be done separately with validateImportChainDepth
    // as it requires file system access and the full file path context
  }

  // Check for proper Markdown structure
  if (!content.includes('#')) {
    warnings.push(
      'Memory file should include section headers for better organization'
    );
  }

  // Check for overly long content
  if (content.length > 50000) {
    warnings.push(
      'Memory file is quite large, consider breaking into smaller files with imports'
    );
  }

  // Validate that content follows memory best practices
  validateMemoryBestPractices(content, warnings);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    imports,
  };
}

/**
 * Validate memory content against best practices
 */
function validateMemoryBestPractices(
  content: string,
  warnings: string[]
): void {
  // Check for narrative paragraphs (should use bullet points)
  const paragraphs = content
    .split('\n\n')
    .filter(
      p =>
        p.trim().length > 100 &&
        !p.startsWith('#') &&
        !p.startsWith('-') &&
        !p.startsWith('*') &&
        !p.startsWith('```')
    );

  if (paragraphs.length > 0) {
    warnings.push(
      'Consider using bullet points instead of long paragraphs for better Claude comprehension'
    );
  }

  // Check for presence of key sections
  const hasCommand =
    content.toLowerCase().includes('command') ||
    content.toLowerCase().includes('npm run') ||
    content.toLowerCase().includes('script');
  const hasTechStack =
    content.toLowerCase().includes('tech stack') ||
    content.toLowerCase().includes('technology') ||
    content.toLowerCase().includes('framework');
  const hasStructure =
    content.toLowerCase().includes('structure') ||
    content.toLowerCase().includes('directory') ||
    content.toLowerCase().includes('folder');

  if (!hasCommand) {
    warnings.push(
      'Consider adding a Commands section with relevant project commands'
    );
  }

  if (!hasTechStack) {
    warnings.push(
      'Consider adding a Tech Stack section to specify technologies used'
    );
  }

  if (!hasStructure) {
    warnings.push(
      'Consider adding a Project Structure section to explain organization'
    );
  }

  // Check for too generic content
  if (
    content.toLowerCase().includes('todo') ||
    content.toLowerCase().includes('fix me')
  ) {
    warnings.push(
      'Memory file contains placeholder content that should be updated'
    );
  }
}

/**
 * Extract import paths from memory content, excluding those inside code blocks
 */
export function extractImports(content: string): string[] {
  const imports: string[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockStart = '';
  let inIndentedCodeBlock = false;
  let lastWasCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check for code fence toggles (both ``` and ~~~)
    if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
      if (!inCodeBlock) {
        // Starting a new code block, but only if the last line wasn't also a code fence
        if (!lastWasCodeFence) {
          inCodeBlock = true;
          codeBlockStart = trimmedLine;
        }
      } else {
        // Check if this is the end of the current code block
        // The fence must match the opening fence type and be standalone
        const isMatchingFence =
          (codeBlockStart.startsWith('```') && trimmedLine === '```') ||
          (codeBlockStart.startsWith('~~~') && trimmedLine === '~~~');

        if (isMatchingFence) {
          inCodeBlock = false;
          codeBlockStart = '';
        } else {
          // Mismatched fence markers - treat as temporary "escape" from code block
          // This allows imports between mismatched fence markers to be extracted
          const isDifferentFence =
            (codeBlockStart.startsWith('```') && trimmedLine === '~~~') ||
            (codeBlockStart.startsWith('~~~') && trimmedLine === '```');

          if (isDifferentFence) {
            // Temporarily exit code block for content between mismatched fences
            inCodeBlock = !inCodeBlock;
          }
        }
      }
      lastWasCodeFence = true;
      continue;
    }

    lastWasCodeFence = false;

    // Skip if we're inside a code fence
    if (inCodeBlock) {
      continue;
    }

    // Check if this line is part of an indented code block
    // In Markdown, 4 spaces or 1 tab at the start indicates a code block
    if (
      (line.startsWith('    ') || line.startsWith('\t')) &&
      line.trim().length > 0
    ) {
      inIndentedCodeBlock = true;
      continue;
    } else if (
      inIndentedCodeBlock &&
      !line.startsWith('    ') &&
      !line.startsWith('\t') &&
      trimmedLine !== ''
    ) {
      // End of indented code block
      inIndentedCodeBlock = false;
    }

    // Skip if we're in an indented code block
    if (inIndentedCodeBlock) {
      continue;
    }

    // Check if the line contains an inline code span with @ import
    // We need to exclude imports that are inside backticks
    let processedLine = line;

    // Remove inline code spans to avoid matching imports inside them
    // First handle escaped backticks by temporarily replacing them
    processedLine = processedLine.replace(/\\`/g, '___ESCAPED_BACKTICK___');

    // Handle double backticks first (``code``) to avoid interference with single backticks
    processedLine = processedLine.replace(/``[^`]*``/g, '');

    // Then handle single backticks `code`
    processedLine = processedLine.replace(/`[^`]*`/g, '');

    // Restore escaped backticks as literal backticks (they should not be treated as code delimiters)
    processedLine = processedLine.replace(/___ESCAPED_BACKTICK___/g, '`');

    // Check for imports at the start of the line (after whitespace)
    // Also handle escaped backticks at the start of the line
    const match = processedLine.match(/^\s*(?:`)?@([^\s\n`"']+)/);
    if (match) {
      imports.push(match[1]);
    }
  }

  return imports;
}

/**
 * Resolve import path to absolute file path
 */
export function resolveImportPath(
  fromFile: string,
  importPath: string
): string {
  if (importPath.startsWith('~/')) {
    // User directory import
    return path.join(os.homedir(), importPath.substring(2));
  }

  if (path.isAbsolute(importPath)) {
    return importPath;
  }

  // Relative to the importing file's directory
  const fromDir = path.dirname(fromFile);
  return path.resolve(fromDir, importPath);
}

/**
 * Validate import chain depth doesn't exceed Claude Code's 5 hop limit
 * @returns Object containing validation result and actual depth
 */
export function validateImportChainDepth(
  filePath: string,
  visitedFiles = new Set<string>(),
  maxDepth = 5
): { valid: boolean; depth: number; error?: string } {
  // Normalize the file path
  const normalizedPath = path.resolve(filePath);

  // Check for circular dependency
  if (visitedFiles.has(normalizedPath)) {
    return {
      valid: false,
      depth: Infinity,
      error: `Circular import detected: ${normalizedPath}`,
    };
  }

  // Try to read the file
  let content: string;
  try {
    content = fs.readFileSync(normalizedPath, 'utf8');
  } catch {
    // If file doesn't exist or can't be read, this is an error
    return {
      valid: false,
      depth: 0,
      error: `Import file not found: ${normalizedPath}`,
    };
  }

  // Extract imports from the content
  const imports = extractImports(content);

  // If no imports, depth is 0
  if (imports.length === 0) {
    return { valid: true, depth: 0 };
  }

  // Add current file to visited set
  const newVisitedFiles = new Set(visitedFiles);
  newVisitedFiles.add(normalizedPath);

  // Calculate max depth from all imports
  let maxFoundDepth = 0;

  for (const importPath of imports) {
    const resolvedImportPath = resolveImportPath(normalizedPath, importPath);
    const result = validateImportChainDepth(
      resolvedImportPath,
      newVisitedFiles,
      maxDepth
    );

    if (!result.valid) {
      return result; // Propagate error
    }

    maxFoundDepth = Math.max(maxFoundDepth, result.depth + 1);
  }

  // Check if depth exceeds limit
  if (maxFoundDepth > maxDepth) {
    return {
      valid: false,
      depth: maxFoundDepth,
      error: `Import chain depth (${maxFoundDepth}) exceeds Claude Code's limit of ${maxDepth} hops`,
    };
  }

  return { valid: true, depth: maxFoundDepth };
}

/**
 * Validate memory file content with full import chain depth validation
 * This is an enhanced version that includes file system access for import validation
 */
export function validateMemoryContentWithDepth(
  content: string,
  filePath: string
): MemoryFileValidationResult & {
  importDepth?: number;
  importDepthError?: string;
} {
  // First do basic validation
  const basicValidation = validateMemoryContent(content);

  // If there are no imports, no need to check depth
  if (basicValidation.imports.length === 0) {
    return { ...basicValidation, importDepth: 0 };
  }

  // Validate import chain depth
  const depthResult = validateImportChainDepth(filePath);

  if (!depthResult.valid) {
    basicValidation.errors.push(
      depthResult.error || 'Import chain depth validation failed'
    );
    return {
      ...basicValidation,
      isValid: false,
      importDepth: depthResult.depth,
      importDepthError: depthResult.error,
    };
  }

  // Add warning if depth is getting close to limit
  if (depthResult.depth >= 4) {
    basicValidation.warnings.push(
      `Import chain depth is ${depthResult.depth}, approaching Claude Code's limit of 5 hops`
    );
  }

  return { ...basicValidation, importDepth: depthResult.depth };
}

/**
 * Validate import path format
 */
export function validateImportPath(importPath: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for empty path
  if (!importPath || importPath.trim().length === 0) {
    errors.push('Import path cannot be empty');
  }

  // Check for invalid characters
  if (importPath.includes('\n') || importPath.includes('\r')) {
    errors.push('Import path cannot contain line breaks');
  }

  // Check for spaces (should not have spaces)
  if (importPath.includes(' ')) {
    errors.push('Import path should not contain spaces');
  }

  // Validate path format
  if (importPath.startsWith('/') && !importPath.startsWith('~')) {
    // Absolute path (should be rare)
    console.warn('Absolute import path detected, ensure file exists');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
