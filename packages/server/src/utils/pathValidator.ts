import * as path from 'path';
import { createError } from '../middleware/errorHandler.js';

// Get allowed base paths from environment or use defaults
const _getAllowedBasePaths = (): string[] => {
  const envPaths = process.env.ALLOWED_BASE_PATHS;
  if (envPaths) {
    return envPaths.split(',').map(p => path.resolve(p.trim()));
  }

  // Default to user's home directory if no paths specified
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return [path.resolve(homeDir)];
};

/**
 * Validate and sanitize a file path
 * Prevents basic security issues while allowing access to any directory
 */
export function validatePath(inputPath: string): string {
  if (!inputPath) {
    throw createError('Path cannot be empty', 400);
  }

  // Resolve to absolute path
  const resolvedPath = path.resolve(inputPath);

  // Normalize to prevent directory traversal
  const normalizedPath = path.normalize(resolvedPath);

  // Check for null bytes (basic security check)
  if (normalizedPath.includes('\0')) {
    throw createError('Invalid path: contains null bytes', 400);
  }

  // For local development tools, allow access to any directory
  // the user has permissions to access
  return normalizedPath;
}

/**
 * Check if a filename is safe
 */
export function isValidFileName(fileName: string): boolean {
  // Check for empty name
  if (!fileName || fileName.trim().length === 0) {
    return false;
  }

  // Check for directory traversal attempts
  if (
    fileName.includes('..') ||
    fileName.includes('/') ||
    fileName.includes('\\')
  ) {
    return false;
  }

  // Check for invalid characters (Windows + Unix)
  // eslint-disable-next-line no-control-regex
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(fileName)) {
    return false;
  }

  // Check for reserved names (Windows)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reservedNames.test(fileName)) {
    return false;
  }

  // Check for names ending with period or space
  if (fileName.endsWith('.') || fileName.endsWith(' ')) {
    return false;
  }

  return true;
}
