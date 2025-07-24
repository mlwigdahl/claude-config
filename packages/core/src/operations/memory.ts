/**
 * Memory file operations implementation using base CRUD operations
 */

import {
  BaseCrudOperations,
  BaseOperationOptions,
  BaseOperationResult,
  UnifiedValidationResult,
  ValidationError as _ValidationError,
  ValidationWarning as _ValidationWarning,
} from './base.js';
import {
  validateMemoryPath,
  validateMemoryContent,
} from '../memory/validation.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { ApplicationError, ErrorCode } from '../utils/error-handling.js';

// ========================================
// Memory-specific Interfaces
// ========================================

/**
 * Options for memory file operations
 */
export interface MemoryOperationOptions extends BaseOperationOptions {
  validateContent?: boolean;
  preserveImports?: boolean;
  overwrite?: boolean;
  updateImports?: boolean;
  checkDependencies?: boolean;
}

/**
 * Result of memory file operations
 */
export type MemoryOperationResult = BaseOperationResult;

// ========================================
// Implementation
// ========================================

/**
 * Memory file operations implementation
 */
export class MemoryFileOperations extends BaseCrudOperations<
  string,
  MemoryOperationOptions,
  MemoryOperationResult
> {
  // ========================================
  // Abstract Method Implementations
  // ========================================

  protected async validatePath(
    projectRoot: string,
    targetPath: string
  ): Promise<UnifiedValidationResult> {
    const validation = validateMemoryPath(projectRoot, targetPath);

    return {
      valid: validation.valid,
      errors: validation.errors.map(error => ({
        code: 'INVALID_MEMORY_PATH',
        message: error,
        path: targetPath,
      })),
      warnings: [], // validateMemoryPath doesn't return warnings
    };
  }

  protected validateContent(content: string): UnifiedValidationResult {
    const validation = validateMemoryContent(content);

    return {
      valid: validation.valid,
      errors: validation.errors.map(error => ({
        code: 'INVALID_MEMORY_CONTENT',
        message: error,
      })),
      warnings: (validation.warnings || []).map(warning => ({
        code: 'MEMORY_CONTENT_WARNING',
        message: warning,
      })),
      metadata: {
        imports: validation.imports || [],
      },
    };
  }

  protected async readContent(filePath: string): Promise<string> {
    try {
      return await FileSystemUtils.readFileContent(filePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new ApplicationError({
          code: ErrorCode.FILE_NOT_FOUND,
          message: `Memory file not found: ${filePath}`,
          context: { filePath },
        });
      }
      throw error;
    }
  }

  protected async writeContent(
    filePath: string,
    content: string,
    _options: MemoryOperationOptions
  ): Promise<void> {
    await FileSystemUtils.writeFileContent(filePath, content, {
      overwrite: true, // Always allow overwrite in writeContent since we handle existence checks elsewhere
    });
  }

  protected mergeContent(
    existing: string,
    updates: Partial<string>,
    options: MemoryOperationOptions
  ): string {
    // For memory files, we handle string content
    // If updates is a partial string, we treat it as the new content
    if (typeof updates === 'string') {
      if (options.preserveImports && existing) {
        // Parse existing content for imports
        const existingValidation = validateMemoryContent(existing);
        const updatesValidation = validateMemoryContent(updates);

        // If existing has imports and updates doesn't, preserve them
        if (
          existingValidation.imports.length > 0 &&
          updatesValidation.imports.length === 0
        ) {
          const importLines = existingValidation.imports.map(imp => `@${imp}`);
          return importLines.join('\n') + '\n\n' + updates;
        }
      }
      return updates;
    }

    // If updates is not a string, fall back to existing content
    return existing;
  }

  protected createSuccessResponse(
    operation: string,
    filePath: string,
    _content?: string
  ): MemoryOperationResult {
    const operationText = this.getOperationText(operation);
    return {
      success: true,
      message: `Memory file ${operationText} successfully`,
      filePath,
    };
  }

  protected createErrorResponse(
    message: string,
    error: ApplicationError
  ): MemoryOperationResult {
    return {
      success: false,
      message,
      error,
    };
  }

  // ========================================
  // Hook Method Overrides
  // ========================================

  protected shouldValidateContent(options: MemoryOperationOptions): boolean {
    return options.validateContent ?? true;
  }

  protected async performPostUpdateTasks(
    filePath: string,
    content: string,
    options: MemoryOperationOptions
  ): Promise<void> {
    // TODO: If updateImports is true, update import references in other files
    if (options.updateImports) {
      this.logger.debug('TODO: Update import references in other memory files');
    }
  }

  protected async performPreDeleteChecks(
    filePath: string,
    options: MemoryOperationOptions
  ): Promise<string[]> {
    const warnings: string[] = [];

    if (options.checkDependencies && !options.force) {
      // TODO: Check if other memory files import this file
      this.logger.debug('TODO: Check for dependencies on this memory file');
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
}

// ========================================
// Static Factory Functions (Backward Compatibility)
// ========================================

const memoryOperations = new MemoryFileOperations();

/**
 * Create a new memory file
 */
export async function createMemoryFile(
  projectRoot: string,
  targetPath: string,
  content: string,
  options: MemoryOperationOptions = {}
): Promise<MemoryOperationResult> {
  return memoryOperations.create(projectRoot, targetPath, content, options);
}

/**
 * Update an existing memory file
 */
export async function updateMemoryFile(
  projectRoot: string,
  targetPath: string,
  content: string,
  options: MemoryOperationOptions = {}
): Promise<MemoryOperationResult> {
  return memoryOperations.update(projectRoot, targetPath, content, options);
}

/**
 * Move a memory file to a different location
 */
export async function moveMemoryFile(
  projectRoot: string,
  sourcePath: string,
  targetPath: string,
  options: MemoryOperationOptions = {}
): Promise<MemoryOperationResult> {
  return memoryOperations.move(projectRoot, sourcePath, targetPath, options);
}

/**
 * Delete a memory file
 */
export async function deleteMemoryFile(
  projectRoot: string,
  targetPath: string,
  options: MemoryOperationOptions = {}
): Promise<MemoryOperationResult> {
  return memoryOperations.delete(projectRoot, targetPath, options);
}
