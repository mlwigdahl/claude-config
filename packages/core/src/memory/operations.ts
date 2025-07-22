import path from 'path';
import os from 'os';
import {
  MemoryFileType,
  MemoryOperationResult,
  CreateMemoryFileOptions,
  UpdateMemoryFileOptions,
  MoveMemoryFileOptions,
  DeleteMemoryFileOptions,
} from '../types/memory.js';
import { ErrorCode, ApplicationError } from '../utils/error-handling.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { validateMemoryPath, validateMemoryContent } from './validation.js';

export class MemoryFileOperations {
  /**
   * Create a new memory file
   */
  static async createMemoryFile(
    projectRoot: string,
    targetPath: string,
    content: string,
    options: CreateMemoryFileOptions = {}
  ): Promise<MemoryOperationResult> {
    try {
      if (options.dryRun) {
        return { success: true, message: 'Dry run: File would be created' };
      }

      // Validate the target path
      const pathValidation = validateMemoryPath(projectRoot, targetPath);
      if (!pathValidation.isValid) {
        throw new ApplicationError({
          message: `Invalid path: ${pathValidation.errors.join(', ')}`,
          code: ErrorCode.INVALID_PATH,
          context: { targetPath },
        });
      }

      // Validate content if requested
      if (options.validateContent) {
        const contentValidation = validateMemoryContent(content);
        if (!contentValidation.isValid) {
          throw new ApplicationError({
            message: `Invalid content: ${contentValidation.errors.join(', ')}`,
            code: ErrorCode.INVALID_CONTENT,
            context: { targetPath },
          });
        }
      }

      // Resolve the full path
      const fullPath = path.resolve(projectRoot, targetPath);

      // Write the file
      await FileSystemUtils.writeFileContent(fullPath, content, {
        overwrite: options.overwrite,
      });

      return {
        success: true,
        message: `Memory file created successfully`,
        filePath: fullPath,
      };
    } catch (error) {
      if (error instanceof ApplicationError) {
        return {
          success: false,
          message: error.message,
          error,
        };
      }

      return {
        success: false,
        message: `Unexpected error: ${error}`,
        error: new ApplicationError({
          message: `Unexpected error: ${error}`,
          code: ErrorCode.VALIDATION_FAILED,
          context: { targetPath },
        }),
      };
    }
  }

  /**
   * Update an existing memory file
   */
  static async updateMemoryFile(
    projectRoot: string,
    targetPath: string,
    content: string,
    options: UpdateMemoryFileOptions = {}
  ): Promise<MemoryOperationResult> {
    try {
      if (options.dryRun) {
        return { success: true, message: 'Dry run: File would be updated' };
      }

      // Validate the target path
      const pathValidation = validateMemoryPath(projectRoot, targetPath);
      if (!pathValidation.isValid) {
        throw new ApplicationError({
          message: `Invalid path: ${pathValidation.errors.join(', ')}`,
          code: ErrorCode.INVALID_PATH,
          context: { targetPath },
        });
      }

      // Resolve the full path
      const fullPath = path.resolve(projectRoot, targetPath);

      // Check if file exists
      const exists = await FileSystemUtils.fileExists(fullPath);
      if (!exists) {
        throw new ApplicationError({
          message: `Memory file not found: ${targetPath}`,
          code: ErrorCode.FILE_NOT_FOUND,
          context: { fullPath },
        });
      }

      // Preserve imports if requested
      let finalContent = content;
      if (options.preserveImports) {
        const existingContent = await FileSystemUtils.readFileContent(fullPath);
        const existingValidation = validateMemoryContent(existingContent);
        const newValidation = validateMemoryContent(content);

        // Merge imports from existing content if new content doesn't have them
        if (
          existingValidation.imports.length > 0 &&
          newValidation.imports.length === 0
        ) {
          const importLines = existingValidation.imports.map(imp => `@${imp}`);
          finalContent = importLines.join('\n') + '\n\n' + content;
        }
      }

      // Validate content if requested
      if (options.validateContent) {
        const contentValidation = validateMemoryContent(finalContent);
        if (!contentValidation.isValid) {
          throw new ApplicationError({
            message: `Invalid content: ${contentValidation.errors.join(', ')}`,
            code: ErrorCode.INVALID_CONTENT,
            context: { targetPath },
          });
        }
      }

      // Write the updated content
      await FileSystemUtils.writeFileContent(fullPath, finalContent, {
        overwrite: true,
      });

      return {
        success: true,
        message: `Memory file updated successfully`,
        filePath: fullPath,
      };
    } catch (error) {
      if (error instanceof ApplicationError) {
        return {
          success: false,
          message: error.message,
          error,
        };
      }

      return {
        success: false,
        message: `Unexpected error: ${error}`,
        error: new ApplicationError({
          message: `Unexpected error: ${error}`,
          code: ErrorCode.VALIDATION_FAILED,
          context: { targetPath },
        }),
      };
    }
  }

