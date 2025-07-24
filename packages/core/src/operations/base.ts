/**
 * Base CRUD operations with template method pattern
 * Provides common workflow for all file operations while allowing customization
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import { ApplicationError, ErrorCode } from '../utils/error-handling.js';
import { getLogger } from '../utils/logger.js';

const _logger = getLogger('base-operations');

// ========================================
// Unified Interfaces
// ========================================

/**
 * Base interface for all operation options
 */
export interface BaseOperationOptions {
  dryRun?: boolean;
  backup?: boolean;
  force?: boolean;
}

/**
 * Base interface for all operation results
 */
export interface BaseOperationResult {
  success: boolean;
  message: string;
  filePath?: string;
  error?: ApplicationError;
  warnings?: string[];
}

/**
 * Unified validation result interface
 */
export interface UnifiedValidationResult<T = any> {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: T; // Module-specific data (imports, schema info, etc.)
}

/**
 * Structured validation error
 */
export interface ValidationError {
  code: string;
  message: string;
  path?: string;
  suggestion?: string;
}

/**
 * Structured validation warning
 */
export interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
  suggestion?: string;
}

// ========================================
// Abstract Base Class
// ========================================

/**
 * Abstract base class for CRUD operations using template method pattern
 * Provides consistent workflow while allowing customization of specific steps
 */
export abstract class BaseCrudOperations<
  TContent,
  TOptions extends BaseOperationOptions,
  TResult extends BaseOperationResult,
