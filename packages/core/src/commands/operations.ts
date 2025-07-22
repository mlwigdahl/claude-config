/**
 * Core CRUD operations for slash commands
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import {
  SlashCommandContent,
  SlashCommandOperationResult,
  SlashCommandOperationOptions,
  SlashCommandInfo,
} from '../types/commands.js';
import { ErrorCode, ApplicationError } from '../utils/error-handling.js';
import {
  readMarkdownFile,
  writeMarkdownFile,
  updateMarkdownFile,
  validateCommandContent,
} from '../utils/markdown-file.js';
import { getLogger } from '../utils/logger.js';
import {
  validateCommandPath,
  getCommandType,
  buildCommandPath,
} from './validation.js';

const logger = getLogger('command-operations');

/**
 * Creates a new slash command file
 */
export async function createSlashCommand(
  projectRoot: string,
  commandName: string,
  content: string | SlashCommandContent,
  namespace?: string,
  options: SlashCommandOperationOptions = {}
): Promise<SlashCommandOperationResult> {
  logger.info(
    `Creating slash command: ${namespace ? `${namespace}:` : ''}${commandName}`
  );

  try {
    // Build the target path
    const targetPath = buildCommandPath(projectRoot, commandName, namespace);

    // Validate the target path
    const pathValidation = await validateCommandPath(
      projectRoot,
      targetPath,
      commandName,
      namespace
    );
    if (!pathValidation.valid) {
      return {
        success: false,
        message: pathValidation.message || 'Invalid command path',
        error: new ApplicationError({
          code: ErrorCode.INVALID_PATH,
          message: pathValidation.message || 'Invalid command path',
          context: pathValidation.details,
        }),
      };
    }

    // Prepare content
    const commandContent: SlashCommandContent =
      typeof content === 'string' ? { content, rawContent: content } : content;

    // Validate command content
    const contentValidation = validateCommandContent(commandContent);
    if (!contentValidation.valid) {
      return {
        success: false,
        message: 'Invalid command content',
        error: new ApplicationError({
          code: ErrorCode.INVALID_COMMAND_SYNTAX,
          message: 'Command content validation failed',
          context: contentValidation.errors || {},
        }),
      };
    }

    // Check if file already exists
    try {
      await fs.access(targetPath);
      if (!options.force) {
        return {
          success: false,
          message: `Command file already exists: ${targetPath}`,
          error: new ApplicationError({
            code: ErrorCode.FILE_ALREADY_EXISTS,
            message: `Command file already exists: ${targetPath}`,
            context: { path: targetPath },
          }),
        };
      }
    } catch {
      // File doesn't exist, which is what we want
    }

    // Create namespace directory if needed
    if (namespace && options.createNamespace !== false) {
      const namespaceDir = path.dirname(targetPath);
      await fs.mkdir(namespaceDir, { recursive: true });
    }

    // Perform dry run if requested
    if (options.dryRun) {
      return {
        success: true,
        message: `[DRY RUN] Would create command: ${namespace ? `${namespace}:` : ''}${commandName}`,
        commandPath: targetPath,
        commandInfo: await buildCommandInfo(
          targetPath,
          commandName,
          namespace,
          commandContent
        ),
      };
    }

    // Write the command file
    await writeMarkdownFile(targetPath, commandContent, {
      createBackup: options.backup,
    });

    const commandInfo = await buildCommandInfo(
      targetPath,
      commandName,
      namespace,
      commandContent
    );

    logger.info(
      `Successfully created slash command: ${namespace ? `${namespace}:` : ''}${commandName}`
    );
    return {
      success: true,
      message: `Created command: ${namespace ? `${namespace}:` : ''}${commandName}`,
      commandPath: targetPath,
      commandInfo,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to create slash command: ${errorMessage}`);
    return {
      success: false,
      message: `Failed to create command: ${errorMessage}`,
      error: new ApplicationError({
        code: ErrorCode.OPERATION_FAILED,
        message: errorMessage,
        context: {},
      }),
    };
  }
}

/**
 * Updates an existing slash command file
 */
export async function updateSlashCommand(
  projectRoot: string,
  commandName: string,
  content: string | Partial<SlashCommandContent>,
  namespace?: string,
  options: SlashCommandOperationOptions = {}
): Promise<SlashCommandOperationResult> {
  logger.info(
    `Updating slash command: ${namespace ? `${namespace}:` : ''}${commandName}`
  );

  try {
    // Build the target path
    const targetPath = buildCommandPath(projectRoot, commandName, namespace);

    // Validate the target path
    const pathValidation = await validateCommandPath(
      projectRoot,
      targetPath,
      commandName,
      namespace
    );
    if (!pathValidation.valid) {
      return {
        success: false,
        message: pathValidation.message || 'Invalid command path',
        error: new ApplicationError({
          code: ErrorCode.INVALID_PATH,
          message: pathValidation.message || 'Invalid command path',
          context: pathValidation.details,
        }),
      };
    }

    // Check if file exists
    try {
      await fs.access(targetPath);
    } catch {
      return {
        success: false,
        message: `Command file not found: ${targetPath}`,
        error: new ApplicationError({
          code: ErrorCode.FILE_NOT_FOUND,
          message: `Command file not found: ${targetPath}`,
          context: { path: targetPath },
        }),
      };
    }

    // Prepare content updates
    const contentUpdates: Partial<SlashCommandContent> =
      typeof content === 'string' ? { content } : content;

    // Perform dry run if requested
    if (options.dryRun) {
      return {
        success: true,
        message: `[DRY RUN] Would update command: ${namespace ? `${namespace}:` : ''}${commandName}`,
        commandPath: targetPath,
      };
    }

    // Update the command file
    const updatedContent = await updateMarkdownFile(
      targetPath,
      contentUpdates,
      {
        createBackup: options.backup,
      }
    );

    // Validate updated content
    const contentValidation = validateCommandContent(updatedContent);
    if (!contentValidation.valid) {
      return {
        success: false,
        message: 'Invalid command content after update',
        error: new ApplicationError({
          code: ErrorCode.INVALID_COMMAND_SYNTAX,
          message: 'Updated command content validation failed',
          context: contentValidation.errors || {},
        }),
        warnings: contentValidation.warnings,
      };
    }

    const commandInfo = await buildCommandInfo(
      targetPath,
      commandName,
      namespace,
      updatedContent
    );

    logger.info(
      `Successfully updated slash command: ${namespace ? `${namespace}:` : ''}${commandName}`
    );
    return {
      success: true,
      message: `Updated command: ${namespace ? `${namespace}:` : ''}${commandName}`,
      commandPath: targetPath,
      commandInfo,
      warnings: contentValidation.warnings,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to update slash command: ${errorMessage}`);
    return {
      success: false,
      message: `Failed to update command: ${errorMessage}`,
      error: new ApplicationError({
        code: ErrorCode.OPERATION_FAILED,
        message: errorMessage,
        context: {},
      }),
    };
  }
}

