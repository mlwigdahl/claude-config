/**
 * Markdown file utilities with YAML frontmatter parsing for slash commands
 */

import * as yaml from 'js-yaml';
import {
  ConsolidatedFileSystem,
  FileOperationOptions,
} from './consolidated-filesystem.js';
import {
  ApplicationError,
  FileSystemError,
  ErrorCode,
} from './error-handling.js';
import {
  SlashCommandContent,
  CommandFrontmatter,
  SpecialSyntaxValidationResult,
  SpecialSyntaxError,
  SpecialSyntaxType,
} from '../types/commands.js';
import { getLogger } from './logger.js';

const logger = getLogger('markdown-file');

/**
 * Options for Markdown file operations
 */
export interface MarkdownFileOptions {
  createBackup?: boolean;
  encoding?: 'utf8';
  preserveLineEndings?: boolean;
}

/**
 * YAML frontmatter delimiter
 */
const FRONTMATTER_DELIMITER = '---';

/**
 * Reads and parses a Markdown file with optional YAML frontmatter
 */
export async function readMarkdownFile(
  filePath: string
): Promise<SlashCommandContent> {
  logger.debug(`Reading Markdown file: ${filePath}`);

  try {
    const rawContent = await ConsolidatedFileSystem.readFile(filePath);

    // Handle empty files
    if (!rawContent.trim()) {
      logger.debug('File is empty');
      return {
        content: '',
        rawContent: '',
      };
    }

    // Parse frontmatter and content
    const parsed = parseFrontmatter(rawContent);

    logger.debug('Markdown file parsed successfully');
    return parsed;
  } catch (error) {
    // If it's already our standardized error, re-throw it
    if (error instanceof ApplicationError) {
      throw error;
    }

    // Transform filesystem errors to our standardized format
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
      throw new FileSystemError(
        `Command file not found: ${filePath}`,
        ErrorCode.FILE_NOT_FOUND,
        filePath
      );
    }

    if (
      errorMessage.includes('EACCES') ||
      errorMessage.includes('permission')
    ) {
      throw new FileSystemError(
        `Permission denied reading file: ${filePath}`,
        ErrorCode.PERMISSION_DENIED,
        filePath
      );
    }

    throw new FileSystemError(
      `Failed to read Markdown file: ${errorMessage}`,
      ErrorCode.OPERATION_FAILED,
      filePath
    );
  }
}

/**
 * Writes a Markdown file with optional YAML frontmatter
 */
export async function writeMarkdownFile(
  filePath: string,
  content: SlashCommandContent,
  options: MarkdownFileOptions = {}
): Promise<void> {
  const { createBackup = false, encoding = 'utf-8' } = options;

  logger.debug(`Writing Markdown file: ${filePath}`);

  try {
    // Serialize content with frontmatter
    const serialized = serializeFrontmatter(content);

    // Use consolidated filesystem with all options
    const fsOptions: FileOperationOptions = {
      createBackup,
      createDirs: true,
      overwrite: true,
      encoding,
    };

    await ConsolidatedFileSystem.writeFile(filePath, serialized, fsOptions);

    logger.debug('Markdown file written successfully');
  } catch (error) {
    // If it's already our standardized error, re-throw it
    if (error instanceof ApplicationError) {
      throw error;
    }

    // Transform to our standardized error format
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('EACCES') ||
      errorMessage.includes('permission')
    ) {
      throw new FileSystemError(
        `Permission denied writing file: ${filePath}`,
        ErrorCode.PERMISSION_DENIED,
        filePath
      );
    }

    throw new FileSystemError(
      `Failed to write Markdown file: ${errorMessage}`,
      ErrorCode.OPERATION_FAILED,
      filePath
    );
  }
}

/**
 * Updates a Markdown file by merging new content
 */
export async function updateMarkdownFile(
  filePath: string,
  updates: Partial<SlashCommandContent>,
  options: MarkdownFileOptions = {}
): Promise<SlashCommandContent> {
  logger.debug(`Updating Markdown file: ${filePath}`);

  // Read existing content or start with empty
  let existing: SlashCommandContent;
  try {
    existing = await readMarkdownFile(filePath);
  } catch (error) {
    const errorObj = error as any;
    if (errorObj.code === ErrorCode.FILE_NOT_FOUND) {
      logger.debug('File does not exist, starting with empty content');
      existing = { content: '', rawContent: '' };
    } else {
      throw error;
    }
  }

  // Merge updates
  const merged: SlashCommandContent = {
    frontmatter: updates.frontmatter || existing.frontmatter,
    content: updates.content !== undefined ? updates.content : existing.content,
    rawContent: '', // Will be set by serialization
  };

  // Write back
  await writeMarkdownFile(filePath, merged, options);

  // Return the merged content with updated rawContent
  return {
    ...merged,
    rawContent: serializeFrontmatter(merged),
  };
}

/**
 * Parses YAML frontmatter from Markdown content
 */