> {
  protected readonly logger = getLogger(this.constructor.name);

  // ========================================
  // Template Methods (Public API)
  // ========================================

  /**
   * Create a new file
   */
  async create(
    projectRoot: string,
    targetPath: string,
    content: TContent,
    options: TOptions = {} as TOptions
  ): Promise<TResult> {
    this.logger.info(`Creating file: ${targetPath}`);

    try {
      // 1. Dry run check
      if (options.dryRun) {
        return this.createDryRunResponse('create', targetPath);
      }

      // 2. Build and validate target path
      const resolvedPath = this.resolveTargetPath(projectRoot, targetPath);
      const pathValidation = await this.validatePath(projectRoot, resolvedPath);
      if (!pathValidation.valid) {
        throw this.createPathValidationError(pathValidation);
      }

      // 3. Content validation
      if (this.shouldValidateContent(options)) {
        const contentValidation = this.validateContent(content);
        if (!contentValidation.valid) {
          throw this.createContentValidationError(contentValidation);
        }
      }

      // 4. Pre-create checks (existence, permissions, etc.)
      await this.performPreCreateChecks(resolvedPath, options);

      // 5. Ensure directory exists
      await this.ensureDirectoryExists(resolvedPath);

      // 6. Create backup if needed
      const backupPath = await this.createBackupIfRequested(
        resolvedPath,
        options
      );

      // 7. Write content
      await this.writeContent(resolvedPath, content, options);

      // 8. Post-create tasks
      await this.performPostCreateTasks(resolvedPath, content, options);

      // 9. Success response
      const result = this.createSuccessResponse(
        'create',
        resolvedPath,
        content
      );
      if (backupPath) {
        result.warnings = result.warnings || [];
        result.warnings.push(`Backup created: ${backupPath}`);
      }

      this.logger.info(`Successfully created file: ${targetPath}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create file: ${error}`);
      return this.handleError(error, {
        projectRoot,
        targetPath,
        operation: 'create',
      });
    }
  }

  /**
   * Update an existing file
   */
  async update(
    projectRoot: string,
    targetPath: string,
    content: Partial<TContent>,
    options: TOptions = {} as TOptions
  ): Promise<TResult> {
    this.logger.info(`Updating file: ${targetPath}`);

    try {
      // 1. Dry run check
      if (options.dryRun) {
        return this.createDryRunResponse('update', targetPath);
      }

      // 2. Build and validate target path
      const resolvedPath = this.resolveTargetPath(projectRoot, targetPath);
      const pathValidation = await this.validatePath(projectRoot, resolvedPath);
      if (!pathValidation.valid) {
        throw this.createPathValidationError(pathValidation);
      }

      // 3. Check if file exists
      await this.ensureFileExists(resolvedPath);

      // 4. Read existing content
      const existingContent = await this.readContent(resolvedPath);

      // 5. Merge content
      const mergedContent = this.mergeContent(
        existingContent,
        content,
        options
      );

      // 6. Validate merged content
      if (this.shouldValidateContent(options)) {
        const contentValidation = this.validateContent(mergedContent);
        if (!contentValidation.valid) {
          throw this.createContentValidationError(contentValidation);
        }
      }

      // 7. Create backup if needed
      const backupPath = await this.createBackupIfRequested(
        resolvedPath,
        options
      );

      // 8. Write updated content
      await this.writeContent(resolvedPath, mergedContent, options);

      // 9. Post-update tasks
      await this.performPostUpdateTasks(resolvedPath, mergedContent, options);

      // 10. Success response
      const result = this.createSuccessResponse(
        'update',
        resolvedPath,
        mergedContent
      );
      if (backupPath) {
        result.warnings = result.warnings || [];
        result.warnings.push(`Backup created: ${backupPath}`);
      }

      this.logger.info(`Successfully updated file: ${targetPath}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to update file: ${error}`);
      return this.handleError(error, {
        projectRoot,
        targetPath,
        operation: 'update',
      });
    }
  }

  /**
   * Move a file to a new location
   */
  async move(
    projectRoot: string,
    sourcePath: string,
    targetPath: string,
    options: TOptions = {} as TOptions
  ): Promise<TResult> {
    this.logger.info(`Moving file from ${sourcePath} to ${targetPath}`);

    try {
      // 1. Dry run check
      if (options.dryRun) {
        return this.createDryRunResponse(
          'move',
          `${sourcePath} → ${targetPath}`
        );
      }

      // 2. Validate both paths
      const resolvedSourcePath = this.resolveTargetPath(
        projectRoot,
        sourcePath
      );
      const resolvedTargetPath = this.resolveTargetPath(
        projectRoot,
        targetPath
      );

      const sourceValidation = await this.validatePath(
        projectRoot,
        resolvedSourcePath
      );
      if (!sourceValidation.valid) {
        throw this.createPathValidationError(sourceValidation, 'source');
      }

      const targetValidation = await this.validatePath(
        projectRoot,
        resolvedTargetPath
      );
      if (!targetValidation.valid) {
        throw this.createPathValidationError(targetValidation, 'target');
      }

      // 3. Check source exists
      await this.ensureFileExists(resolvedSourcePath);

      // 4. Check target doesn't exist (unless force)
      if (!options.force) {
        await this.ensureFileDoesNotExist(resolvedTargetPath);
      }

      // 5. Ensure target directory exists
      await this.ensureDirectoryExists(resolvedTargetPath);

      // 6. Create backup if needed
      const backupPath = await this.createBackupIfRequested(
        resolvedSourcePath,
        options
      );

      // 7. Perform the move
      await this.performMove(resolvedSourcePath, resolvedTargetPath, options);

      // 8. Post-move tasks
      await this.performPostMoveTasks(
        resolvedSourcePath,
        resolvedTargetPath,
        options
      );

      // 9. Success response
      const result = this.createSuccessResponse('move', resolvedTargetPath);
      if (backupPath) {
        result.warnings = result.warnings || [];
        result.warnings.push(`Backup created: ${backupPath}`);
      }

      this.logger.info(
        `Successfully moved file from ${sourcePath} to ${targetPath}`
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to move file: ${error}`);
      return this.handleError(error, {
        projectRoot,
        sourcePath,
        targetPath,
        operation: 'move',
      });
    }
  }

  /**
   * Delete a file
   */
  async delete(
    projectRoot: string,
    targetPath: string,
    options: TOptions = {} as TOptions
  ): Promise<TResult> {
    this.logger.info(`Deleting file: ${targetPath}`);

    try {
      // 1. Dry run check
      if (options.dryRun) {
        return this.createDryRunResponse('delete', targetPath);
      }

      // 2. Build and validate target path
      const resolvedPath = this.resolveTargetPath(projectRoot, targetPath);
      const pathValidation = await this.validatePath(projectRoot, resolvedPath);
      if (!pathValidation.valid) {
        throw this.createPathValidationError(pathValidation);
      }

      // 3. Check if file exists
      await this.ensureFileExists(resolvedPath);

      // 4. Pre-delete checks (dependencies, warnings, etc.)
      const warnings = await this.performPreDeleteChecks(resolvedPath, options);

      // 5. Create backup if needed
      const backupPath = await this.createBackupIfRequested(
        resolvedPath,
        options
      );

      // 6. Perform the deletion
      await this.performDelete(resolvedPath, options);

      // 7. Post-delete tasks
      await this.performPostDeleteTasks(resolvedPath, options);

      // 8. Success response
      const result = this.createSuccessResponse('delete', resolvedPath);
      if (backupPath) {
        result.warnings = result.warnings || [];
        result.warnings.push(`Backup created: ${backupPath}`);
      }
      if (warnings.length > 0) {
        result.warnings = [...(result.warnings || []), ...warnings];
      }

      this.logger.info(`Successfully deleted file: ${targetPath}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error}`);
      return this.handleError(error, {
        projectRoot,
        targetPath,
        operation: 'delete',
      });
    }
  }

  // ========================================
  // Abstract Methods (Customization Points)
  // ========================================

  /**
   * Validate that the path is appropriate for this file type
   */
  protected abstract validatePath(
    projectRoot: string,
    targetPath: string,
    ...additionalArgs: any[]
  ): Promise<UnifiedValidationResult>;

  /**
   * Validate the content structure and format
   */
  protected abstract validateContent(
    content: TContent
  ): UnifiedValidationResult;

  /**
   * Read content from a file
   */
  protected abstract readContent(filePath: string): Promise<TContent>;

  /**
   * Write content to a file
   */
  protected abstract writeContent(
    filePath: string,
    content: TContent,
    options: TOptions
  ): Promise<void>;

  /**
   * Merge partial content with existing content
   */
  protected abstract mergeContent(
    existing: TContent,
    updates: Partial<TContent>,
    options: TOptions
  ): TContent;

  /**
   * Create a success response with appropriate data
   */
  protected abstract createSuccessResponse(
    operation: string,
    filePath: string,
    content?: TContent
  ): TResult;

  /**
   * Create an error response
   */
  protected abstract createErrorResponse(
    message: string,
    error: ApplicationError
  ): TResult;

  // ========================================
  // Hook Methods (Override as needed)
  // ========================================

  /**
   * Determine if content should be validated based on options
   */
  protected shouldValidateContent(_options: TOptions): boolean {
    return true; // Default: always validate
  }

  /**
   * Perform checks before creating a file
   */
  protected async performPreCreateChecks(
    filePath: string,
    options: TOptions
  ): Promise<void> {
    // Check if file already exists
    try {
      await fs.access(filePath);
      if (!options.force) {
        throw new ApplicationError({
          code: ErrorCode.FILE_ALREADY_EXISTS,
          message: `File already exists: ${filePath}`,
          context: { filePath },
        });
      }
    } catch (error: unknown) {
      const hasEnoentCode =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'ENOENT';
      if (!hasEnoentCode && !(error instanceof ApplicationError)) {
        throw error;
      }
      // File doesn't exist, which is what we want for create
      if (error instanceof ApplicationError) {
        throw error;
      }
    }
  }

  /**
   * Perform tasks after creating a file
   */
  protected async performPostCreateTasks(
    _filePath: string,
    _content: TContent,
    _options: TOptions
  ): Promise<void> {
    // Default: no post-create tasks
  }

  /**
   * Perform tasks after updating a file
   */
  protected async performPostUpdateTasks(
    _filePath: string,
    _content: TContent,
    _options: TOptions
  ): Promise<void> {
    // Default: no post-update tasks
  }

  /**
   * Perform the actual move operation
   */
  protected async performMove(
    sourcePath: string,
    targetPath: string,
    _options: TOptions
  ): Promise<void> {
    await fs.rename(sourcePath, targetPath);
  }

  /**
   * Perform tasks after moving a file
   */
  protected async performPostMoveTasks(
    _sourcePath: string,
    _targetPath: string,
    _options: TOptions
  ): Promise<void> {
    // Default: no post-move tasks
  }

  /**
   * Perform checks before deleting a file
   */
  protected async performPreDeleteChecks(
    _filePath: string,
    _options: TOptions
  ): Promise<string[]> {
    // Default: no pre-delete checks, no warnings
    return [];
  }

  /**
   * Perform the actual delete operation
   */
  protected async performDelete(
    filePath: string,
    _options: TOptions
  ): Promise<void> {
    await fs.unlink(filePath);
  }

  /**
   * Perform tasks after deleting a file
   */
  protected async performPostDeleteTasks(
    _filePath: string,
    _options: TOptions
  ): Promise<void> {
    // Default: no post-delete tasks
  }

  // ========================================
  // Common Utility Methods
  // ========================================

  /**
   * Resolve target path relative to project root
   */
  protected resolveTargetPath(projectRoot: string, targetPath: string): string {
    return path.resolve(projectRoot, targetPath);
  }

  /**
   * Create a dry run response
   */
  protected createDryRunResponse(
    _operation: string,
    _targetInfo: string
  ): TResult {
    return this.createSuccessResponse('dry-run', '', undefined) as TResult & {
      message: string;
    };
  }

  /**
   * Create backup file if requested
   */
  protected async createBackupIfRequested(
    filePath: string,
    options: TOptions
  ): Promise<string | undefined> {
    if (!options.backup) {
      return undefined;
    }

    try {
      await fs.access(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${filePath}.backup.${timestamp}`;
      await fs.copyFile(filePath, backupPath);
      this.logger.debug(`Created backup: ${backupPath}`);
      return backupPath;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, no backup needed
        return undefined;
      }
      // Log error but don't fail the operation
      this.logger.warn(`Failed to create backup: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Ensure directory exists for file path
   */
  protected async ensureDirectoryExists(filePath: string): Promise<void> {
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });
  }

  /**
   * Ensure file exists
   */
  protected async ensureFileExists(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new ApplicationError({
          code: ErrorCode.FILE_NOT_FOUND,
          message: `File not found: ${filePath}`,
          context: { filePath },
        });
      }
      throw error;
    }
  }

  /**
   * Ensure file does not exist
   */
  protected async ensureFileDoesNotExist(filePath: string): Promise<void> {
    try {
      await fs.access(filePath);
      throw new ApplicationError({
        code: ErrorCode.FILE_ALREADY_EXISTS,
        message: `File already exists: ${filePath}`,
        context: { filePath },
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, which is what we want
        return;
      }
      if (error instanceof ApplicationError) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Standard error handling
   */
  protected handleError(error: unknown, context: any): TResult {
    if (error instanceof ApplicationError) {
      return this.createErrorResponse(error.message, error);
    }

    const unexpectedError = new ApplicationError({
      message: `Unexpected error: ${error}`,
      code: ErrorCode.OPERATION_FAILED,
      context,
    });

    return this.createErrorResponse(unexpectedError.message, unexpectedError);
  }

  /**
   * Create path validation error
   */
  protected createPathValidationError(
    validation: UnifiedValidationResult,
    pathType: string = 'path'
  ): ApplicationError {
    const errorMessages = validation.errors.map(e => e.message).join(', ');
    return new ApplicationError({
      code: ErrorCode.INVALID_PATH,
      message: `Invalid ${pathType}: ${errorMessages}`,
      context: validation.metadata,
    });
  }

  /**
   * Create content validation error
   */
  protected createContentValidationError(
    validation: UnifiedValidationResult
  ): ApplicationError {
    const errorMessages = validation.errors.map(e => e.message).join(', ');
    return new ApplicationError({
      code: ErrorCode.INVALID_CONTENT,
      message: `Invalid content: ${errorMessages}`,
      context: validation.metadata,
    });
  }
}
