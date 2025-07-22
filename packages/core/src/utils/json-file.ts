/**
 * JSON file system utilities for settings operations
 */

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
  SchemaValidationResult,
  SchemaValidationError,
} from '../types/settings.js';
import { HookEventType } from '../types/hooks.js';
import { getLogger } from './logger.js';

const logger = getLogger('json-file');

/**
 * Detect if we're running in test environment
 */
const isTestEnvironment = (): boolean => {
  return (
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
    (typeof process !== 'undefined' &&
      process.env?.JEST_WORKER_ID !== undefined) ||
    typeof jest !== 'undefined'
  );
};

/**
 * Options for JSON file operations
 */
export interface JsonFileOptions {
  createBackup?: boolean;
  prettyPrint?: boolean;
  encoding?: 'utf8';
}

/**
 * Reads and parses a JSON file
 */
export async function readJsonFile<T = any>(filePath: string): Promise<T> {
  logger.debug(`Reading JSON file: ${filePath}`);

  try {
    const content = await ConsolidatedFileSystem.readFile(filePath);

    // Handle empty files
    if (!content.trim()) {
      logger.debug('File is empty, returning empty object');
      return {} as T;
    }

    try {
      const parsed = JSON.parse(content);
      logger.debug('JSON parsed successfully');
      return parsed;
    } catch (parseError: any) {
      // Only log parse errors in non-test environments to reduce test noise
      if (!isTestEnvironment()) {
        logger.error(`JSON parse error: ${parseError.message}`);
      }

      throw new FileSystemError(
        `Failed to parse JSON: ${parseError.message}`,
        ErrorCode.JSON_PARSE_ERROR,
        filePath
      );
    }
  } catch (error) {
    // If it's already our standardized error, re-throw it
    if (error instanceof ApplicationError) {
      throw error;
    }

    // Transform filesystem errors to our standardized format
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
      throw new FileSystemError(
        `Settings file not found: ${filePath}`,
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
      `Failed to read JSON file: ${errorMessage}`,
      ErrorCode.OPERATION_FAILED,
      filePath
    );
  }
}

/**
 * Writes a JSON file with proper formatting
 */
export async function writeJsonFile<T = any>(
  filePath: string,
  data: T,
  options: JsonFileOptions = {}
): Promise<void> {
  const { createBackup = false, prettyPrint = true } = options;

  logger.debug(`Writing JSON file: ${filePath}`);

  try {
    // Serialize JSON
    const jsonContent = prettyPrint
      ? JSON.stringify(data, null, 2) + '\n'
      : JSON.stringify(data);

    // Use consolidated filesystem with all options
    const fsOptions: FileOperationOptions = {
      createBackup,
      createDirs: true,
      overwrite: true,
    };

    await ConsolidatedFileSystem.writeFile(filePath, jsonContent, fsOptions);
    logger.debug('JSON file written successfully');
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
      `Failed to write JSON file: ${errorMessage}`,
      ErrorCode.OPERATION_FAILED,
      filePath
    );
  }
}

/**
 * Updates a JSON file by merging new data
 */
export async function updateJsonFile<T extends Record<string, any>>(
  filePath: string,
  updates: Partial<T>,
  options: JsonFileOptions & { mergeArrays?: boolean } = {}
): Promise<T> {
  logger.debug(`Updating JSON file: ${filePath}`);

  // Read existing content or start with empty object
  let existing: T;
  try {
    existing = await readJsonFile<T>(filePath);
  } catch (error) {
    const errorObj = error as any;
    if (errorObj.code === ErrorCode.FILE_NOT_FOUND) {
      logger.debug('File does not exist, starting with empty object');
      existing = {} as T;
    } else {
      throw error;
    }
  }

  // Merge updates
  const merged = options.mergeArrays
    ? deepMerge(existing, updates)
    : { ...existing, ...updates };

  // Write back
  await writeJsonFile(filePath, merged, options);

  return merged as T;
}

