/**
 * Consolidated file system utilities
 * Centralizes all file system operations from across the codebase
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { getLogger } from './logger.js';

const logger = getLogger('consolidated-filesystem');

export interface FileOperationOptions {
  createBackup?: boolean;
  overwrite?: boolean;
  createDirs?: boolean;
  encoding?: BufferEncoding;
}

export interface BackupInfo {
  originalPath: string;
  backupPath: string;
  timestamp: string;
}

export interface FileStats {
  exists: boolean;
  isFile?: boolean;
  isDirectory?: boolean;
  size?: number;
  lastModified?: Date;
  permissions?: string;
}

/**
 * Consolidated file system utilities class
 */
export class ConsolidatedFileSystem {
  /**
   * Check if a file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory exists
   */
  static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get comprehensive file statistics
   */
  static async getFileStats(filePath: string): Promise<FileStats> {
    try {
      const stat = await fs.stat(filePath);
      return {
        exists: true,
        isFile: stat.isFile(),
        isDirectory: stat.isDirectory(),
        size: stat.size,
        lastModified: stat.mtime,
        permissions: stat.mode.toString(8),
      };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Read file content with error handling
   */
  static async readFile(
    filePath: string,
    options: FileOperationOptions = {}
  ): Promise<string> {
    const { encoding: _encoding = 'utf-8' } = options;

    try {
      logger.debug(`Reading file: ${filePath}`);
      const content = await fs.readFile(filePath, 'utf8');

      // Handle the case where content might be undefined or null
      const stringContent =
        content === undefined || content === null ? '' : String(content);

      logger.debug(
        `Successfully read file: ${filePath} (${stringContent.length} chars)`
      );
      return stringContent;
    } catch (error: any) {
      logger.error(`Failed to read file ${filePath}: ${error.message}`);
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Write file content with backup and directory creation options
   */
  static async writeFile(
    filePath: string,
    content: string,
    options: FileOperationOptions = {}
  ): Promise<BackupInfo | null> {
    const {
      createBackup = false,
      overwrite = true,
      createDirs = true,
      encoding: _encoding = 'utf-8',
    } = options;

    try {
      logger.debug(`Writing file: ${filePath}`);

      // Check if file exists and we're not overwriting
      if (!overwrite && (await this.fileExists(filePath))) {
        throw new Error(
          `File already exists and overwrite is disabled: ${filePath}`
        );
      }

      // Create backup if requested and file exists
      let backupInfo: BackupInfo | null = null;
      if (createBackup && (await this.fileExists(filePath))) {
        backupInfo = await this.createBackup(filePath);
      }

      // Create directories if needed
      if (createDirs) {
        await this.ensureDirectory(path.dirname(filePath));
      }

      // Write file atomically using temporary file
      // Ensure content is clean (no BOM or unwanted characters)
      const cleanContent = content.replace(/^\uFEFF/, ''); // Remove BOM if present
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      await fs.writeFile(tempPath, cleanContent, { encoding: 'utf8', flag: 'w' });
      await fs.rename(tempPath, filePath);

      logger.debug(
        `Successfully wrote file: ${filePath} (${content.length} chars)`
      );
      return backupInfo;
    } catch (error: any) {
      logger.error(`Failed to write file ${filePath}: ${error.message}`);
      throw new Error(`Failed to write file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Create a backup of a file
   */
  static async createBackup(filePath: string): Promise<BackupInfo> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;

    try {
      await fs.copyFile(filePath, backupPath);
      logger.debug(`Created backup: ${backupPath}`);

      return {
        originalPath: filePath,
        backupPath,
        timestamp,
      };
    } catch (error: any) {
      logger.error(`Failed to create backup for ${filePath}: ${error.message}`);
      throw new Error(
        `Failed to create backup for ${filePath}: ${error.message}`
      );
    }
  }

  /**
   * Ensure directory exists, creating it recursively if needed
   */
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      logger.debug(`Ensured directory exists: ${dirPath}`);
    } catch (error: any) {
      logger.error(`Failed to ensure directory ${dirPath}: ${error.message}`);
      throw new Error(
        `Failed to ensure directory ${dirPath}: ${error.message}`
      );
    }
  }

  /**
   * Delete a file with optional backup
   */
  static async deleteFile(
    filePath: string,
    options: FileOperationOptions = {}
  ): Promise<BackupInfo | null> {
    const { createBackup = false } = options;

    try {
      if (!(await this.fileExists(filePath))) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Create backup if requested
      let backupInfo: BackupInfo | null = null;
      if (createBackup) {
        backupInfo = await this.createBackup(filePath);
      }

      await fs.unlink(filePath);
      logger.debug(`Deleted file: ${filePath}`);
      return backupInfo;
    } catch (error: any) {
      logger.error(`Failed to delete file ${filePath}: ${error.message}`);
      throw new Error(`Failed to delete file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Move/rename a file
   */
  static async moveFile(
    sourcePath: string,
    targetPath: string,
    options: FileOperationOptions = {}
  ): Promise<void> {
    const { createDirs = true, overwrite = false } = options;

    try {
      if (!(await this.fileExists(sourcePath))) {
        throw new Error(`Source file not found: ${sourcePath}`);
      }

      if (!overwrite && (await this.fileExists(targetPath))) {
        throw new Error(`Target file already exists: ${targetPath}`);
      }

      if (createDirs) {
        await this.ensureDirectory(path.dirname(targetPath));
      }

      await fs.rename(sourcePath, targetPath);
      logger.debug(`Moved file from ${sourcePath} to ${targetPath}`);
    } catch (error: any) {
      logger.error(
        `Failed to move file from ${sourcePath} to ${targetPath}: ${error.message}`
      );
      throw new Error(
        `Failed to move file from ${sourcePath} to ${targetPath}: ${error.message}`
      );
    }
  }

  /**
   * Copy a file
   */
  static async copyFile(
    sourcePath: string,
    targetPath: string,
    options: FileOperationOptions = {}
  ): Promise<void> {
    const { createDirs = true, overwrite = false } = options;

    try {
      if (!(await this.fileExists(sourcePath))) {
        throw new Error(`Source file not found: ${sourcePath}`);
      }

      if (!overwrite && (await this.fileExists(targetPath))) {
        throw new Error(`Target file already exists: ${targetPath}`);
      }

      if (createDirs) {
        await this.ensureDirectory(path.dirname(targetPath));
      }

      await fs.copyFile(sourcePath, targetPath);
      logger.debug(`Copied file from ${sourcePath} to ${targetPath}`);
    } catch (error: any) {
      logger.error(
        `Failed to copy file from ${sourcePath} to ${targetPath}: ${error.message}`
      );
      throw new Error(
        `Failed to copy file from ${sourcePath} to ${targetPath}: ${error.message}`
      );
    }
  }

  /**
   * List directory contents
   */
  static async listDirectory(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath);
      const result = entries || [];
      logger.debug(`Listed directory ${dirPath}: ${result.length} entries`);
      return result;
    } catch (error: any) {
      logger.error(`Failed to list directory ${dirPath}: ${error.message}`);
      throw new Error(`Failed to list directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Remove directory (optionally recursive)
   */
  static async removeDirectory(
    dirPath: string,
    recursive = false
  ): Promise<void> {
    try {
      if (recursive) {
        await fs.rm(dirPath, { recursive: true, force: true });
      } else {
        await fs.rmdir(dirPath);
      }
      logger.debug(`Removed directory: ${dirPath}`);
    } catch (error: any) {
      logger.error(`Failed to remove directory ${dirPath}: ${error.message}`);
      throw new Error(
        `Failed to remove directory ${dirPath}: ${error.message}`
      );
    }
  }

  /**
   * Check if filename is valid
   */
  static isValidFileName(fileName: string): boolean {
    // Check for empty name
    if (!fileName || fileName.trim().length === 0) {
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
}

/**
 * Path utilities consolidated from across the codebase
 */
export class PathUtils {
  /**
   * Safely join path components
   */
  static join(...paths: string[]): string {
    return path.join(...paths);
  }

  /**
   * Resolve path to absolute
   */
  static resolve(...paths: string[]): string {
    return path.resolve(...paths);
  }

  /**
   * Get relative path between two paths
   */
  static relative(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * Check if path is absolute
   */
  static isAbsolute(filePath: string): boolean {
    return path.isAbsolute(filePath);
  }

  /**
   * Normalize path separators
   */
  static normalize(filePath: string): string {
    return path.normalize(filePath);
  }

  /**
   * Get directory name
   */
  static dirname(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * Get base name
   */
  static basename(filePath: string, ext?: string): string {
    return path.basename(filePath, ext);
  }

  /**
   * Get file extension
   */
  static extname(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * Parse path into components
   */
  static parse(filePath: string): path.ParsedPath {
    return path.parse(filePath);
  }

  /**
   * Format path from components
   */
  static format(pathObject: path.FormatInputPathObject): string {
    return path.format(pathObject);
  }
}

// Export convenience functions for backward compatibility
export const fileExists = ConsolidatedFileSystem.fileExists;
export const directoryExists = ConsolidatedFileSystem.directoryExists;
export const readFile = ConsolidatedFileSystem.readFile;
export const writeFile = ConsolidatedFileSystem.writeFile;
export const deleteFile = ConsolidatedFileSystem.deleteFile;
export const moveFile = ConsolidatedFileSystem.moveFile;
export const copyFile = ConsolidatedFileSystem.copyFile;
export const ensureDirectory = ConsolidatedFileSystem.ensureDirectory;
export const createBackup = ConsolidatedFileSystem.createBackup;
export const isValidFileName = ConsolidatedFileSystem.isValidFileName;