/**
 * Moves a slash command to a new location or namespace
 */
export async function moveSlashCommand(
  projectRoot: string,
  sourceCommand: string,
  targetCommand: string,
  sourceNamespace?: string,
  targetNamespace?: string,
  options: SlashCommandOperationOptions = {}
): Promise<SlashCommandOperationResult> {
  logger.info(
    `Moving slash command from ${sourceNamespace ? `${sourceNamespace}:` : ''}${sourceCommand} to ${targetNamespace ? `${targetNamespace}:` : ''}${targetCommand}`
  );

  try {
    // Build source and target paths
    const sourcePath = buildCommandPath(
      projectRoot,
      sourceCommand,
      sourceNamespace
    );
    const targetPath = buildCommandPath(
      projectRoot,
      targetCommand,
      targetNamespace
    );

    // Validate both paths
    const sourceValidation = await validateCommandPath(
      projectRoot,
      sourcePath,
      sourceCommand,
      sourceNamespace
    );
    if (!sourceValidation.valid) {
      return {
        success: false,
        message: `Invalid source path: ${sourceValidation.message}`,
        error: new ApplicationError({
          code: ErrorCode.INVALID_PATH,
          message: sourceValidation.message || 'Invalid source path',
          context: sourceValidation.details,
        }),
      };
    }

    const targetValidation = await validateCommandPath(
      projectRoot,
      targetPath,
      targetCommand,
      targetNamespace
    );
    if (!targetValidation.valid) {
      return {
        success: false,
        message: `Invalid target path: ${targetValidation.message}`,
        error: new ApplicationError({
          code: ErrorCode.INVALID_PATH,
          message: targetValidation.message || 'Invalid target path',
          context: targetValidation.details,
        }),
      };
    }

    // Check if source exists
    try {
      await fs.access(sourcePath);
    } catch {
      return {
        success: false,
        message: `Source command file not found: ${sourcePath}`,
        error: new ApplicationError({
          code: ErrorCode.FILE_NOT_FOUND,
          message: `Source command file not found: ${sourcePath}`,
          context: { path: sourcePath },
        }),
      };
    }

    // Check if target already exists
    try {
      await fs.access(targetPath);
      if (!options.force) {
        return {
          success: false,
          message: `Target command file already exists: ${targetPath}`,
          error: new ApplicationError({
            code: ErrorCode.FILE_ALREADY_EXISTS,
            message: `Target command file already exists: ${targetPath}`,
            context: { path: targetPath },
          }),
        };
      }
    } catch {
      // Target doesn't exist, which is fine
    }

    // Read the source command
    const commandContent = await readMarkdownFile(sourcePath);

    // Perform dry run if requested
    if (options.dryRun) {
      return {
        success: true,
        message: `[DRY RUN] Would move command from ${sourceNamespace ? `${sourceNamespace}:` : ''}${sourceCommand} to ${targetNamespace ? `${targetNamespace}:` : ''}${targetCommand}`,
        commandPath: targetPath,
      };
    }

    // Create backup if requested
    if (options.backup) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${sourcePath}.backup.${timestamp}`;
      await fs.copyFile(sourcePath, backupPath);
      logger.debug(`Created backup: ${backupPath}`);
    }

    // Create target namespace directory if needed
    if (targetNamespace && options.createNamespace !== false) {
      const targetDir = path.dirname(targetPath);
      await fs.mkdir(targetDir, { recursive: true });
    }

    // Move the file
    await fs.rename(sourcePath, targetPath);

    // Clean up source namespace directory if empty
    if (sourceNamespace) {
      await cleanupEmptyNamespaceDirectory(path.dirname(sourcePath));
    }

    const commandInfo = await buildCommandInfo(
      targetPath,
      targetCommand,
      targetNamespace,
      commandContent
    );

    logger.info(
      `Successfully moved slash command from ${sourceNamespace ? `${sourceNamespace}:` : ''}${sourceCommand} to ${targetNamespace ? `${targetNamespace}:` : ''}${targetCommand}`
    );
    return {
      success: true,
      message: `Moved command from ${sourceNamespace ? `${sourceNamespace}:` : ''}${sourceCommand} to ${targetNamespace ? `${targetNamespace}:` : ''}${targetCommand}`,
      commandPath: targetPath,
      commandInfo,
      warnings:
        sourceNamespace !== targetNamespace
          ? ['Command moved between namespaces - invocation path has changed']
          : undefined,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to move slash command: ${errorMessage}`);
    return {
      success: false,
      message: `Failed to move command: ${errorMessage}`,
      error: new ApplicationError({
        code: ErrorCode.OPERATION_FAILED,
        message: errorMessage,
        context: {},
      }),
    };
  }
}