/**
 * Validates JSON content against settings schema
 */
export function validateSettingsSchema(content: any): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];

  // Check top-level type
  if (
    typeof content !== 'object' ||
    content === null ||
    Array.isArray(content)
  ) {
    errors.push({
      path: '/',
      message: 'Settings must be a JSON object',
      keyword: 'type',
      params: { expected: 'object', actual: typeof content },
    });
    return { valid: false, errors };
  }

  // Validate known fields
  const validFields = [
    'apiKeyHelper',
    'cleanupPeriodDays',
    'env',
    'permissions',
    'model',
    'hooks',
  ];
  const unknownFields = Object.keys(content).filter(
    key => !validFields.includes(key)
  );

  if (unknownFields.length > 0) {
    unknownFields.forEach(field => {
      errors.push({
        path: `/${field}`,
        message: `Unknown field: ${field}`,
        keyword: 'additionalProperties',
        params: { field },
      });
    });
  }

  // Validate specific field types
  if ('apiKeyHelper' in content && typeof content.apiKeyHelper !== 'string') {
    errors.push({
      path: '/apiKeyHelper',
      message: 'apiKeyHelper must be a string',
      keyword: 'type',
      params: { expected: 'string', actual: typeof content.apiKeyHelper },
    });
  }

  if ('cleanupPeriodDays' in content) {
    if (
      typeof content.cleanupPeriodDays !== 'number' ||
      content.cleanupPeriodDays < 0
    ) {
      errors.push({
        path: '/cleanupPeriodDays',
        message: 'cleanupPeriodDays must be a non-negative number',
        keyword: 'minimum',
        params: { minimum: 0, actual: content.cleanupPeriodDays },
      });
    }
  }

  if ('env' in content) {
    if (
      typeof content.env !== 'object' ||
      content.env === null ||
      Array.isArray(content.env)
    ) {
      errors.push({
        path: '/env',
        message: 'env must be an object',
        keyword: 'type',
        params: { expected: 'object', actual: typeof content.env },
      });
    } else {
      Object.entries(content.env).forEach(([key, value]) => {
        if (typeof value !== 'string') {
          errors.push({
            path: `/env/${key}`,
            message: `Environment variable ${key} must be a string`,
            keyword: 'type',
            params: { expected: 'string', actual: typeof value },
          });
        }
      });
    }
  }

  if ('permissions' in content) {
    const perms = content.permissions;
    if (typeof perms !== 'object' || perms === null || Array.isArray(perms)) {
      errors.push({
        path: '/permissions',
        message: 'permissions must be an object',
        keyword: 'type',
        params: { expected: 'object', actual: typeof perms },
      });
    } else {
      // Validate allow/deny arrays
      if ('allow' in perms && !Array.isArray(perms.allow)) {
        errors.push({
          path: '/permissions/allow',
          message: 'permissions.allow must be an array',
          keyword: 'type',
          params: { expected: 'array', actual: typeof perms.allow },
        });
      }

      if ('deny' in perms && !Array.isArray(perms.deny)) {
        errors.push({
          path: '/permissions/deny',
          message: 'permissions.deny must be an array',
          keyword: 'type',
          params: { expected: 'array', actual: typeof perms.deny },
        });
      }
    }
  }

  if ('model' in content && typeof content.model !== 'string') {
    errors.push({
      path: '/model',
      message: 'model must be a string',
      keyword: 'type',
      params: { expected: 'string', actual: typeof content.model },
    });
  }

  if ('hooks' in content) {
    const hooks = content.hooks;
    if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) {
      errors.push({
        path: '/hooks',
        message: 'hooks must be an object',
        keyword: 'type',
        params: { expected: 'object', actual: typeof hooks },
      });
    } else {
      // Validate hook structure
      Object.entries(hooks).forEach(([eventType, eventHooks]) => {
        // First validate the event type
        const validEventTypes = Object.values(HookEventType) as string[];
        if (!validEventTypes.includes(eventType)) {
          errors.push({
            path: `/hooks/${eventType}`,
            message: `Invalid hook event type: "${eventType}". Valid event types are: ${validEventTypes.join(', ')}`,
            keyword: 'enum',
            params: { allowedValues: validEventTypes, actual: eventType },
          });
          return; // Skip further validation for this invalid event type
        }

        if (!Array.isArray(eventHooks)) {
          errors.push({
            path: `/hooks/${eventType}`,
            message: `Event hooks for ${eventType} must be an array of matchers`,
            keyword: 'type',
            params: { expected: 'array', actual: typeof eventHooks },
          });
        } else {
          eventHooks.forEach((matcher, index) => {
            if (
              typeof matcher !== 'object' ||
              matcher === null ||
              Array.isArray(matcher)
            ) {
              errors.push({
                path: `/hooks/${eventType}[${index}]`,
                message: 'Hook matcher must be an object',
                keyword: 'type',
                params: { expected: 'object', actual: typeof matcher },
              });
            } else {
              // Validate matcher object
              if (typeof matcher.matcher !== 'string') {
                errors.push({
                  path: `/hooks/${eventType}[${index}]/matcher`,
                  message: 'Hook matcher must be a string',
                  keyword: 'type',
                  params: {
                    expected: 'string',
                    actual: typeof matcher.matcher,
                  },
                });
              }

              if (!Array.isArray(matcher.hooks)) {
                errors.push({
                  path: `/hooks/${eventType}[${index}]/hooks`,
                  message: 'Hook definitions must be an array',
                  keyword: 'type',
                  params: { expected: 'array', actual: typeof matcher.hooks },
                });
              } else {
                matcher.hooks.forEach((hookDef: any, hookIndex: number) => {
                  if (
                    typeof hookDef !== 'object' ||
                    hookDef === null ||
                    Array.isArray(hookDef)
                  ) {
                    errors.push({
                      path: `/hooks/${eventType}[${index}]/hooks[${hookIndex}]`,
                      message: 'Hook definition must be an object',
                      keyword: 'type',
                      params: { expected: 'object', actual: typeof hookDef },
                    });
                  } else {
                    if (hookDef.type !== 'command') {
                      errors.push({
                        path: `/hooks/${eventType}[${index}]/hooks[${hookIndex}]/type`,
                        message: 'Hook type must be "command"',
                        keyword: 'const',
                        params: { expected: 'command', actual: hookDef.type },
                      });
                    }
                    if (typeof hookDef.command !== 'string') {
                      errors.push({
                        path: `/hooks/${eventType}[${index}]/hooks[${hookIndex}]/command`,
                        message: 'Hook command must be a string',
                        keyword: 'type',
                        params: {
                          expected: 'string',
                          actual: typeof hookDef.command,
                        },
                      });
                    }
                    if (
                      'timeout' in hookDef &&
                      (typeof hookDef.timeout !== 'number' ||
                        hookDef.timeout <= 0)
                    ) {
                      errors.push({
                        path: `/hooks/${eventType}[${index}]/hooks[${hookIndex}]/timeout`,
                        message: 'Hook timeout must be a positive number',
                        keyword: 'minimum',
                        params: { minimum: 1, actual: hookDef.timeout },
                      });
                    }
                  }
                });
              }
            }
          });
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (isObject(sourceValue) && isObject(targetValue)) {
        result[key] = deepMerge(targetValue as any, sourceValue as any);
      } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
        // For arrays, concatenate unique values
        result[key] = [...new Set([...targetValue, ...sourceValue])] as any;
      } else {
        result[key] = sourceValue as any;
      }
    }
  }

  return result;
}

/**
 * Check if value is a plain object
 */
function isObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Utility functions have been consolidated into ConsolidatedFileSystem and ErrorHandler
// All functionality is now available through the centralized modules
