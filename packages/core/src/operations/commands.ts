/**
 * Command file operations implementation using base CRUD operations
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import {
  BaseCrudOperations,
  BaseOperationOptions,
  BaseOperationResult,
  UnifiedValidationResult,
  ValidationError as _ValidationError,
  ValidationWarning as _ValidationWarning,
} from './base.js';
import {
  validateCommandPath,
  buildCommandPath,
  getCommandType,
} from '../commands/validation.js';
import {
  readMarkdownFile,
  writeMarkdownFile,
  updateMarkdownFile as _updateMarkdownFile,
  validateCommandContent,
} from '../utils/markdown-file.js';
import { ApplicationError, ErrorCode } from '../utils/error-handling.js';
import {
  SlashCommandContent,
  SlashCommandInfo,
  SlashCommandType,
} from '../types/commands.js';

// ========================================
// Commands-specific Interfaces
// ========================================

/**
 * Options for command file operations
 */
export interface CommandOperationOptions extends BaseOperationOptions {
  createNamespace?: boolean;
  namespace?: string;
  customBaseDir?: string;
  validateContent?: boolean;
}

/**
 * Result of command file operations
 */
export interface CommandOperationResult extends BaseOperationResult {
  commandInfo?: SlashCommandInfo;
  commandPath?: string;
}

// ========================================
// Implementation
// ========================================

/**
 * Command file operations implementation
 */
export class CommandFileOperations extends BaseCrudOperations<
  SlashCommandContent,
  CommandOperationOptions,
  CommandOperationResult
