import { ConsolidatedFileSystem } from '@claude-config/core';
import * as path from 'path';
import * as os from 'os';
import { minimatch } from 'minimatch';
import { createError } from '../middleware/errorHandler.js';
import { getLogger } from '@claude-config/core';
import { ConfigurationServiceAPI } from './configurationService.js';

const logger = getLogger('server-filesystem');

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  size?: number;
  lastModified?: Date;
  fileType?: 'memory' | 'settings' | 'command';
  isInactive?: boolean;
  isValid?: boolean;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: Date;
  fileType?: 'memory' | 'settings' | 'command';
  isInactive?: boolean;
  isValid?: boolean;
}

export interface ListDirectoryOptions {
  includeHidden?: boolean;
}

export interface FileTreeOptions {
  maxDepth?: number;
  includeHidden?: boolean;
}

export interface SearchOptions {
  includeHidden?: boolean;
}

export interface ProjectFilesResult {
  files: DirectoryEntry[];
  directories: DirectoryEntry[];
  parentFiles: DirectoryEntry[];
  parentDirectories: DirectoryEntry[];
}

export interface FilteredFileTreeResult {
  tree: FileTreeNode;
  totalFiles: number;
  totalDirectories: number;
  configurationFiles: {
    memory: number;
    settings: number;
    command: number;
  };
  projectRootPath: string;
}

export interface DefaultDirectoryResult {
  defaultDirectory: string;
  homeDirectory: string;
  platform: string;
  drives?: string[];
}

export class FileSystemService {
  private gitignoreCache: Map<string, string[]> = new Map();