  /**
   * Move a memory file to a different location
   */
  static async moveMemoryFile(
    projectRoot: string,
    sourcePath: string,
    targetPath: string,
    options: MoveMemoryFileOptions = {}
  ): Promise<MemoryOperationResult> {
    try {
      if (options.dryRun) {
        return { success: true, message: 'Dry run: File would be moved' };
      }

      // Validate both paths
      const sourceValidation = validateMemoryPath(projectRoot, sourcePath);
      const targetValidation = validateMemoryPath(projectRoot, targetPath);

      if (!sourceValidation.isValid) {
        throw new ApplicationError({
          message: `Invalid source path: ${sourceValidation.errors.join(', ')}`,
          code: ErrorCode.INVALID_PATH,
          context: { sourcePath },
        });
      }

      if (!targetValidation.isValid) {
        throw new ApplicationError({
          message: `Invalid target path: ${targetValidation.errors.join(', ')}`,
          code: ErrorCode.INVALID_PATH,
          context: { targetPath },
        });
      }

      // Resolve full paths
      const sourceFullPath = path.resolve(projectRoot, sourcePath);
      const targetFullPath = path.resolve(projectRoot, targetPath);

      // Move the file
      await FileSystemUtils.moveFile(sourceFullPath, targetFullPath, {
        overwrite: options.overwrite,
      });

      // TODO: Update import references if requested
      if (options.updateImports) {
        // This would require discovering all memory files and updating
        // any @import references to the moved file
      }

      return {
        success: true,
        message: `Memory file moved successfully`,
        filePath: targetFullPath,
      };
    } catch (error) {
      if (error instanceof ApplicationError) {
        return {
          success: false,
          message: error.message,
          error,
        };
      }

      return {
        success: false,
        message: `Unexpected error: ${error}`,
        error: new ApplicationError({
          message: `Unexpected error: ${error}`,
          code: ErrorCode.VALIDATION_FAILED,
          context: { sourcePath },
        }),
      };
    }
  }

  /**
   * Delete a memory file
   */
  static async deleteMemoryFile(
    projectRoot: string,
    targetPath: string,
    options: DeleteMemoryFileOptions = {}
  ): Promise<MemoryOperationResult> {
    try {
      if (options.dryRun) {
        return { success: true, message: 'Dry run: File would be deleted' };
      }

      // Validate the target path
      const pathValidation = validateMemoryPath(projectRoot, targetPath);
      if (!pathValidation.isValid) {
        throw new ApplicationError({
          message: `Invalid path: ${pathValidation.errors.join(', ')}`,
          code: ErrorCode.INVALID_PATH,
          context: { targetPath },
        });
      }

      // Resolve the full path
      const fullPath = path.resolve(projectRoot, targetPath);

      // Check for dependencies if requested
      if (options.checkDependencies && !options.force) {
        // TODO: Implement dependency checking
        // This would scan other memory files for import references
      }

      // Delete the file
      await FileSystemUtils.deleteFile(fullPath);

      return {
        success: true,
        message: `Memory file deleted successfully`,
        filePath: fullPath,
      };
    } catch (error) {
      if (error instanceof ApplicationError) {
        return {
          success: false,
          message: error.message,
          error,
        };
      }

      return {
        success: false,
        message: `Unexpected error: ${error}`,
        error: new ApplicationError({
          message: `Unexpected error: ${error}`,
          code: ErrorCode.VALIDATION_FAILED,
          context: { targetPath },
        }),
      };
    }
  }

  /**
   * Get the standard memory file paths for a project
   */
  static getStandardMemoryPaths(projectRoot: string): {
    project: string;
    user: string;
  } {
    return {
      project: path.join(projectRoot, 'CLAUDE.md'),
      user: path.join(os.homedir(), '.claude', 'CLAUDE.md'),
    };
  }

  /**
   * Determine the type of memory file based on its path
   */
  static getMemoryFileType(
    projectRoot: string,
    filePath: string
  ): MemoryFileType {
    const standardPaths = this.getStandardMemoryPaths(projectRoot);
    const resolvedPath = path.resolve(filePath);

    if (resolvedPath === path.resolve(standardPaths.project)) {
      return MemoryFileType.PROJECT;
    }

    if (resolvedPath === path.resolve(standardPaths.user)) {
      return MemoryFileType.USER;
    }

    return MemoryFileType.PARENT;
  }
}