> {
  // ========================================
  // Abstract Method Implementations
  // ========================================

  protected async validatePath(
    projectRoot: string,
    targetPath: string,
    commandName?: string,
    namespace?: string,
    customBaseDir?: string
  ): Promise<UnifiedValidationResult> {
    const validation = await validateCommandPath(
      projectRoot,
      targetPath,
      commandName || this.extractCommandNameFromPath(targetPath),
      namespace,
      customBaseDir
    );

    return {
      valid: validation.valid,
      errors: validation.message
        ? [
            {
              code: 'INVALID_COMMAND_PATH',
              message: validation.message,
              path: targetPath,
            },
          ]
        : [],
      warnings: [],
      metadata: validation.details,
    };
  }

  protected validateContent(
    content: SlashCommandContent
  ): UnifiedValidationResult {
    const validation = validateCommandContent(content);

    return {
      valid: validation.valid,
      errors:
        validation.errors?.map(error => ({
          code: error.type || 'INVALID_COMMAND_CONTENT',
          message: error.message,
          path: `line ${error.line}, col ${error.column}`,
          suggestion: error.suggestion,
        })) || [],
      warnings:
        validation.warnings?.map(warning => ({
          code: 'COMMAND_CONTENT_WARNING',
          message: warning,
        })) || [],
    };
  }

  protected async readContent(filePath: string): Promise<SlashCommandContent> {
    try {
      return await readMarkdownFile(filePath);
    } catch (error: any) {
      if (error.code === ErrorCode.FILE_NOT_FOUND) {
        throw new ApplicationError({
          code: ErrorCode.FILE_NOT_FOUND,
          message: `Command file not found: ${filePath}`,
          context: { filePath },
        });
      }
      throw error;
    }
  }

  protected async writeContent(
    filePath: string,
    content: SlashCommandContent,
    options: CommandOperationOptions
  ): Promise<void> {
    // Create namespace directory if needed
    if (options.namespace && options.createNamespace !== false) {
      const namespaceDir = path.dirname(filePath);
      await fs.mkdir(namespaceDir, { recursive: true });
    }

    await writeMarkdownFile(filePath, content, {
      createBackup: options.backup,
    });
  }

  protected mergeContent(
    existing: SlashCommandContent,
    updates: Partial<SlashCommandContent>,
    _options: CommandOperationOptions
  ): SlashCommandContent {
    // Merge frontmatter
    const mergedFrontmatter = {
      ...existing.frontmatter,
      ...updates.frontmatter,
    };

    // Merge content (updates take precedence)
    const mergedContent = updates.content ?? existing.content;

    // Update rawContent to reflect the merged result
    const mergedRawContent = updates.rawContent ?? existing.rawContent;

    return {
      frontmatter:
        Object.keys(mergedFrontmatter).length > 0
          ? mergedFrontmatter
          : undefined,
      content: mergedContent,
      rawContent: mergedRawContent,
    };
  }

  protected createSuccessResponse(
    operation: string,
    filePath: string,
    content?: SlashCommandContent
  ): CommandOperationResult {
    const operationText = this.getOperationText(operation);
    return {
      success: true,
      message: `Command file ${operationText} successfully`,
      filePath,
      commandPath: filePath,
      commandInfo: content
        ? this.buildCommandInfo(filePath, content)
        : undefined,
    };
  }

  protected createErrorResponse(
    message: string,
    error: ApplicationError
  ): CommandOperationResult {
    return {
      success: false,
      message,
      error,
    };
  }

  // ========================================
  // Extended CRUD Operations
  // ========================================

  /**
   * Create a command with specific command parameters
   */
  async createCommand(
    projectRoot: string,
    commandName: string,
    content: string | SlashCommandContent,
    namespace?: string,
    options: CommandOperationOptions = {},
    customBaseDir?: string
  ): Promise<CommandOperationResult> {
    // Build the target path using command-specific logic
    const targetPath = buildCommandPath(
      projectRoot,
      commandName,
      namespace,
      SlashCommandType.PROJECT,
      customBaseDir || options.customBaseDir
    );

    // Convert string content to SlashCommandContent if needed
    const commandContent: SlashCommandContent =
      typeof content === 'string' ? { content, rawContent: content } : content;

    // Set up options with command-specific settings
    const commandOptions: CommandOperationOptions = {
      ...options,
      namespace,
      customBaseDir: customBaseDir || options.customBaseDir,
      createNamespace: options.createNamespace !== false,
    };

    // Validate using extended validation with command-specific parameters
    const validation = await this.validatePath(
      projectRoot,
      targetPath,
      commandName,
      namespace,
      customBaseDir || options.customBaseDir
    );

    if (!validation.valid) {
      throw this.createPathValidationError(validation);
    }

    return this.create(projectRoot, targetPath, commandContent, commandOptions);
  }

  /**
   * Update a command with specific command parameters
   */
  async updateCommand(
    projectRoot: string,
    commandName: string,
    content: string | Partial<SlashCommandContent>,
    namespace?: string,
    options: CommandOperationOptions = {},
    customBaseDir?: string
  ): Promise<CommandOperationResult> {
    // Build the target path using command-specific logic
    const targetPath = buildCommandPath(
      projectRoot,
      commandName,
      namespace,
      SlashCommandType.PROJECT,
      customBaseDir || options.customBaseDir
    );

    // Convert string content to partial SlashCommandContent if needed
    const contentUpdates: Partial<SlashCommandContent> =
      typeof content === 'string' ? { content } : content;

    // Set up options with command-specific settings
    const commandOptions: CommandOperationOptions = {
      ...options,
      namespace,
      customBaseDir: customBaseDir || options.customBaseDir,
    };

    return this.update(projectRoot, targetPath, contentUpdates, commandOptions);
  }

  /**
   * Move a command with namespace cleanup
   */
  async moveCommand(
    projectRoot: string,
    sourceCommand: string,
    targetCommand: string,
    sourceNamespace?: string,
    targetNamespace?: string,
    options: CommandOperationOptions = {},
    customSourceDir?: string,
    customTargetDir?: string
  ): Promise<CommandOperationResult> {
    // Build source and target paths
    const sourcePath = buildCommandPath(
      projectRoot,
      sourceCommand,
      sourceNamespace,
      SlashCommandType.PROJECT,
      customSourceDir || options.customBaseDir
    );

    const targetPath = buildCommandPath(
      projectRoot,
      targetCommand,
      targetNamespace,
      SlashCommandType.PROJECT,
      customTargetDir || options.customBaseDir
    );

    // Set up options
    const commandOptions: CommandOperationOptions = {
      ...options,
      namespace: targetNamespace,
      createNamespace: options.createNamespace !== false,
    };

    const result = await this.move(
      projectRoot,
      sourcePath,
      targetPath,
      commandOptions
    );

    // Add warning if namespace changed
    if (sourceNamespace !== targetNamespace) {
      result.warnings = result.warnings || [];
      result.warnings.push(
        'Command moved between namespaces - invocation path has changed'
      );
    }

    return result;
  }

  /**
   * Delete a command with namespace cleanup
   */
  async deleteCommand(
    projectRoot: string,
    commandName: string,
    namespace?: string,
    options: CommandOperationOptions = {},
    customBaseDir?: string
  ): Promise<CommandOperationResult> {
    // Build the target path
    const targetPath = buildCommandPath(
      projectRoot,
      commandName,
      namespace,
      SlashCommandType.PROJECT,
      customBaseDir || options.customBaseDir
    );

    const result = await this.delete(projectRoot, targetPath, options);

    return result;
  }

  // ========================================
  // Hook Method Overrides
  // ========================================

  protected shouldValidateContent(options: CommandOperationOptions): boolean {
    return options.validateContent ?? true;
  }

  protected async performPostDeleteTasks(
    filePath: string,
    options: CommandOperationOptions
  ): Promise<void> {
    // Clean up empty namespace directories
    if (options.namespace) {
      await this.cleanupEmptyNamespaceDirectory(path.dirname(filePath));
    }
  }

  protected async performPostMoveTasks(
    sourcePath: string,
    _targetPath: string,
    _options: CommandOperationOptions
  ): Promise<void> {
    // Clean up empty source namespace directory
    const sourceNamespace = this.extractNamespaceFromPath(sourcePath);
    if (sourceNamespace) {
      await this.cleanupEmptyNamespaceDirectory(path.dirname(sourcePath));
    }
  }

  protected async performPreDeleteChecks(
    filePath: string,
    _options: CommandOperationOptions
  ): Promise<string[]> {
    const warnings: string[] = [];

    try {
      const content = await this.readContent(filePath);

      // Warn about commands with descriptions
      if (content.frontmatter?.description) {
        warnings.push(
          'This command has a description and may be frequently used'
        );
      }
    } catch (_error) {
      // If we can't read the file, that's okay for pre-delete checks
    }

    return warnings;
  }

  // ========================================
  // Utility Methods
  // ========================================

  private getOperationText(operation: string): string {
    switch (operation) {
      case 'create':
        return 'created';
      case 'update':
        return 'updated';
      case 'move':
        return 'moved';
      case 'delete':
        return 'deleted';
      case 'dry-run':
        return 'would be processed in dry run';
      default:
        return 'processed';
    }
  }

  private extractCommandNameFromPath(filePath: string): string {
    const filename = path.basename(filePath, '.md');
    return filename;
  }

  private extractNamespaceFromPath(filePath: string): string | undefined {
    const dir = path.dirname(filePath);
    const parts = dir.split(path.sep);
    const commandsIndex = parts.lastIndexOf('commands');

    if (commandsIndex >= 0 && commandsIndex < parts.length - 1) {
      return parts.slice(commandsIndex + 1).join('/');
    }

    return undefined;
  }

  private buildCommandInfo(
    filePath: string,
    content: SlashCommandContent
  ): SlashCommandInfo {
    const commandName = this.extractCommandNameFromPath(filePath);
    const namespace = this.extractNamespaceFromPath(filePath);
    const type = getCommandType(filePath);
    const fullName = namespace ? `${namespace}:${commandName}` : commandName;
    const invocation = `/${fullName}`;

    return {
      name: commandName,
      namespace,
      fullName,
      path: filePath,
      type,
      exists: true,
      content,
      invocation,
      isActive: true,
    };
  }

  /**
   * Clean up empty namespace directories
   */
  private async cleanupEmptyNamespaceDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath);
      if (entries.length === 0) {
        await fs.rmdir(dirPath);
        this.logger.debug(`Cleaned up empty namespace directory: ${dirPath}`);

        // Recursively clean up parent directories if they're also empty
        const parentDir = path.dirname(dirPath);
        const parentName = path.basename(parentDir);
        if (parentName !== 'commands') {
          // Don't delete the commands directory itself
          await this.cleanupEmptyNamespaceDirectory(parentDir);
        }
      }
    } catch (error: any) {
      // Ignore errors during cleanup
      this.logger.debug(
        `Failed to cleanup directory ${dirPath}: ${error.message}`
      );
    }
  }
}