/**
 * Deletes a slash command file
 */
export async function deleteSlashCommand(
  projectRoot: string,
  commandName: string,
  namespace?: string,
  options: SlashCommandOperationOptions = {}
): Promise<SlashCommandOperationResult> {
  logger.info(
    `Deleting slash command: ${namespace ? `${namespace}:` : ''}${commandName}`
  );

  try {
    // Build the target path
    const targetPath = buildCommandPath(projectRoot, commandName, namespace);

    // Validate the target path
    const pathValidation = await validateCommandPath(
      projectRoot,
      targetPath,
      commandName,
      namespace
    );
    if (!pathValidation.valid) {
      return {
        success: false,
        message: pathValidation.message || 'Invalid command path',
        error: new ApplicationError({
          code: ErrorCode.INVALID_PATH,
          message: pathValidation.message || 'Invalid command path',
          context: pathValidation.details,
        }),
      };
    }

    // Check if file exists and read it
    let commandContent: SlashCommandContent | undefined;
    try {
      commandContent = await readMarkdownFile(targetPath);
    } catch (error: any) {
      if (error.code === ErrorCode.FILE_NOT_FOUND) {
        return {
          success: false,
          message: `Command file not found: ${targetPath}`,
          error: new ApplicationError({
            code: ErrorCode.FILE_NOT_FOUND,
            message: `Command file not found: ${targetPath}`,
            context: { path: targetPath },
          }),
        };
      }
      throw error;
    }

    const warnings: string[] = [];

    // Add warnings for potentially important commands
    if (commandContent.frontmatter?.description) {
      warnings.push(
        'This command has a description and may be frequently used'
      );
    }

    // Perform dry run if requested
    if (options.dryRun) {
      return {
        success: true,
        message: `[DRY RUN] Would delete command: ${namespace ? `${namespace}:` : ''}${commandName}`,
        commandPath: targetPath,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // Create backup if requested
    if (options.backup) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${targetPath}.backup.${timestamp}`;
      await fs.copyFile(targetPath, backupPath);
      logger.debug(`Created backup: ${backupPath}`);
      warnings.push(`Backup created: ${backupPath}`);
    }

    // Delete the file
    await fs.unlink(targetPath);

    // Clean up empty namespace directory
    if (namespace) {
      await cleanupEmptyNamespaceDirectory(path.dirname(targetPath));
    }

    logger.info(
      `Successfully deleted slash command: ${namespace ? `${namespace}:` : ''}${commandName}`
    );
    return {
      success: true,
      message: `Deleted command: ${namespace ? `${namespace}:` : ''}${commandName}`,
      commandPath: targetPath,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error: any) {
    logger.error(`Failed to delete slash command: ${error.message}`);
    return {
      success: false,
      message: `Failed to delete command: ${error.message}`,
      error: new ApplicationError({
        code: error.code || ErrorCode.OPERATION_FAILED,
        message: error.message,
        context: error.details,
      }),
    };
  }
}

/**
 * Builds command info from path and content
 */
async function buildCommandInfo(
  filePath: string,
  commandName: string,
  namespace?: string,
  content?: SlashCommandContent
): Promise<SlashCommandInfo> {
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
    isActive: true, // Will be updated during discovery
  };
}

/**
 * Cleans up empty namespace directories
 */
async function cleanupEmptyNamespaceDirectory(dirPath: string): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath);
    if (entries.length === 0) {
      await fs.rmdir(dirPath);
      logger.debug(`Cleaned up empty namespace directory: ${dirPath}`);

      // Recursively clean up parent directories if they're also empty
      const parentDir = path.dirname(dirPath);
      const parentName = path.basename(parentDir);
      if (parentName !== 'commands') {
        // Don't delete the commands directory itself
        await cleanupEmptyNamespaceDirectory(parentDir);
      }
    }
  } catch (error: any) {
    // Ignore errors during cleanup
    logger.debug(`Failed to cleanup directory ${dirPath}: ${error.message}`);
  }
}
