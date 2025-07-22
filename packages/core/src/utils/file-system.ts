import path from 'path';
import {
  ConsolidatedFileSystem,
  PathUtils,
} from './consolidated-filesystem.js';
import { ErrorCode, ApplicationError } from './error-handling.js';

export class FileSystemUtils {
  static async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await ConsolidatedFileSystem.ensureDirectory(dirPath);
    } catch (error) {
      throw new ApplicationError({
        message: `Failed to create directory: ${error}`,
        code: ErrorCode.PERMISSION_DENIED,
        context: { dirPath },
      });
    }
  }

  static async fileExists(filePath: string): Promise<boolean> {
    return await ConsolidatedFileSystem.fileExists(filePath);
  }

  static async isDirectory(dirPath: string): Promise<boolean> {
    return await ConsolidatedFileSystem.directoryExists(dirPath);
  }

  static async getFileStats(filePath: string): Promise<{
    size: number;
    lastModified: Date;
  } | null> {
    const stats = await ConsolidatedFileSystem.getFileStats(filePath);
    if (stats.exists && stats.size !== undefined && stats.lastModified) {
      return {
        size: stats.size,
        lastModified: stats.lastModified,
      };
    }
    return null;
  }

  static async readFileContent(filePath: string): Promise<string> {
    try {
      return await ConsolidatedFileSystem.readFile(filePath);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('not found') ||
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('no such file or directory')
      ) {
        throw new ApplicationError({
          message: `File not found: ${filePath}`,
          code: ErrorCode.FILE_NOT_FOUND,
          context: { filePath },
        });
      }
      throw new ApplicationError({
        message: `Failed to read file: ${errorMessage}`,
        code: ErrorCode.PERMISSION_DENIED,
        context: { filePath },
      });
    }
  }

  static async writeFileContent(
    filePath: string,
    content: string,
    options: { overwrite?: boolean } = {}
  ): Promise<void> {
    const exists = await ConsolidatedFileSystem.fileExists(filePath);

    if (exists && !options.overwrite) {
      throw new ApplicationError({
        message: `File already exists: ${filePath}`,
        code: ErrorCode.FILE_ALREADY_EXISTS,
        context: { filePath },
      });
    }

    try {
      await ConsolidatedFileSystem.writeFile(filePath, content, {
        createDirs: true,
        overwrite: options.overwrite ?? true,
      });
    } catch (error) {
      throw new ApplicationError({
        message: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: ErrorCode.PERMISSION_DENIED,
        context: { filePath },
      });
    }
  }

  static async moveFile(
    sourcePath: string,
    targetPath: string,
    options: { overwrite?: boolean } = {}
  ): Promise<void> {
    const sourceExists = await ConsolidatedFileSystem.fileExists(sourcePath);
    if (!sourceExists) {
      throw new ApplicationError({
        message: `Source file not found: ${sourcePath}`,
        code: ErrorCode.FILE_NOT_FOUND,
        context: { sourcePath },
      });
    }

    const targetExists = await ConsolidatedFileSystem.fileExists(targetPath);
    if (targetExists && !options.overwrite) {
      throw new ApplicationError({
        message: `Target file already exists: ${targetPath}`,
        code: ErrorCode.FILE_ALREADY_EXISTS,
        context: { targetPath },
      });
    }

    try {
      await ConsolidatedFileSystem.moveFile(sourcePath, targetPath, {
        createDirs: true,
        overwrite: options.overwrite ?? false,
      });
    } catch (error) {
      throw new ApplicationError({
        message: `Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: ErrorCode.PERMISSION_DENIED,
        context: { sourcePath },
      });
    }
  }

  static async deleteFile(filePath: string): Promise<void> {
    const exists = await ConsolidatedFileSystem.fileExists(filePath);
    if (!exists) {
      throw new ApplicationError({
        message: `File not found: ${filePath}`,
        code: ErrorCode.FILE_NOT_FOUND,
        context: { filePath },
      });
    }

    try {
      await ConsolidatedFileSystem.deleteFile(filePath);
    } catch (error) {
      throw new ApplicationError({
        message: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: ErrorCode.PERMISSION_DENIED,
        context: { filePath },
      });
    }
  }

  static async findFiles(
    searchPath: string,
    pattern: RegExp,
    recursive: boolean = true
  ): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await ConsolidatedFileSystem.listDirectory(searchPath);

      for (const entry of entries) {
        const fullPath = path.join(searchPath, entry);
        const stats = await ConsolidatedFileSystem.getFileStats(fullPath);

        if (stats.isFile && pattern.test(entry)) {
          results.push(fullPath);
        } else if (stats.isDirectory && recursive) {
          const subResults = await this.findFiles(fullPath, pattern, recursive);
          results.push(...subResults);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return results;
  }

  static resolvePath(basePath: string, relativePath: string): string {
    return PathUtils.resolve(basePath, relativePath);
  }

  static getRelativePath(from: string, to: string): string {
    return PathUtils.relative(from, to);
  }

  static isValidFileName(fileName: string): boolean {
    // Use consolidated validation with additional legacy checks
    const baseValid = ConsolidatedFileSystem.isValidFileName(fileName);

    // Additional legacy checks that were in the original
    const lengthValid = fileName.length > 0 && fileName.length <= 255;
    const dotValid = !fileName.startsWith('.') && !fileName.endsWith('.');

    return baseValid && lengthValid && dotValid;
  }
}
