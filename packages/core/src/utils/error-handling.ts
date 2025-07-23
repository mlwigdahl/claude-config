/**
 * Centralized error handling utilities
 * Standardizes error patterns across the codebase
 */

import { getLogger } from './logger.js';

const logger = getLogger('error-handling');

/**
 * Base error codes - consolidated from across the codebase
 */
export enum ErrorCode {
  // File System Errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',
  INVALID_PATH = 'INVALID_PATH',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',

  // Content/Validation Errors
  INVALID_CONTENT = 'INVALID_CONTENT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  SCHEMA_VALIDATION_ERROR = 'SCHEMA_VALIDATION_ERROR',
  JSON_PARSE_ERROR = 'JSON_PARSE_ERROR',
  MARKDOWN_PARSE_ERROR = 'MARKDOWN_PARSE_ERROR',

  // Operation Errors
  OPERATION_FAILED = 'OPERATION_FAILED',
  TEMPLATE_CREATION_FAILED = 'TEMPLATE_CREATION_FAILED',
  PARSING_FAILED = 'PARSING_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',

  // Security Errors
  DANGEROUS_COMMAND = 'DANGEROUS_COMMAND',
  COMMAND_INJECTION_RISK = 'COMMAND_INJECTION_RISK',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',

  // Configuration Errors
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',

  // Command-specific Errors
  INVALID_COMMAND_SYNTAX = 'INVALID_COMMAND_SYNTAX',
  COMMAND_NAME_CONFLICT = 'COMMAND_NAME_CONFLICT',
  RESERVED_COMMAND_NAME = 'RESERVED_COMMAND_NAME',
  INVALID_SPECIAL_SYNTAX = 'INVALID_SPECIAL_SYNTAX',
  NAMESPACE_CONFLICT = 'NAMESPACE_CONFLICT',
  CLEANUP_FAILED = 'CLEANUP_FAILED',

  // Additional File/Path Errors
  INVALID_FILENAME = 'INVALID_FILENAME',
  INVALID_LOCATION = 'INVALID_LOCATION',
  INVALID_COMMAND_NAME = 'INVALID_COMMAND_NAME',
  INVALID_NAMESPACE = 'INVALID_NAMESPACE',

  // Content Errors
  INVALID_MARKDOWN = 'INVALID_MARKDOWN',
  INVALID_FRONTMATTER = 'INVALID_FRONTMATTER',
  FRONTMATTER_PARSE_ERROR = 'FRONTMATTER_PARSE_ERROR',
  INVALID_SETTINGS_FORMAT = 'INVALID_SETTINGS_FORMAT',
  INVALID_PERMISSION_RULE = 'INVALID_PERMISSION_RULE',
  INVALID_HOOK_DEFINITION = 'INVALID_HOOK_DEFINITION',
  INVALID_IMPORTS = 'INVALID_IMPORTS',
  DEPENDENCY_CONFLICT = 'DEPENDENCY_CONFLICT',

  // Operation-specific Errors
  MERGE_CONFLICT = 'MERGE_CONFLICT',
  HIERARCHY_CONFLICT = 'HIERARCHY_CONFLICT',
  INVALID_JSON = 'INVALID_JSON',
  INVALID_NAME = 'INVALID_NAME',

  // General Errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Standardized error details interface
 */
export interface ErrorDetails {
  code: ErrorCode;
  message: string;
  severity: ErrorSeverity;
  context?: Record<string, any>;
  cause?: Error;
  timestamp?: Date;
  location?: string;
}

/**
 * Result wrapper for operations that can fail
 */
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: ErrorDetails;
  warnings?: string[];
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: ErrorDetails[];
  warnings: string[];
}

/**
 * Base error class for all application errors
 */
export class ApplicationError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly context: Record<string, any>;
  public readonly timestamp: Date;
  public readonly location?: string;
  public readonly cause?: Error;

  constructor(
    details: Partial<ErrorDetails> & { message: string; code: ErrorCode }
  ) {
    super(details.message);
    this.name = this.constructor.name;
    this.code = details.code;
    this.severity = details.severity || ErrorSeverity.MEDIUM;
    this.context = details.context || {};
    this.timestamp = details.timestamp || new Date();
    this.location = details.location;
    this.cause = details.cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get filePath from context if available
   */
  get filePath(): string | undefined {
    return this.context.filePath;
  }

  /**
   * Convert to ErrorDetails object
   */
  toErrorDetails(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      location: this.location,
      cause: this.cause,
    };
  }

  /**
   * Convert to operation result
   */
  toOperationResult<T = any>(): OperationResult<T> {
    return {
      success: false,
      error: this.toErrorDetails(),
    };
  }
}

/**
 * File system specific errors
 */
export class FileSystemError extends ApplicationError {
  constructor(message: string, code: ErrorCode, filePath?: string) {
    super({
      message,
      code,
      severity: ErrorSeverity.MEDIUM,
      context: { filePath },
      location: 'FileSystem',
    });
  }
}

/**
 * Validation specific errors
 */