// ========================================
// Static Factory Functions (Backward Compatibility)
// ========================================

const commandOperations = new CommandFileOperations();

/**
 * Create a new slash command file
 */
export async function createSlashCommand(
  projectRoot: string,
  commandName: string,
  content: string | SlashCommandContent,
  namespace?: string,
  options: CommandOperationOptions = {},
  customBaseDir?: string
): Promise<CommandOperationResult> {
  return commandOperations.createCommand(
    projectRoot,
    commandName,
    content,
    namespace,
    options,
    customBaseDir
  );
}

/**
 * Update an existing slash command file
 */
export async function updateSlashCommand(
  projectRoot: string,
  commandName: string,
  content: string | Partial<SlashCommandContent>,
  namespace?: string,
  options: CommandOperationOptions = {},
  customBaseDir?: string
): Promise<CommandOperationResult> {
  return commandOperations.updateCommand(
    projectRoot,
    commandName,
    content,
    namespace,
    options,
    customBaseDir
  );
}

/**
 * Move a slash command to a new location or namespace
 */
export async function moveSlashCommand(
  projectRoot: string,
  sourceCommand: string,
  targetCommand: string,
  sourceNamespace?: string,
  targetNamespace?: string,
  options: CommandOperationOptions = {},
  customSourceDir?: string,
  customTargetDir?: string
): Promise<CommandOperationResult> {
  return commandOperations.moveCommand(
    projectRoot,
    sourceCommand,
    targetCommand,
    sourceNamespace,
    targetNamespace,
    options,
    customSourceDir,
    customTargetDir
  );
}

/**
 * Delete a slash command file
 */
export async function deleteSlashCommand(
  projectRoot: string,
  commandName: string,
  namespace?: string,
  options: CommandOperationOptions = {},
  customBaseDir?: string
): Promise<CommandOperationResult> {
  return commandOperations.deleteCommand(
    projectRoot,
    commandName,
    namespace,
    options,
    customBaseDir
  );
}
