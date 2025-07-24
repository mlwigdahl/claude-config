/**
 * Settings file operations implementation using base CRUD operations
 */

import {
  BaseCrudOperations,
  BaseOperationOptions,
  BaseOperationResult,
  UnifiedValidationResult,
  ValidationError as _ValidationError,
  ValidationWarning as _ValidationWarning,
} from './base.js';
import { validateSettingsPath } from '../settings/validation.js';
import { validateSettingsSchema } from '../utils/json-file.js';
import { readJsonFile, writeJsonFile } from '../utils/json-file.js';
import { ApplicationError, ErrorCode } from '../utils/error-handling.js';
import { SettingsConfig } from '../types/settings.js';

// ========================================
// Settings-specific Interfaces
// ========================================

/**
 * Options for settings file operations
 */
export interface SettingsOperationOptions extends BaseOperationOptions {
  mergeStrategy?: 'replace' | 'merge' | 'deep-merge';
  prettyPrint?: boolean;
  validateSchema?: boolean;
}

/**
 * Result of settings file operations
 */
export interface SettingsOperationResult extends BaseOperationResult {
  settings?: SettingsConfig;
}

// ========================================
// Implementation
// ========================================

/**
 * Settings file operations implementation
 */
export class SettingsFileOperations extends BaseCrudOperations<
  SettingsConfig,
  SettingsOperationOptions,
  SettingsOperationResult
> {
  // ========================================
  // Abstract Method Implementations
  // ========================================

  protected async validatePath(
    projectRoot: string,
    targetPath: string
  ): Promise<UnifiedValidationResult> {
    const validation = await validateSettingsPath(projectRoot, targetPath);

    return {
      valid: validation.valid,
      errors: validation.message
        ? [
            {
              code: 'INVALID_SETTINGS_PATH',
              message: validation.message,
              path: targetPath,
            },
          ]
        : [],
      warnings: [],
      metadata: validation.details,
    };
  }

  protected validateContent(content: SettingsConfig): UnifiedValidationResult {
    const validation = validateSettingsSchema(content);

    return {
      valid: validation.valid,
      errors: (validation.errors || []).map(error => ({
        code: error.keyword || 'INVALID_SETTINGS_SCHEMA',
        message: error.message,
        path: error.path,
        suggestion: error.params
          ? `Expected: ${JSON.stringify(error.params)}`
          : undefined,
      })),
      warnings: [],
    };
  }

  protected async readContent(filePath: string): Promise<SettingsConfig> {
    try {
      return await readJsonFile<SettingsConfig>(filePath);
    } catch (error: any) {
      if (error.code === ErrorCode.FILE_NOT_FOUND) {
        throw new ApplicationError({
          code: ErrorCode.FILE_NOT_FOUND,
          message: `Settings file not found: ${filePath}`,
          context: { filePath },
        });
      }
      if (error.code === ErrorCode.INVALID_JSON) {
        throw new ApplicationError({
          code: ErrorCode.INVALID_JSON,
          message: `Invalid JSON in settings file: ${error.message}`,
          context: { filePath },
        });
      }
      throw error;
    }
  }

  protected async writeContent(
    filePath: string,
    content: SettingsConfig,
    options: SettingsOperationOptions
  ): Promise<void> {
    await writeJsonFile(filePath, content, {
      createBackup: options.backup,
      prettyPrint: options.prettyPrint ?? true,
    });
  }

  protected mergeContent(
    existing: SettingsConfig,
    updates: Partial<SettingsConfig>,
    options: SettingsOperationOptions
  ): SettingsConfig {
    const strategy = options.mergeStrategy || 'deep-merge';

    switch (strategy) {
      case 'replace':
        return { ...updates } as SettingsConfig;

      case 'merge':
        return { ...existing, ...updates };

      case 'deep-merge':
        return this.deepMerge(existing, updates);

      default:
        throw new ApplicationError({
          code: ErrorCode.VALIDATION_FAILED,
          message: `Unknown merge strategy: ${strategy}`,
          context: { strategy, available: ['replace', 'merge', 'deep-merge'] },
        });
    }
  }

  protected createSuccessResponse(
    operation: string,
    filePath: string,
    content?: SettingsConfig
  ): SettingsOperationResult {
    const operationText = this.getOperationText(operation);
    return {
      success: true,
      message: `Settings file ${operationText} successfully`,
      filePath,
      settings: content,
    };
  }

  protected createErrorResponse(
    message: string,
    error: ApplicationError
  ): SettingsOperationResult {
    return {
      success: false,
      message,
      error,
    };
  }

  // ========================================
  // Hook Method Overrides
  // ========================================

  protected shouldValidateContent(_options: SettingsOperationOptions): boolean {
    return _options.validateSchema ?? true;
  }

  protected async performPreDeleteChecks(
    filePath: string,
    options: SettingsOperationOptions
  ): Promise<string[]> {
    const warnings: string[] = [];

    // Check if this is a critical settings file
    const fileName = filePath.split(/[/\\]/).pop() || '';
    if (fileName === 'settings.json' && !options.force) {
      warnings.push(
        'This is the main settings file. Deleting it may affect application behavior.'
      );
    }

    if (fileName === 'settings.local.json' && !options.force) {
      warnings.push(
        'This is a local settings file with potential overrides. Consider backing up before deletion.'
      );
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

  /**
   * Deep merge two objects recursively
   */
  private deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
      return target;
    }

    if (typeof source !== 'object' || Array.isArray(source)) {
      return source;
    }

    if (typeof target !== 'object' || Array.isArray(target)) {
      return source;
    }

    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof target[key] === 'object' &&
          target[key] !== null &&
          !Array.isArray(target[key])
        ) {
          result[key] = this.deepMerge(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }
}

// ========================================
// Static Factory Functions (Backward Compatibility)
// ========================================

const settingsOperations = new SettingsFileOperations();

/**
 * Create a new settings file
 */
export async function createSettingsFile(
  projectRoot: string,
  targetPath: string,
  content: SettingsConfig,
  options: SettingsOperationOptions = {}
): Promise<SettingsOperationResult> {
  return settingsOperations.create(projectRoot, targetPath, content, options);
}

/**
 * Update an existing settings file
 */
export async function updateSettingsFile(
  projectRoot: string,
  targetPath: string,
  content: Partial<SettingsConfig>,
  options: SettingsOperationOptions = {}
): Promise<SettingsOperationResult> {
  return settingsOperations.update(projectRoot, targetPath, content, options);
}

/**
 * Move a settings file to a different location
 */
export async function moveSettingsFile(
  projectRoot: string,
  sourcePath: string,
  targetPath: string,
  options: SettingsOperationOptions = {}
): Promise<SettingsOperationResult> {
  return settingsOperations.move(projectRoot, sourcePath, targetPath, options);
}

/**
 * Delete a settings file
 */
export async function deleteSettingsFile(
  projectRoot: string,
  targetPath: string,
  options: SettingsOperationOptions = {}
): Promise<SettingsOperationResult> {
  return settingsOperations.delete(projectRoot, targetPath, options);
}