export class ValidationError extends ApplicationError {
  constructor(
    message: string,
    validationErrors: string[],
    context?: Record<string, any>
  ) {
    super({
      message,
      code: ErrorCode.VALIDATION_FAILED,
      severity: ErrorSeverity.MEDIUM,
      context: { ...context, validationErrors },
      location: 'Validation',
    });
  }
}

/**
 * Configuration specific errors
 */
export class ConfigurationError extends ApplicationError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INVALID_CONFIGURATION
  ) {
    super({
      message,
      code,
      severity: ErrorSeverity.HIGH,
      location: 'Configuration',
    });
  }
}

/**
 * Security specific errors
 */
export class SecurityError extends ApplicationError {
  constructor(message: string, code: ErrorCode = ErrorCode.SECURITY_VIOLATION) {
    super({
      message,
      code,
      severity: ErrorSeverity.CRITICAL,
      location: 'Security',
    });
  }
}

/**
 * Error handling utilities
 */
export class ErrorHandler {
  /**
   * Create a successful operation result
   */
  static success<T>(data: T, warnings?: string[]): OperationResult<T> {
    return {
      success: true,
      data,
      warnings,
    };
  }

  /**
   * Create a failed operation result from error
   */
  static failure<T = any>(
    error: ApplicationError | ErrorDetails | string
  ): OperationResult<T> {
    let errorDetails: ErrorDetails;

    if (typeof error === 'string') {
      errorDetails = {
        code: ErrorCode.OPERATION_FAILED,
        message: error,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
      };
    } else if (error instanceof ApplicationError) {
      errorDetails = error.toErrorDetails();
    } else {
      errorDetails = error;
    }

    return {
      success: false,
      error: errorDetails,
    };
  }

  /**
   * Wrap an async operation with error handling
   */
  static async safeExecute<T>(
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<OperationResult<T>> {
    try {
      const result = await operation();
      return this.success(result);
    } catch (error) {
      logger.error(
        'Operation failed:',
        error instanceof Error ? error : undefined,
        context
      );

      if (error instanceof ApplicationError) {
        return error.toOperationResult<T>();
      }

      // Convert generic errors to ApplicationError
      const appError = new ApplicationError({
        message: error instanceof Error ? error.message : String(error),
        code: ErrorCode.OPERATION_FAILED,
        context,
      });

      return appError.toOperationResult<T>();
    }
  }

  /**
   * Transform legacy error patterns to new format
   */
  static transformLegacyError(legacyError: any): ErrorDetails {
    // Handle different legacy error formats
    if (legacyError?.code && legacyError?.message) {
      // Legacy error object format
      return {
        code: this.mapLegacyErrorCode(legacyError.code),
        message: legacyError.message,
        severity: ErrorSeverity.MEDIUM,
        context: legacyError.details || {},
        timestamp: new Date(),
      };
    }

    if (legacyError instanceof Error) {
      return {
        code: ErrorCode.OPERATION_FAILED,
        message: legacyError.message,
        severity: ErrorSeverity.MEDIUM,
        timestamp: new Date(),
        cause: legacyError,
      };
    }

    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: String(legacyError),
      severity: ErrorSeverity.MEDIUM,
      timestamp: new Date(),
    };
  }

  /**
   * Map legacy error codes to new unified codes
   */
  private static mapLegacyErrorCode(legacyCode: string): ErrorCode {
    // Map old error codes to new ones
    const codeMap: Record<string, ErrorCode> = {
      // Memory operation codes
      MEMORY_INVALID_PATH: ErrorCode.INVALID_PATH,
      MEMORY_FILE_NOT_FOUND: ErrorCode.FILE_NOT_FOUND,
      MEMORY_VALIDATION_FAILED: ErrorCode.VALIDATION_FAILED,

      // Settings operation codes
      SETTINGS_JSON_PARSE_ERROR: ErrorCode.JSON_PARSE_ERROR,
      SETTINGS_INVALID_PATH: ErrorCode.INVALID_PATH,
      SETTINGS_FILE_NOT_FOUND: ErrorCode.FILE_NOT_FOUND,

      // Command operation codes
      COMMAND_INVALID_PATH: ErrorCode.INVALID_PATH,
      COMMAND_FILE_ALREADY_EXISTS: ErrorCode.FILE_ALREADY_EXISTS,
      COMMAND_FILE_NOT_FOUND: ErrorCode.FILE_NOT_FOUND,

      // Hook operation codes
      HOOK_DANGEROUS_COMMAND: ErrorCode.DANGEROUS_COMMAND,
      HOOK_COMMAND_INJECTION_RISK: ErrorCode.COMMAND_INJECTION_RISK,
    };

    return codeMap[legacyCode] || ErrorCode.UNKNOWN_ERROR;
  }