export function parseFrontmatter(content: string): SlashCommandContent {
  const lines = content.split('\n');

  // Check if content starts with frontmatter delimiter
  if (lines.length === 0 || lines[0].trim() !== FRONTMATTER_DELIMITER) {
    // No frontmatter, return as-is
    return {
      content: content,
      rawContent: content,
    };
  }

  // Find closing delimiter
  let frontmatterEndIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FRONTMATTER_DELIMITER) {
      frontmatterEndIndex = i;
      break;
    }
  }

  if (frontmatterEndIndex === -1) {
    // No closing delimiter found, treat as regular content
    return {
      content: content,
      rawContent: content,
    };
  }

  // Extract frontmatter and content
  const frontmatterLines = lines.slice(1, frontmatterEndIndex);
  const contentLines = lines.slice(frontmatterEndIndex + 1);

  const frontmatterText = frontmatterLines.join('\n');
  const markdownContent = contentLines.join('\n');

  // Parse YAML frontmatter
  let frontmatter: CommandFrontmatter | undefined;
  if (frontmatterText.trim()) {
    try {
      const parsed = yaml.load(frontmatterText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        frontmatter = parsed as CommandFrontmatter;
      }
    } catch (error) {
      throw new FileSystemError(
        `Failed to parse YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.MARKDOWN_PARSE_ERROR
      );
    }
  }

  return {
    frontmatter,
    content: markdownContent,
    rawContent: content,
  };
}

/**
 * Serializes content with YAML frontmatter
 */
export function serializeFrontmatter(content: SlashCommandContent): string {
  if (!content.frontmatter) {
    return content.content;
  }

  try {
    const yamlText = yaml
      .dump(content.frontmatter, {
        indent: 2,
        lineWidth: 80,
        noRefs: true,
      })
      .trim();

    return `${FRONTMATTER_DELIMITER}\n${yamlText}\n${FRONTMATTER_DELIMITER}\n${content.content}`;
  } catch (error) {
    throw new FileSystemError(
      `Failed to serialize YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
      ErrorCode.MARKDOWN_PARSE_ERROR
    );
  }
}

/**
 * Validates command frontmatter structure
 */
export function validateFrontmatter(frontmatter: any): boolean {
  if (
    !frontmatter ||
    typeof frontmatter !== 'object' ||
    Array.isArray(frontmatter)
  ) {
    return false;
  }

  // Check optional fields
  if (
    'description' in frontmatter &&
    typeof frontmatter.description !== 'string'
  ) {
    return false;
  }

  if ('allowed-tools' in frontmatter) {
    if (!Array.isArray(frontmatter['allowed-tools'])) {
      return false;
    }
    // Check that all tools are strings
    if (
      !frontmatter['allowed-tools'].every(
        (tool: any) => typeof tool === 'string'
      )
    ) {
      return false;
    }
  }

  // Check for unknown fields
  const validFields = ['description', 'allowed-tools'];
  const unknownFields = Object.keys(frontmatter).filter(
    key => !validFields.includes(key)
  );
  if (unknownFields.length > 0) {
    logger.warn(`Unknown frontmatter fields: ${unknownFields.join(', ')}`);
  }

  return true;
}

/**
 * Validates special syntax in command content
 */
export function validateSpecialSyntax(
  content: string
): SpecialSyntaxValidationResult {
  const errors: SpecialSyntaxError[] = [];
  const warnings: string[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for $ARGUMENTS placeholder
    if (line.includes('$ARGUMENTS')) {
      // This is valid syntax, just log for debugging
      logger.debug(`Found $ARGUMENTS placeholder at line ${lineNumber}`);
    }

    // Check for bash command syntax (! prefix)
    const bashMatches = line.matchAll(/^!\s*(.*)$/gm);
    for (const match of bashMatches) {
      const command = match[1].trim();
      if (!command) {
        errors.push({
          type: SpecialSyntaxType.BASH_COMMAND,
          line: lineNumber,
          column: match.index || 0,
          message: 'Empty bash command after ! prefix',
          suggestion: 'Add a command after the ! prefix, e.g., "!echo Hello"',
        });
      }
    }

    // Check for file reference syntax (@ prefix)
    const fileMatches = line.matchAll(/@([^\s]*)/g);
    for (const match of fileMatches) {
      const filePath = match[1];
      if (!filePath || filePath.length === 0) {
        errors.push({
          type: SpecialSyntaxType.FILE_REFERENCE,
          line: lineNumber,
          column: match.index || 0,
          message: 'Empty file path after @ prefix',
          suggestion:
            'Add a file path after the @ prefix, e.g., "@path/to/file.txt"',
        });
      } else if (filePath.includes('..') || filePath.startsWith('/')) {
        warnings.push(
          `Line ${lineNumber}: Potentially unsafe file path "${filePath}"`
        );
      }
    }

    // Check for thinking keywords
    const thinkingKeywords = ['Think', 'thinking', 'THINK'];
    for (const keyword of thinkingKeywords) {
      if (line.includes(keyword)) {
        logger.debug(
          `Found thinking keyword "${keyword}" at line ${lineNumber}`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validates complete command content including frontmatter and special syntax
 */
export function validateCommandContent(
  content: SlashCommandContent
): SpecialSyntaxValidationResult {
  const errors: SpecialSyntaxError[] = [];
  const warnings: string[] = [];

  // Validate frontmatter if present
  if (content.frontmatter) {
    if (!validateFrontmatter(content.frontmatter)) {
      errors.push({
        type: SpecialSyntaxType.ARGUMENTS, // Using this as a generic type
        line: 1,
        column: 0,
        message: 'Invalid frontmatter structure',
        suggestion:
          'Check that frontmatter fields are valid (description: string, allowed-tools: string[])',
      });
    }
  }

  // Validate special syntax in content
  const syntaxValidation = validateSpecialSyntax(content.content);
  if (syntaxValidation.errors) {
    errors.push(...syntaxValidation.errors);
  }
  if (syntaxValidation.warnings) {
    warnings.push(...syntaxValidation.warnings);
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// Utility functions have been consolidated into ConsolidatedFileSystem and ErrorHandler
// All functionality is now available through the centralized modules