  /**
   * Read and parse .gitignore file
   */
  private async readGitignore(dirPath: string): Promise<string[]> {
    // Check cache first
    if (this.gitignoreCache.has(dirPath)) {
      return this.gitignoreCache.get(dirPath)!;
    }

    const gitignorePath = path.join(dirPath, '.gitignore');

    try {
      const content = await ConsolidatedFileSystem.readFile(gitignorePath);
      const patterns = content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); // Remove empty lines and comments

      // Cache the patterns
      this.gitignoreCache.set(dirPath, patterns);
      return patterns;
    } catch (_error) {
      // No .gitignore file or can't read it
      this.gitignoreCache.set(dirPath, []);
      return [];
    }
  }

  /**
   * Check if a path should be ignored based on gitignore patterns
   */
  private isIgnored(
    filePath: string,
    basePath: string,
    patterns: string[]
  ): boolean {
    if (patterns.length === 0) return false;

    const relativePath = path.relative(basePath, filePath);
    const parts = relativePath.split(path.sep);

    // Check each pattern
    for (const pattern of patterns) {
      // Handle directory patterns (ending with /)
      if (pattern.endsWith('/')) {
        const dirPattern = pattern.slice(0, -1);
        // Check if any part of the path matches the directory pattern
        for (let i = 0; i < parts.length; i++) {
          const partialPath = parts.slice(0, i + 1).join('/');
          if (
            minimatch(partialPath, dirPattern) ||
            minimatch(parts[i], dirPattern)
          ) {
            return true;
          }
        }
      } else {
        // Check file/directory patterns
        if (
          minimatch(relativePath, pattern) ||
          minimatch(path.basename(filePath), pattern)
        ) {
          return true;
        }
        // Also check if any parent directory matches
        for (let i = 0; i < parts.length; i++) {
          if (minimatch(parts[i], pattern)) {
            return true;
          }
        }
      }
    }

    return false;
  }
  /**
   * List directory contents
   */
  async listDirectory(
    dirPath: string,
    options: ListDirectoryOptions = {}
  ): Promise<DirectoryEntry[]> {
    const { includeHidden = false } = options;

    try {
      // Check if directory exists
      const stats = await ConsolidatedFileSystem.getFileStats(dirPath);
      if (!stats.exists || !stats.isDirectory) {
        throw createError('Directory not found', 404);
      }

      // Read directory entries
      const entries = await ConsolidatedFileSystem.listDirectory(dirPath);
      const results: DirectoryEntry[] = [];

      for (const entry of entries) {
        // Skip hidden files if requested
        if (!includeHidden && entry.startsWith('.')) {
          continue;
        }

        const entryPath = path.join(dirPath, entry);
        const entryStats = await ConsolidatedFileSystem.getFileStats(entryPath);

        if (entryStats.exists) {
          const directoryEntry: DirectoryEntry = {
            name: entry,
            path: entryPath,
            type: entryStats.isDirectory ? 'directory' : 'file',
            size: entryStats.size,
            lastModified: entryStats.lastModified,
          };

          // Add configuration file metadata for files
          if (entryStats.isFile) {
            const configCheck = FileSystemService.isConfigurationFile(
              entry,
              entryPath
            );
            if (configCheck.valid && configCheck.type) {
              directoryEntry.fileType = configCheck.type;
              directoryEntry.isInactive = entry.endsWith('.inactive');

              // For settings files, perform content validation
              if (configCheck.type === 'settings') {
                try {
                  const content =
                    await ConsolidatedFileSystem.readFile(entryPath);
                  const validation =
                    ConfigurationServiceAPI.validateSettingsFile(content);
                  directoryEntry.isValid = validation.isValid;
                } catch (error) {
                  logger.debug(
                    `Failed to validate settings file ${entryPath}: ${error}`
                  );
                  directoryEntry.isValid = false;
                }
              } else {
                directoryEntry.isValid = configCheck.valid;
              }
            }
          }

          results.push(directoryEntry);
        }
      }

      // Sort: directories first, then alphabetically
      results.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      logger.debug(`Listed directory ${dirPath}: ${results.length} entries`);
      return results;
    } catch (error: any) {
      if (error.status) throw error;
      logger.error(`Failed to list directory ${dirPath}: ${error.message}`);
      throw createError(`Failed to list directory: ${error.message}`, 500);
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<string> {
    try {
      // Check if file exists and is a file
      const stats = await ConsolidatedFileSystem.getFileStats(filePath);
      if (!stats.exists) {
        throw createError('File not found', 404);
      }
      if (!stats.isFile) {
        throw createError('Path is not a file', 400);
      }

      // Read file content
      const content = await ConsolidatedFileSystem.readFile(filePath);
      logger.debug(`Read file ${filePath}: ${content.length} characters`);
      return content;
    } catch (error: any) {
      if (error.status) throw error;
      logger.error(`Failed to read file ${filePath}: ${error.message}`);
      throw createError(`Failed to read file: ${error.message}`, 500);
    }
  }

  /**
   * Write file content
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await ConsolidatedFileSystem.writeFile(filePath, content, {
        createDirs: true,
        overwrite: true,
      });
      logger.debug(`Wrote file ${filePath}: ${content.length} characters`);
    } catch (error: any) {
      logger.error(`Failed to write file ${filePath}: ${error.message}`);
      throw createError(`Failed to write file: ${error.message}`, 500);
    }
  }

  /**
   * Delete file
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      // Check if file exists
      const stats = await ConsolidatedFileSystem.getFileStats(filePath);
      if (!stats.exists) {
        throw createError('File not found', 404);
      }
      if (!stats.isFile) {
        throw createError('Path is not a file', 400);
      }

      await ConsolidatedFileSystem.deleteFile(filePath);
      logger.debug(`Deleted file ${filePath}`);
    } catch (error: any) {
      if (error.status) throw error;
      logger.error(`Failed to delete file ${filePath}: ${error.message}`);
      throw createError(`Failed to delete file: ${error.message}`, 500);
    }
  }

  /**
   * Rename/move file
   */
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
      // Check if source file exists
      const stats = await ConsolidatedFileSystem.getFileStats(oldPath);
      if (!stats.exists) {
        throw createError('Source file not found', 404);
      }
      if (!stats.isFile) {
        throw createError('Source path is not a file', 400);
      }

      // Get file names for validation
      const oldFileName = path.basename(oldPath);
      const newFileName = path.basename(newPath);

      // Check if this is a configuration file rename (using more permissive logic)
      const oldFileConfig = FileSystemService.isConfigurationFileForRename(
        oldFileName,
        oldPath
      );
      const newFileConfig = FileSystemService.isConfigurationFileForRename(
        newFileName,
        newPath
      );

      // If source is a configuration file, apply type-specific validation
      if (oldFileConfig.valid) {
        // Type-specific validation based on source file type
        if (oldFileConfig.type === 'memory') {
          if (
            !newFileName.endsWith('.md') &&
            !newFileName.endsWith('.md.inactive')
          ) {
            throw createError('Memory files must have a .md extension', 400);
          }
        } else if (oldFileConfig.type === 'settings') {
          const validSettingsNames = [
            'settings.json',
            'settings.local.json',
            'settings.json.inactive',
            'settings.local.json.inactive',
          ];
          if (!validSettingsNames.includes(newFileName)) {
            throw createError(
              'Settings files must be named settings.json or settings.local.json',
              400
            );
          }
        } else if (oldFileConfig.type === 'command') {
          // For command files, ensure the target is also a valid command file
          if (!newFileConfig.valid || newFileConfig.type !== 'command') {
            throw createError(
              'Command files must remain in .claude/commands directory',
              400
            );
          }
        }
      }

      // Check if target file already exists
      const targetStats = await ConsolidatedFileSystem.getFileStats(newPath);
      if (targetStats.exists) {
        throw createError('A file with that name already exists', 409);
      }

      await ConsolidatedFileSystem.moveFile(oldPath, newPath, {
        createDirs: true,
        overwrite: false,
      });
      logger.debug(`Renamed file from ${oldPath} to ${newPath}`);
    } catch (error: any) {
      if (error.status) throw error;
      logger.error(
        `Failed to rename file from ${oldPath} to ${newPath}: ${error.message}`
      );
      throw createError(`Failed to rename file: ${error.message}`, 500);
    }
  }

  /**
   * Switch settings file type between project (settings.json) and local (settings.local.json)
   */
  async switchSettingsFileType(
    filePath: string
  ): Promise<{ newPath: string; newType: 'project' | 'local' }> {
    try {
      // Check if source file exists
      const stats = await ConsolidatedFileSystem.getFileStats(filePath);
      if (!stats.exists) {
        throw createError('Source file not found', 404);
      }
      if (!stats.isFile) {
        throw createError('Source path is not a file', 400);
      }

      // Get file name and validate it's a settings file
      const fileName = path.basename(filePath);
      const directory = path.dirname(filePath);

      if (
        ![
          'settings.json',
          'settings.local.json',
          'settings.json.inactive',
          'settings.local.json.inactive',
        ].includes(fileName)
      ) {
        throw createError(
          'Only settings files can have their type switched',
          400
        );
      }

      // Determine current and target types
      const isInactive = fileName.endsWith('.inactive');
      const baseFileName = isInactive
        ? fileName.replace('.inactive', '')
        : fileName;
      const isCurrentlyLocal = baseFileName === 'settings.local.json';

      // Calculate new file name
      let newFileName: string;
      let newType: 'project' | 'local';

      if (isCurrentlyLocal) {
        // Switch from local to project
        newFileName = isInactive ? 'settings.json.inactive' : 'settings.json';
        newType = 'project';
      } else {
        // Switch from project to local
        newFileName = isInactive
          ? 'settings.local.json.inactive'
          : 'settings.local.json';
        newType = 'local';
      }

      const newPath = path.join(directory, newFileName);

      // Check if target file already exists
      const targetStats = await ConsolidatedFileSystem.getFileStats(newPath);
      if (targetStats.exists) {
        const targetType = newType === 'project' ? 'project' : 'local';
        throw createError(
          `Cannot switch type: ${targetType} settings file already exists`,
          409
        );
      }

      // Perform the rename operation
      await ConsolidatedFileSystem.moveFile(filePath, newPath, {
        createDirs: true,
        overwrite: false,
      });

      logger.info(
        `Successfully switched settings file type: ${filePath} -> ${newPath}`
      );
      return { newPath, newType };
    } catch (error: any) {
      if (error.status) {
        throw error; // Re-throw our own errors
      }
      logger.error(`Failed to switch settings file type: ${error.message}`);
      throw createError(
        `Failed to switch settings file type: ${error.message}`,
        500
      );
    }
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath: string): Promise<void> {
    try {
      await ConsolidatedFileSystem.ensureDirectory(dirPath);
      logger.debug(`Created directory ${dirPath}`);
    } catch (error: any) {
      logger.error(`Failed to create directory ${dirPath}: ${error.message}`);
      throw createError(`Failed to create directory: ${error.message}`, 500);
    }
  }

  /**
   * Search for files matching a pattern
   */
  async searchFiles(
    rootPath: string,
    pattern: string,
    options: SearchOptions = {}
  ): Promise<string[]> {
    const { includeHidden = false } = options;
    const results: string[] = [];

    try {
      // Check if root path exists
      const stats = await ConsolidatedFileSystem.getFileStats(rootPath);
      if (!stats.exists || !stats.isDirectory) {
        throw createError('Root directory not found', 404);
      }

      // Recursive search function
      const searchDir = async (dirPath: string): Promise<void> => {
        const entries = await ConsolidatedFileSystem.listDirectory(dirPath);

        for (const entry of entries) {
          // Skip hidden files if requested
          if (!includeHidden && entry.startsWith('.')) {
            continue;
          }

          const entryPath = path.join(dirPath, entry);
          const entryStats =
            await ConsolidatedFileSystem.getFileStats(entryPath);

          if (!entryStats.exists) continue;

          if (entryStats.isDirectory) {
            // Recursively search subdirectories
            await searchDir(entryPath);
          } else if (entryStats.isFile) {
            // Check if file matches pattern
            if (minimatch(entry, pattern) || minimatch(entryPath, pattern)) {
              results.push(entryPath);
            }
          }
        }
      };

      await searchDir(rootPath);
      logger.debug(
        `Search in ${rootPath} for pattern "${pattern}": found ${results.length} files`
      );
      return results;
    } catch (error: any) {
      if (error.status) throw error;
      logger.error(`Failed to search files in ${rootPath}: ${error.message}`);
      throw createError(`Failed to search files: ${error.message}`, 500);
    }
  }

  /**
   * Get file tree structure
   */
  async getFileTree(
    rootPath: string,
    options: FileTreeOptions = {}
  ): Promise<FileTreeNode> {
    const { maxDepth = 10, includeHidden = false } = options;

    try {
      // Check if root path exists
      const stats = await ConsolidatedFileSystem.getFileStats(rootPath);
      if (!stats.exists) {
        throw createError('Path not found', 404);
      }

      // Build tree recursively
      const buildTree = async (
        nodePath: string,
        currentDepth: number
      ): Promise<FileTreeNode> => {
        const nodeStats = await ConsolidatedFileSystem.getFileStats(nodePath);
        const nodeName = path.basename(nodePath);

        const node: FileTreeNode = {
          name: nodeName,
          path: nodePath,
          type: nodeStats.isDirectory ? 'directory' : 'file',
          size: nodeStats.size,
          lastModified: nodeStats.lastModified,
        };

        // If it's a directory and we haven't reached max depth, get children
        if (nodeStats.isDirectory && currentDepth < maxDepth) {
          const entries = await ConsolidatedFileSystem.listDirectory(nodePath);
          const children: FileTreeNode[] = [];

          for (const entry of entries) {
            // Skip hidden files if requested
            if (!includeHidden && entry.startsWith('.')) {
              continue;
            }

            const childPath = path.join(nodePath, entry);
            try {
              const childNode = await buildTree(childPath, currentDepth + 1);
              children.push(childNode);
            } catch (_error) {
              // Skip inaccessible files
              logger.debug(`Skipping inaccessible path: ${childPath}`);
            }
          }

          // Sort children: directories first, then alphabetically
          children.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });

          if (children.length > 0) {
            node.children = children;
          }
        }

        return node;
      };

      const tree = await buildTree(rootPath, 0);
      logger.debug(`Built file tree for ${rootPath}`);
      return tree;
    } catch (error: any) {
      if (error.status) throw error;
      logger.error(
        `Failed to build file tree for ${rootPath}: ${error.message}`
      );
      throw createError(`Failed to build file tree: ${error.message}`, 500);
    }
  }

  /**
   * Check if a file is a configuration file for rename operations (more permissive)
   */
  private static isConfigurationFileForRename(
    fileName: string,
    filePath?: string
  ): {
    type: 'memory' | 'settings' | 'command' | null;
    valid: boolean;
  } {
    // Check for common invalid patterns - .inactive should only be at the end
    const inactiveIndex = fileName.indexOf('.inactive');
    if (inactiveIndex !== -1 && inactiveIndex !== fileName.length - 9) {
      return { type: null, valid: false };
    }
    // Check if file has .inactive extension
    const isInactive = fileName.endsWith('.inactive');
    const actualFileName = isInactive ? fileName.slice(0, -9) : fileName; // Remove '.inactive'
    const extension = actualFileName.split('.').pop()?.toLowerCase() || '';
    // Check for invalid manual renames - files ending with .inactive that aren't proper config files
    if (isInactive) {
      const baseCheck = this.isConfigurationFileForRename(
        actualFileName,
        filePath
      );
      if (!baseCheck.valid) {
        return { type: null, valid: false };
      }
    }
    // Settings files: settings.json, settings.local.json
    if (
      extension === 'json' &&
      (actualFileName === 'settings.json' ||
        actualFileName === 'settings.local.json')
    ) {
      return { type: 'settings', valid: true };
    }

    // Memory files: CLAUDE.md specifically (always memory, regardless of location)
    if (actualFileName === 'CLAUDE.md') {
      return { type: 'memory', valid: true };
    }

    // Command files: *.md files only in .claude/commands directory or its subdirectories
    // (but not CLAUDE.md, which is always memory)
    if (extension === 'md' && filePath && actualFileName !== 'CLAUDE.md') {
      const actualFilePath = isInactive ? filePath.slice(0, -9) : filePath; // Remove '.inactive' from path too
      if (FileSystemService.isCommandFile(actualFilePath)) {
        return { type: 'command', valid: true };
      }
    }

    // Memory files: any .md file that is not CLAUDE.md and not in .claude/commands (nonstandard memory files)
    if (extension === 'md' && actualFileName !== 'CLAUDE.md') {
      return { type: 'memory', valid: true };
    }

    // All other files are not configuration files
    return { type: null, valid: false };
  }

  /**
   * Check if a file is a configuration file
   */
  static isConfigurationFile(
    fileName: string,
    filePath?: string
  ): {
    type: 'memory' | 'settings' | 'command' | null;
    valid: boolean;
  } {
    // Check for common invalid patterns - .inactive should only be at the end
    const inactiveIndex = fileName.indexOf('.inactive');
    if (inactiveIndex !== -1 && inactiveIndex !== fileName.length - 9) {
      return { type: null, valid: false };
    }

    // Check if file has .inactive extension
    const isInactive = fileName.endsWith('.inactive');
    const actualFileName = isInactive ? fileName.slice(0, -9) : fileName; // Remove '.inactive'
    const extension = actualFileName.split('.').pop()?.toLowerCase() || '';

    // Check for invalid manual renames - files ending with .inactive that aren't proper config files
    if (isInactive) {
      const baseCheck = this.isConfigurationFile(actualFileName, filePath);
      if (!baseCheck.valid) {
        return { type: null, valid: false };
      }
    }

    // Settings files: settings.json, settings.local.json
    if (
      extension === 'json' &&
      (actualFileName === 'settings.json' ||
        actualFileName === 'settings.local.json')
    ) {
      return { type: 'settings', valid: true };
    }

    // Memory files: CLAUDE.md specifically (always memory, regardless of location)
    if (actualFileName === 'CLAUDE.md') {
      return { type: 'memory', valid: true };
    }

    // Command files: *.md files only in .claude/commands directory or its subdirectories
    // (but not CLAUDE.md, which is always memory)
    if (extension === 'md' && filePath && actualFileName !== 'CLAUDE.md') {
      const actualFilePath = isInactive ? filePath.slice(0, -9) : filePath; // Remove '.inactive' from path too
      if (FileSystemService.isCommandFile(actualFilePath)) {
        return { type: 'command', valid: true };
      }
    }

    // Memory files: any .md file that is not CLAUDE.md and not in .claude/commands (nonstandard memory files)
    if (extension === 'md' && actualFileName !== 'CLAUDE.md') {
      return { type: 'memory', valid: true };
    }

    // All other files are not configuration files
    return { type: null, valid: false };
  }

  /**
   * Check if a file is a command file (*.md file in .claude/commands directory or subdirectories)
   */
  static isCommandFile(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    const pathSegments = normalizedPath.split(path.sep);

    // Find .claude directory in path
    const claudeIndex = pathSegments.findIndex(
      segment => segment === '.claude'
    );
    if (claudeIndex === -1) return false;

    // Check if there's a commands directory after .claude
    const commandsIndex = pathSegments.findIndex(
      (segment, index) => index > claudeIndex && segment === 'commands'
    );
    if (commandsIndex === -1) return false;

    // File must be .md extension
    const fileName = path.basename(filePath);
    if (!fileName.endsWith('.md')) return false;

    // CLAUDE.md is never a command file - it's always a memory file
    if (fileName === 'CLAUDE.md' || fileName === 'CLAUDE.md.inactive')
      return false;

    return true;
  }

  /**
   * List project files with filtering for configuration files only
   */
  async listProjectFiles(
    projectRoot: string,
    rootPath: string
  ): Promise<ProjectFilesResult> {
    try {
      // Validate project directory
      const projectStats =
        await ConsolidatedFileSystem.getFileStats(projectRoot);
      if (!projectStats.exists) {
        throw createError('Project directory not found', 404);
      }
      if (!projectStats.isDirectory) {
        throw createError('Project path is not a directory', 400);
      }

      const result: ProjectFilesResult = {
        files: [],
        directories: [],
        parentFiles: [],
        parentDirectories: [],
      };

      // Get project files recursively
      await this.collectProjectFiles(projectRoot, result);

      // Get parent directory files up to one level below root
      await this.collectParentFiles(projectRoot, rootPath, result);

      logger.debug(
        `Listed project files for ${projectRoot}: ${result.files.length} files, ${result.directories.length} directories`
      );
      return result;
    } catch (error: any) {
      if (error.status) throw error;
      logger.error(
        `Failed to list project files for ${projectRoot}: ${error.message}`
      );
      throw createError(`Failed to list project files: ${error.message}`, 500);
    }
  }

  /**
   * Collect configuration files from project directory recursively
   */
  private async collectProjectFiles(
    dirPath: string,
    result: ProjectFilesResult
  ): Promise<void> {
    const entries = await ConsolidatedFileSystem.listDirectory(dirPath);

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const entryStats = await ConsolidatedFileSystem.getFileStats(entryPath);

      if (!entryStats.exists) continue;

      const directoryEntry: DirectoryEntry = {
        name: entry,
        path: entryPath,
        type: entryStats.isDirectory ? 'directory' : 'file',
        size: entryStats.size,
        lastModified: entryStats.lastModified,
      };

      if (entryStats.isDirectory) {
        // Always include directories (for navigation)
        result.directories.push(directoryEntry);

        // Recursively collect from subdirectories
        await this.collectProjectFiles(entryPath, result);
      } else if (entryStats.isFile) {
        // Only include configuration files
        const configCheck = FileSystemService.isConfigurationFile(
          entry,
          entryPath
        );
        if (configCheck.valid) {
          result.files.push(directoryEntry);
        }
      }
    }
  }

  /**
   * Collect configuration files from parent directories up to one level below root
   */
  private async collectParentFiles(
    projectRoot: string,
    rootPath: string,
    result: ProjectFilesResult
  ): Promise<void> {
    const rootResolved = path.resolve(rootPath);
    let currentPath = path.dirname(projectRoot);

    while (
      currentPath !== rootResolved &&
      currentPath !== path.dirname(currentPath)
    ) {
      try {
        const parentStats =
          await ConsolidatedFileSystem.getFileStats(currentPath);
        if (!parentStats.exists || !parentStats.isDirectory) {
          break;
        }

        // Add parent directory to list
        result.parentDirectories.push({
          name: path.basename(currentPath),
          path: currentPath,
          type: 'directory',
          size: parentStats.size,
          lastModified: parentStats.lastModified,
        });

        // Check for configuration files in parent directory
        const entries = await ConsolidatedFileSystem.listDirectory(currentPath);
        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry);
          const entryStats =
            await ConsolidatedFileSystem.getFileStats(entryPath);

          if (entryStats.exists && entryStats.isFile) {
            const configCheck = FileSystemService.isConfigurationFile(
              entry,
              entryPath
            );
            if (configCheck.valid) {
              result.parentFiles.push({
                name: entry,
                path: entryPath,
                type: 'file',
                size: entryStats.size,
                lastModified: entryStats.lastModified,
              });
            }
          }
        }

        // Move up one level
        currentPath = path.dirname(currentPath);
      } catch (_error) {
        // Skip inaccessible directories
        logger.debug(`Skipping inaccessible parent directory: ${currentPath}`);
        break;
      }
    }
  }

  /**
   * Build filtered file tree showing only configuration files and all directories
   */
  async buildFilteredFileTree(
    projectRoot: string,
    rootPath: string
  ): Promise<FilteredFileTreeResult> {
    try {
      const stats = {
        totalFiles: 0,
        totalDirectories: 0,
        configurationFiles: { memory: 0, settings: 0, command: 0 },
      };

      // Read gitignore patterns from project root
      const gitignorePatterns = await this.readGitignore(projectRoot);

      // Build the tree including parent directories
      const tree = await this.buildTreeWithParents(
        projectRoot,
        rootPath,
        stats,
        gitignorePatterns
      );

      // Debug logging (commented out for production)
      // console.log('=== Tree Building Debug ===');
      // console.log('Project root:', projectRoot);
      // console.log('Root path:', rootPath);
      // console.log('Resolved project root:', path.resolve(projectRoot));
      // console.log('Tree root name:', tree.name);
      // console.log('Tree root path:', tree.path);
      // console.log('=== End Debug ===');

      return {
        tree,
        totalFiles: stats.totalFiles,
        totalDirectories: stats.totalDirectories,
        configurationFiles: stats.configurationFiles,
        projectRootPath: path.resolve(projectRoot),
      };
    } catch (error: any) {
      if (error.status) throw error;
      logger.error(
        `Failed to build filtered file tree for ${projectRoot}: ${error.message}`
      );
      throw createError(
        `Failed to build filtered file tree: ${error.message}`,
        500
      );
    }
  }

  /**
   * Build tree including parent directories up to one level below root
   */
  private async buildTreeWithParents(
    projectRoot: string,
    rootPath: string,
    stats: any,
    gitignorePatterns: string[]
  ): Promise<FileTreeNode> {
    const rootResolved = path.resolve(rootPath);
    const projectResolved = path.resolve(projectRoot);

    // Get all parent paths from root to project
    const parentPaths: string[] = [];
    let currentPath = projectResolved;

    // Collect parent paths up to one level below root
    while (
      currentPath !== rootResolved &&
      path.dirname(currentPath) !== currentPath
    ) {
      const parentPath = path.dirname(currentPath);
      if (parentPath === rootResolved) {
        break; // Stop at one level below root
      }
      parentPaths.unshift(currentPath);
      currentPath = parentPath;
    }

    // If we have parent directories, build from the topmost parent
    if (parentPaths.length > 0) {
      // Start from the parent closest to root
      const topParent = parentPaths[0];
      const topParentDir = path.dirname(topParent);

      // Build tree step by step
      const rootNode = await this.buildAncestorDirectoryNode(
        topParentDir,
        stats
      );

      // Build the chain of parent directories
      let currentNode = rootNode;
      for (let i = 0; i < parentPaths.length; i++) {
        const pathToAdd = parentPaths[i];
        const isProjectRoot = pathToAdd === projectResolved;

        if (isProjectRoot) {
          // Build the full project tree
          const projectNode = await this.buildFilteredTreeNode(
            pathToAdd,
            stats,
            projectRoot,
            gitignorePatterns
          );

          // Add the full project node directly (not just its children)
          if (!currentNode.children) {
            currentNode.children = [];
          }
          currentNode.children.push(projectNode);
        } else {
          // Create directory node with config files
          const dirNode = await this.buildAncestorDirectoryNode(
            pathToAdd,
            stats
          );

          // Add configuration files and .claude directory
          await this.addAncestorConfigFiles(
            dirNode,
            pathToAdd,
            stats,
            projectRoot,
            gitignorePatterns
          );

          // Add to current node's children
          if (!currentNode.children) {
            currentNode.children = [];
          }
          currentNode.children.push(dirNode);
          currentNode = dirNode;
        }
      }

      // Add configuration files to root node
      await this.addAncestorConfigFiles(
        rootNode,
        topParentDir,
        stats,
        projectRoot,
        gitignorePatterns
      );

      return rootNode;
    } else {
      // No parent directories to show, just build project tree
      return await this.buildFilteredTreeNode(
        projectRoot,
        stats,
        projectRoot,
        gitignorePatterns
      );
    }
  }

  /**
   * Build a basic directory node without children
   */
  private async buildAncestorDirectoryNode(
    dirPath: string,
    stats: any
  ): Promise<FileTreeNode> {
    const dirStats = await ConsolidatedFileSystem.getFileStats(dirPath);
    const dirName = path.basename(dirPath);

    stats.totalDirectories++;

    return {
      name: dirName,
      path: dirPath,
      type: 'directory',
      size: dirStats.size,
      lastModified: dirStats.lastModified,
      children: [],
    };
  }

  /**
   * Add configuration files and .claude directories to an ancestor directory node
   */
  private async addAncestorConfigFiles(
    dirNode: FileTreeNode,
    dirPath: string,
    stats: any,
    projectRoot: string,
    gitignorePatterns: string[]
  ): Promise<void> {
    try {
      const entries = await ConsolidatedFileSystem.listDirectory(dirPath);

      for (const entry of entries) {
        const childPath = path.join(dirPath, entry);

        try {
          const childStats =
            await ConsolidatedFileSystem.getFileStats(childPath);
          if (!childStats.exists) continue;

          if (childStats.isDirectory) {
            // Only include .claude directories
            if (entry === '.claude') {
              // Create the .claude directory node and populate it with special logic
              const claudeStats =
                await ConsolidatedFileSystem.getFileStats(childPath);
              const claudeNode: FileTreeNode = {
                name: entry,
                path: childPath,
                type: 'directory',
                size: claudeStats.size,
                lastModified: claudeStats.lastModified,
              };
              stats.totalDirectories++;

              // Use special .claude directory building logic
              await this.buildClaudeDirectoryContents(
                claudeNode,
                childPath,
                stats,
                projectRoot,
                gitignorePatterns
              );
              dirNode.children!.push(claudeNode);
            }
          } else if (childStats.isFile) {
            // Only include configuration files
            const configCheck = FileSystemService.isConfigurationFile(
              entry,
              childPath
            );
            if (configCheck.valid) {
              const fileNode = await this.buildFilteredTreeNode(
                childPath,
                stats,
                projectRoot,
                gitignorePatterns
              );
              dirNode.children!.push(fileNode);
            }
          }
        } catch (_error) {
          // Skip inaccessible files
          logger.debug(`Skipping inaccessible path: ${childPath}`);
        }
      }

      // Sort children: directories first, then alphabetically
      dirNode.children!.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (_error) {
      logger.debug(`Cannot read directory ${dirPath}: ${_error}`);
    }
  }

  /**
   * Find a child node by path
   */
  private findChildNode(
    parent: FileTreeNode,
    targetPath: string
  ): FileTreeNode | null {
    if (!parent.children) return null;

    for (const child of parent.children) {
      if (child.path === targetPath) {
        return child;
      }
      // Recursively search in child nodes
      const found = this.findChildNode(child, targetPath);
      if (found) return found;
    }
    return null;
  }

  /**
   * Build a single filtered tree node
   */
  private async buildFilteredTreeNode(
    nodePath: string,
    stats: any,
    projectRoot: string,
    gitignorePatterns: string[]
  ): Promise<FileTreeNode> {
    const nodeStats = await ConsolidatedFileSystem.getFileStats(nodePath);
    const nodeName = path.basename(nodePath);

    const node: FileTreeNode = {
      name: nodeName,
      path: nodePath,
      type: nodeStats.isDirectory ? 'directory' : 'file',
      size: nodeStats.size,
      lastModified: nodeStats.lastModified,
    };

    if (nodeStats.isDirectory) {
      stats.totalDirectories++;

      // Special handling for .claude directories
      if (nodeName === '.claude') {
        await this.buildClaudeDirectoryContents(
          node,
          nodePath,
          stats,
          projectRoot,
          gitignorePatterns
        );
      } else {
        const entries = await ConsolidatedFileSystem.listDirectory(nodePath);
        const children: FileTreeNode[] = [];

        for (const entry of entries) {
          const childPath = path.join(nodePath, entry);

          // Check if this path should be ignored
          if (this.isIgnored(childPath, projectRoot, gitignorePatterns)) {
            logger.debug(`Skipping ignored path: ${childPath}`);
            continue;
          }

          try {
            const childStats =
              await ConsolidatedFileSystem.getFileStats(childPath);
            if (!childStats.exists) continue;

            if (childStats.isDirectory) {
              // Always include directories (unless ignored)
              const childNode = await this.buildFilteredTreeNode(
                childPath,
                stats,
                projectRoot,
                gitignorePatterns
              );
              children.push(childNode);
            } else if (childStats.isFile) {
              // Only include configuration files
              const configCheck = FileSystemService.isConfigurationFile(
                entry,
                childPath
              );
              if (configCheck.valid) {
                const childNode = await this.buildFilteredTreeNode(
                  childPath,
                  stats,
                  projectRoot,
                  gitignorePatterns
                );
                children.push(childNode);
              }
            }
          } catch (_error) {
            // Skip inaccessible files
            logger.debug(`Skipping inaccessible path: ${childPath}`);
          }
        }

        // Sort children: directories first, then alphabetically
        children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

        if (children.length > 0) {
          node.children = children;
        }
      }
    } else {
      stats.totalFiles++;
      const configCheck = FileSystemService.isConfigurationFile(
        nodeName,
        nodePath
      );

      if (configCheck.valid && configCheck.type) {
        stats.configurationFiles[configCheck.type]++;

        // Add configuration file metadata to the node
        node.fileType = configCheck.type;
        node.isInactive = nodeName.endsWith('.inactive');

        // For settings files, perform content validation
        if (configCheck.type === 'settings') {
          try {
            const content = await ConsolidatedFileSystem.readFile(nodePath);
            const validation =
              ConfigurationServiceAPI.validateSettingsFile(content);
            node.isValid = validation.isValid;
          } catch (error) {
            logger.debug(
              `Failed to validate settings file ${nodePath}: ${error}`
            );
            node.isValid = false;
          }
        } else {
          // For non-settings config files, use the basic validity check
          node.isValid = configCheck.valid;
        }
      }
    }

    return node;
  }

  /**
   * Build .claude directory contents: direct files + commands subdirectory only
   */
  private async buildClaudeDirectoryContents(
    claudeNode: FileTreeNode,
    claudePath: string,
    stats: any,
    projectRoot: string,
    gitignorePatterns: string[]
  ): Promise<void> {
    try {
      const entries = await ConsolidatedFileSystem.listDirectory(claudePath);
      const children: FileTreeNode[] = [];

      for (const entry of entries) {
        const childPath = path.join(claudePath, entry);

        try {
          const childStats =
            await ConsolidatedFileSystem.getFileStats(childPath);
          if (!childStats.exists) continue;

          if (childStats.isDirectory) {
            if (entry === 'commands') {
              // Build commands directory with all config files at any depth
              const commandsNode = await this.buildCommandsDirectory(
                childPath,
                stats,
                projectRoot,
                gitignorePatterns
              );
              children.push(commandsNode);
            }
            // Skip all other subdirectories in .claude directory
          } else if (childStats.isFile) {
            // Include direct files in .claude directory if they are configuration files
            const configCheck = FileSystemService.isConfigurationFile(
              entry,
              childPath
            );
            if (configCheck.valid) {
              const fileNode: FileTreeNode = {
                name: entry,
                path: childPath,
                type: 'file',
                size: childStats.size,
                lastModified: childStats.lastModified,
                fileType: configCheck.type || undefined,
                isInactive: entry.endsWith('.inactive'),
              };

              // For settings files, perform content validation
              if (configCheck.type === 'settings') {
                try {
                  const content =
                    await ConsolidatedFileSystem.readFile(childPath);
                  const validation =
                    ConfigurationServiceAPI.validateSettingsFile(content);
                  fileNode.isValid = validation.isValid;
                } catch (error) {
                  logger.debug(
                    `Failed to validate settings file ${childPath}: ${error}`
                  );
                  fileNode.isValid = false;
                }
              } else {
                fileNode.isValid = configCheck.valid;
              }

              stats.totalFiles++;
              if (configCheck.type) {
                stats.configurationFiles[configCheck.type]++;
              }
              children.push(fileNode);
            }
          }
        } catch (_error) {
          logger.debug(`Skipping inaccessible path: ${childPath}`);
        }
      }

      // Sort children: directories first, then alphabetically
      children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      if (children.length > 0) {
        claudeNode.children = children;
      }
    } catch (_error) {
      logger.debug(`Cannot read .claude directory ${claudePath}: ${_error}`);
    }
  }

  /**
   * Build commands directory with all configuration files at any depth
   */
  private async buildCommandsDirectory(
    commandsPath: string,
    stats: any,
    projectRoot: string,
    gitignorePatterns: string[]
  ): Promise<FileTreeNode> {
    const commandsStats =
      await ConsolidatedFileSystem.getFileStats(commandsPath);
    const commandsNode: FileTreeNode = {
      name: path.basename(commandsPath),
      path: commandsPath,
      type: 'directory',
      size: commandsStats.size,
      lastModified: commandsStats.lastModified,
    };

    stats.totalDirectories++;

    try {
      const entries = await ConsolidatedFileSystem.listDirectory(commandsPath);
      const children: FileTreeNode[] = [];

      for (const entry of entries) {
        const childPath = path.join(commandsPath, entry);

        try {
          const childStats =
            await ConsolidatedFileSystem.getFileStats(childPath);
          if (!childStats.exists) continue;

          if (childStats.isDirectory) {
            // Recursively build subdirectories in commands
            const childNode = await this.buildCommandsDirectory(
              childPath,
              stats,
              projectRoot,
              gitignorePatterns
            );
            children.push(childNode);
          } else if (childStats.isFile) {
            // Include all configuration files in commands directory
            const configCheck = FileSystemService.isConfigurationFile(
              entry,
              childPath
            );
            if (configCheck.valid) {
              const fileNode: FileTreeNode = {
                name: entry,
                path: childPath,
                type: 'file',
                size: childStats.size,
                lastModified: childStats.lastModified,
                fileType: configCheck.type || undefined,
                isInactive: entry.endsWith('.inactive'),
              };

              // Command files don't need content validation, just use the basic validity check
              fileNode.isValid = configCheck.valid;

              stats.totalFiles++;
              if (configCheck.type) {
                stats.configurationFiles[configCheck.type]++;
              }
              children.push(fileNode);
            }
          }
        } catch (_error) {
          logger.debug(`Skipping inaccessible path: ${childPath}`);
        }
      }

      // Sort children: directories first, then alphabetically
      children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      if (children.length > 0) {
        commandsNode.children = children;
      }
    } catch (_error) {
      logger.debug(`Cannot read commands directory ${commandsPath}: ${_error}`);
    }

    return commandsNode;
  }

  /**
   * Get default directory for the platform (cross-platform home directory detection)
   */
  async getDefaultDirectory(): Promise<DefaultDirectoryResult> {
    const platform = process.platform;
    const homeDir = os.homedir();
    
    try {
      let defaultDirectory = homeDir;
      let drives: string[] = [];

      if (platform === 'win32') {
        // On Windows, get available drives
        drives = await this.getWindowsDrives();
        
        // Default to user's home directory or Documents if it exists
        const documentsPath = path.join(homeDir, 'Documents');
        try {
          const documentsStats = await ConsolidatedFileSystem.getFileStats(documentsPath);
          if (documentsStats.exists && documentsStats.isDirectory) {
            defaultDirectory = documentsPath;
          }
        } catch (_error) {
          // If Documents doesn't exist, use home directory
          defaultDirectory = homeDir;
        }
      } else {
        // On macOS/Linux, check common directories
        const commonPaths = [
          path.join(homeDir, 'Documents'),
          path.join(homeDir, 'Desktop'),
          homeDir
        ];

        for (const testPath of commonPaths) {
          try {
            const stats = await ConsolidatedFileSystem.getFileStats(testPath);
            if (stats.exists && stats.isDirectory) {
              defaultDirectory = testPath;
              break;
            }
          } catch (_error) {
            // Continue to next path
            continue;
          }
        }
      }

      logger.debug(`Default directory for platform ${platform}: ${defaultDirectory}`);
      
      return {
        defaultDirectory,
        homeDirectory: homeDir,
        platform,
        drives: drives.length > 0 ? drives : undefined,
      };
    } catch (error: any) {
      logger.error(`Failed to get default directory: ${error.message}`);
      throw createError(`Failed to get default directory: ${error.message}`, 500);
    }
  }

  /**
   * Get available Windows drives
   */
  private async getWindowsDrives(): Promise<string[]> {
    if (process.platform !== 'win32') {
      return [];
    }

    try {
      // Common Windows drive letters
      const possibleDrives = ['C:', 'D:', 'E:', 'F:', 'G:', 'H:', 'I:', 'J:', 'K:', 'L:', 'M:', 'N:', 'O:', 'P:', 'Q:', 'R:', 'S:', 'T:', 'U:', 'V:', 'W:', 'X:', 'Y:', 'Z:'];
      const availableDrives: string[] = [];

      for (const drive of possibleDrives) {
        try {
          const driveRoot = drive + '\\';
          const stats = await ConsolidatedFileSystem.getFileStats(driveRoot);
          if (stats.exists && stats.isDirectory) {
            availableDrives.push(drive);
          }
        } catch (_error) {
          // Drive doesn't exist or is not accessible
          continue;
        }
      }

      return availableDrives;
    } catch (_error) {
      logger.debug('Failed to get Windows drives, returning empty array');
      return [];
    }
  }
}