  /**
   * Create validation result from errors
   */
  static createValidationResult(
    errors: (ApplicationError | ErrorDetails | string)[],
    warnings: string[] = []
  ): ValidationResult {
    const errorDetails = errors.map(error => {
      if (typeof error === 'string') {
        return {
          code: ErrorCode.VALIDATION_FAILED,
          message: error,
          severity: ErrorSeverity.MEDIUM,
          timestamp: new Date(),
        };
      } else if (error instanceof ApplicationError) {
        return error.toErrorDetails();
      } else {
        return error;
      }
    });

    return {
      valid: errorDetails.length === 0,
      errors: errorDetails,
      warnings,
    };
  }

  /**
   * Log error with appropriate level based on severity
   */
  static logError(error: ErrorDetails | ApplicationError): void {
    const details =
      error instanceof ApplicationError ? error.toErrorDetails() : error;

    const logContext = {
      code: details.code,
      severity: details.severity,
      context: details.context,
      timestamp: details.timestamp,
      location: details.location,
    };

    switch (details.severity) {
      case ErrorSeverity.CRITICAL:
        logger.error(
          `${details.message} [${details.code}]`,
          details.cause,
          logContext
        );
        break;
      case ErrorSeverity.HIGH:
        logger.error(
          `${details.message} [${details.code}]`,
          details.cause,
          logContext
        );
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(`${details.message} [${details.code}]`, logContext);
        break;
      case ErrorSeverity.LOW:
        logger.debug(`${details.message} [${details.code}]`, logContext);
        break;
    }
  }
}

/**
 * Convenience functions for common error scenarios
 */
export class ErrorFactory {
  /**
   * Create a file not found error
   */
  static fileNotFound(filePath: string, context?: Record<string, any>): ApplicationError {
    return new ApplicationError({
      message: `File not found: ${filePath}`,
      code: ErrorCode.FILE_NOT_FOUND,
      severity: ErrorSeverity.MEDIUM,
      context: { filePath, ...context },
    });
  }

  /**
   * Create a file already exists error
   */
  static fileAlreadyExists(filePath: string, context?: Record<string, any>): ApplicationError {
    return new ApplicationError({
      message: `File already exists: ${filePath}`,
      code: ErrorCode.FILE_ALREADY_EXISTS,
      severity: ErrorSeverity.MEDIUM,
      context: { filePath, ...context },
    });
  }

  /**
   * Create a validation failed error
   */
  static validationFailed(message: string, validationErrors: string[], context?: Record<string, any>): ApplicationError {
    return new ApplicationError({
      message,
      code: ErrorCode.VALIDATION_FAILED,
      severity: ErrorSeverity.MEDIUM,
      context: { validationErrors, ...context },
    });
  }

  /**
   * Create an invalid path error
   */
  static invalidPath(path: string, reason: string, context?: Record<string, any>): ApplicationError {
    return new ApplicationError({
      message: `Invalid path: ${path}. ${reason}`,
      code: ErrorCode.INVALID_PATH,
      severity: ErrorSeverity.MEDIUM,
      context: { path, reason, ...context },
    });
  }

  /**
   * Create a permission denied error
   */
  static permissionDenied(resource: string, operation: string, context?: Record<string, any>): ApplicationError {
    return new ApplicationError({
      message: `Permission denied: cannot ${operation} ${resource}`,
      code: ErrorCode.PERMISSION_DENIED,
      severity: ErrorSeverity.HIGH,
      context: { resource, operation, ...context },
    });
  }

  /**
   * Create an invalid content error
   */
  static invalidContent(reason: string, context?: Record<string, any>): ApplicationError {
    return new ApplicationError({
      message: `Invalid content: ${reason}`,
      code: ErrorCode.INVALID_CONTENT,
      severity: ErrorSeverity.MEDIUM,
      context: { reason, ...context },
    });
  }

  /**
   * Create an operation failed error with wrapped cause
   */
  static operationFailed(operation: string, cause: Error, context?: Record<string, any>): ApplicationError {
    return new ApplicationError({
      message: `Operation failed: ${operation}`,
      code: ErrorCode.OPERATION_FAILED,
      severity: ErrorSeverity.MEDIUM,
      cause,
      context: { operation, ...context },
    });
  }
}

/**
 * Validation helpers
 */
export class ValidationFactory {
  /**
   * Create a standardized validation result for success
   */
  static success(warnings: string[] = []): { valid: boolean; errors: string[]; warnings: string[] } {
    return {
      valid: true,
      errors: [],
      warnings,
    };
  }

  /**
   * Create a standardized validation result for failure
   */
  static failure(errors: string[], warnings: string[] = []): { valid: boolean; errors: string[]; warnings: string[] } {
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  /**
   * Create a standardized validation result with single error
   */
  static singleError(error: string, warnings: string[] = []): { valid: boolean; errors: string[]; warnings: string[] } {
    return {
      valid: false,
      errors: [error],
      warnings,
    };
  }
}

// Export convenience functions
export const safeExecute = ErrorHandler.safeExecute;
export const success = ErrorHandler.success;
export const failure = ErrorHandler.failure;
export const createValidationResult = ErrorHandler.createValidationResult;
export const transformLegacyError = ErrorHandler.transformLegacyError;
