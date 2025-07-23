import { ApplicationError, ErrorCode } from '../utils/error-handling.js';

export enum MemoryFileType {
  PROJECT = 'project',
  USER = 'user',
  PARENT = 'parent',
}

export interface MemoryFileInfo {
  type: MemoryFileType;
  path: string;
  relativePath: string;
  exists: boolean;
  size?: number;
  lastModified?: Date;
  hasImports?: boolean;
  importPaths?: string[];
}

export interface MemoryOperationResult {
  success: boolean;
  message: string;
  filePath?: string;
  error?: MemoryOperationError;
}

/**
 * Legacy compatibility exports - use unified error handling instead
 */
export type MemoryOperationError = ApplicationError;
export const MemoryErrorCode = ErrorCode;

export interface MemoryFileValidationResult {
  valid: boolean; // Standardized from isValid
  errors: string[];
  warnings: string[];
  imports: string[];
  importDepth?: number; // Additional memory-specific metadata
}

export interface CreateMemoryFileOptions {
  overwrite?: boolean;
  validateContent?: boolean;
  dryRun?: boolean;
}

export interface UpdateMemoryFileOptions {
  validateContent?: boolean;
  preserveImports?: boolean;
  dryRun?: boolean;
}

export interface MoveMemoryFileOptions {
  overwrite?: boolean;
  updateImports?: boolean;
  dryRun?: boolean;
}

export interface DeleteMemoryFileOptions {
  checkDependencies?: boolean;
  force?: boolean;
  dryRun?: boolean;
}
