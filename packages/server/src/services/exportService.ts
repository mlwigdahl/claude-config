import { ConsolidatedFileSystem } from '@claude-config/core';
import * as path from 'path';
import * as os from 'os';
import archiver from 'archiver';
import { minimatch } from 'minimatch';
import { createError } from '../middleware/errorHandler.js';
import { getLogger } from '@claude-config/core';
import { FileSystemService } from './fileSystemService.js';
import type {
  ExportOptions,
  ExportResult,
  ExportFileEntry,
} from '@claude-config/shared';

const logger = getLogger('server-export');

export class ExportService {
  private static gitignoreCache: Map<string, string[]> = new Map();

  /**
   * Read and parse .gitignore file
   */
  private static async readGitignore(dirPath: string): Promise<string[]> {
    // Check cache first
    if (this.gitignoreCache.has(dirPath)) {
      return this.gitignoreCache.get(dirPath)!;
    }

    const gitignorePath = path.join(dirPath, '.gitignore');

    // Check if file exists before trying to read it
    const exists = await ConsolidatedFileSystem.fileExists(gitignorePath);
    if (!exists) {
      // No .gitignore file - cache empty patterns and return
      this.gitignoreCache.set(dirPath, []);
      return [];
    }

    try {
      const content = await ConsolidatedFileSystem.readFile(gitignorePath);
      const patterns = content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));

      this.gitignoreCache.set(dirPath, patterns);
      return patterns;
    } catch (_error) {
      // Error reading the file - treat as empty
      this.gitignoreCache.set(dirPath, []);
      return [];
    }
  }

  /**
   * Check if a path should be ignored based on gitignore patterns
   */
  private static isIgnored(
    filePath: string,
    projectRoot: string,
    gitignorePatterns: string[]
  ): boolean {
    const relativePath = path.relative(projectRoot, filePath);

    // Convert Windows paths to Unix-style for gitignore matching
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const filename = path.basename(filePath);

    // Special exception: never ignore .claude directories and their contents
    if (
      normalizedPath === '.claude' ||
      normalizedPath.startsWith('.claude/') ||
      normalizedPath.includes('/.claude/') ||
      filename === '.claude'
    ) {
      return false;
    }

    // Special exception: never ignore configuration files anywhere
    const configCheck = FileSystemService.isConfigurationFile(
      filename,
      filePath,
      false // Not home context
    );
    if (configCheck.valid) {
      return false;
    }

    return gitignorePatterns.some(pattern => {
      // Handle directory patterns (ending with /)
      if (pattern.endsWith('/')) {
        const dirPattern = pattern.slice(0, -1);
        return (
          normalizedPath === dirPattern ||
          normalizedPath.startsWith(dirPattern + '/')
        );
      }

      // Use minimatch for glob pattern matching
      return (
        minimatch(normalizedPath, pattern) ||
        minimatch(path.basename(filePath), pattern)
      );
    });
  }

  /**
   * Export project files based on the provided options
   */
  static async exportProject(
    projectPath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      // Normalize project path for cross-platform compatibility
      const normalizedProjectPath = projectPath.replace(/\\/g, '/');
      logger.info(`Starting export of project: ${normalizedProjectPath}`, {
        options,
      });

      // Validate project path exists
      if (!(await ConsolidatedFileSystem.directoryExists(projectPath))) {
        throw createError(`Project path not found: ${projectPath}`, 404);
      }

      // Read gitignore patterns and add default exclusions
      const gitignorePatterns = await this.readGitignore(normalizedProjectPath);
      const defaultExclusions = [
        'node_modules/',
        '.git/',
        'dist/',
        'build/',
        '.DS_Store',
        '*.log',
      ];

      // Always include default exclusions for common build artifacts
      const allPatterns = [
        ...new Set([...gitignorePatterns, ...defaultExclusions]),
      ];

      logger.info(
        `Using ${allPatterns.length} ignore patterns (${gitignorePatterns.length} from .gitignore, ${defaultExclusions.length} defaults)`
      );

      // Collect files to export from project
      const projectFiles = await this.collectFilesToExport(
        normalizedProjectPath,
        options,
        allPatterns
      );

      // Mark project files with source
      projectFiles.forEach(file => (file.source = 'project'));

      let allFiles = [...projectFiles];

      // If user path is requested, collect those files too
      if (options.includeUserPath) {
        const userFiles = await this.collectUserPathFiles(options);
        // Mark user files with source
        userFiles.forEach(file => (file.source = 'user'));
        allFiles = [...allFiles, ...userFiles];
      }

      // Filter by selected files if provided
      if (options.selectedFiles && options.selectedFiles.length > 0) {
        allFiles = allFiles.filter(file =>
          options.selectedFiles!.includes(file.sourcePath)
        );
      }

      if (allFiles.length === 0) {
        logger.warn('No files found to export', { projectPath, options });
        return {
          success: false,
          error: 'No files found matching export criteria',
          fileCount: 0,
        };
      }

      // Create archive
      const archiveData = await this.createArchive(allFiles, options);

      // Generate filename
      const projectName = path.basename(normalizedProjectPath);
      const timestamp = new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[:-]/g, '');
      const filename = `${projectName}-export-${timestamp}.zip`;

      logger.info(`Export completed successfully`, {
        projectPath: normalizedProjectPath,
        fileCount: allFiles.length,
        filename,
      });

      return {
        success: true,
        filename,
        data: archiveData,
        fileCount: allFiles.length,
      };
    } catch (error) {
      logger.error('Export failed', {
        projectPath,
        options,
        errorMessage: error instanceof Error ? error.message : String(error),
      } as any);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fileCount: 0,
      };
    }
  }

  /**
   * Collect all files that should be included in the export
   */
  private static async collectFilesToExport(
    projectPath: string,
    options: ExportOptions,
    gitignorePatterns: string[]
  ): Promise<ExportFileEntry[]> {
    const files: ExportFileEntry[] = [];
    const visitedDirs = new Set<string>();

    await this.collectFromDirectory(
      projectPath,
      projectPath,
      files,
      options,
      visitedDirs,
      gitignorePatterns
    );

    return files;
  }

  /**
   * Recursively collect files from a directory
   */
  private static async collectFromDirectory(
    currentDir: string,
    projectRoot: string,
    files: ExportFileEntry[],
    options: ExportOptions,
    visitedDirs: Set<string>,
    gitignorePatterns: string[],
    isUserPath: boolean = false
  ): Promise<void> {
    // Normalize current directory path for cross-platform compatibility
    const normalizedCurrentDir = currentDir.replace(/\\/g, '/');

    // Prevent infinite loops with symlinks - use the normalized directory as realpath
    const realPath = normalizedCurrentDir;
    if (visitedDirs.has(realPath)) {
      return;
    }
    visitedDirs.add(realPath);

    try {
      const entries = await ConsolidatedFileSystem.listDirectory(currentDir);

      for (const entry of entries) {
        // Normalize path for cross-platform compatibility
        const fullPath = path
          .join(normalizedCurrentDir, entry)
          .replace(/\\/g, '/');

        // Skip ignored files and directories
        const ignored = this.isIgnored(
          fullPath,
          projectRoot,
          gitignorePatterns
        );

        if (ignored) {
          continue;
        }

        const stats = await ConsolidatedFileSystem.getFileStats(fullPath);

        if (stats.isDirectory) {
          // Check if we're entering or already in a commands directory
          const normalizedFullPath = fullPath.replace(/\\/g, '/');
          const normalizedCurrentDir = currentDir.replace(/\\/g, '/');
          
          // Special handling for command directories - always recurse into them
          const isClaudeDir = entry === '.claude';
          
          // For project paths: check for .claude/commands
          // For user paths: check for just commands (since we start in .claude)
          const isEnteringCommandsDir = entry === 'commands' && 
            (normalizedCurrentDir.endsWith('/.claude') || isUserPath);
          
          const isInsideCommandsDir = normalizedCurrentDir.includes('/commands') && 
            (normalizedCurrentDir.includes('/.claude/commands') || isUserPath);
          
          // We should recurse if:
          // 1. This is a .claude directory (to look for commands inside)
          // 2. We're entering a commands directory (with commandFiles option enabled)
          // 3. We're already inside a commands directory
          // 4. OR the general recursive option is enabled
          const shouldAlwaysRecurse = isClaudeDir || 
            (options.commandFiles && (isEnteringCommandsDir || isInsideCommandsDir));
          
          if (shouldAlwaysRecurse || options.recursive) {
            await this.collectFromDirectory(
              fullPath,
              projectRoot,
              files,
              options,
              visitedDirs,
              gitignorePatterns,
              isUserPath
            );
          }
        } else if (stats.isFile) {
          // Check if file matches export criteria
          const fileEntry = await this.evaluateFileForExport(
            fullPath,
            projectRoot,
            options,
            isUserPath
          );
          if (fileEntry) {
            files.push(fileEntry);
          }
        }
      }
    } catch (error) {
      logger.debug(`Failed to read directory: ${currentDir}`, { error });
      // Continue with other directories rather than failing completely
    }
  }

  /**
   * Evaluate whether a file should be included in export
   */
  private static async evaluateFileForExport(
    filePath: string,
    projectRoot: string,
    options: ExportOptions,
    isUserPath: boolean = false
  ): Promise<ExportFileEntry | null> {
    const filename = path.basename(filePath);
    const isInactive = filename.endsWith('.inactive');
    const baseFilename = isInactive
      ? filename.replace('.inactive', '')
      : filename;

    // Skip inactive files if not requested
    if (isInactive && !options.includeInactive) {
      return null;
    }

    // Check file type and inclusion criteria
    // Use FileSystemService to properly identify file types with path context
    const configCheck = FileSystemService.isConfigurationFile(
      baseFilename,
      filePath,
      isUserPath // Use isUserPath to determine home context
    );

    if (!configCheck.valid || !configCheck.type) {
      // Not a configuration file
      return null;
    }

    let shouldInclude = false;
    let fileType: 'memory' | 'settings' | 'command' = configCheck.type;

    switch (configCheck.type) {
      case 'memory':
        if (options.memoryFiles === 'all') {
          shouldInclude = true;
        } else if (
          options.memoryFiles === 'claude-only' &&
          baseFilename === 'CLAUDE.md'
        ) {
          shouldInclude = true;
        }
        break;

      case 'settings':
        if (options.settingsFiles === 'both') {
          shouldInclude = true;
        } else if (
          options.settingsFiles === 'project-only' &&
          baseFilename === 'settings.json'
        ) {
          shouldInclude = true;
        }
        break;

      case 'command':
        shouldInclude = options.commandFiles;
        break;

      default:
        // Not a configuration file
        return null;
    }

    if (!shouldInclude) {
      return null;
    }

    // Calculate archive path (relative to project root)
    const relativePath = path.relative(projectRoot, filePath);

    return {
      sourcePath: filePath,
      archivePath: relativePath.replace(/\\/g, '/'), // Use forward slashes in archive
      type: fileType,
      isInactive,
      source: 'project', // Default to project, will be overridden as needed
    };
  }

  /**
   * Collect files from user's .claude directory
   */
  private static async collectUserPathFiles(
    options: ExportOptions
  ): Promise<ExportFileEntry[]> {
    const files: ExportFileEntry[] = [];
    const userClaudePath = path.join(os.homedir(), '.claude');

    // Check if user .claude directory exists
    if (!(await ConsolidatedFileSystem.directoryExists(userClaudePath))) {
      logger.info('User .claude directory does not exist');
      return files;
    }

    const visitedDirs = new Set<string>();

    // For user path, we don't use gitignore patterns
    // Pass the home directory as projectRoot to preserve .claude in the relative path
    await this.collectFromDirectory(
      userClaudePath,
      os.homedir(),
      files,
      options,
      visitedDirs,
      [], // No gitignore patterns for user path
      true // isUserPath - this is user configuration directory
    );

    return files;
  }

  /**
   * Create ZIP archive from collected files
   */
  private static async createArchive(
    files: ExportFileEntry[],
    _options: ExportOptions
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Maximum compression
      });

      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      archive.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });

      archive.on('error', (error: Error) => {
        logger.error('Archive creation failed', {
          errorMessage: error.message,
        } as any);
        reject(error);
      });

      // Add files to archive asynchronously
      Promise.all(
        files.map(async file => {
          try {
            const content = await ConsolidatedFileSystem.readFile(
              file.sourcePath
            );

            // Prefix the archive path based on source
            const prefixedPath =
              file.source === 'user'
                ? `user/${file.archivePath}`
                : `project/${file.archivePath}`;

            archive.append(content, { name: prefixedPath });
          } catch (error) {
            logger.warn(`Failed to add file to archive: ${file.sourcePath}`, {
              error,
            });
            // Continue with other files rather than failing completely
          }
        })
      )
        .then(() => {
          archive.finalize();
        })
        .catch(error => {
          logger.error('Failed to add files to archive', {
            errorMessage:
              error instanceof Error ? error.message : String(error),
          } as any);
          reject(error);
        });
    });
  }

  /**
   * Get default export options
   */
  static getDefaultOptions(): ExportOptions {
    return {
      memoryFiles: 'all',
      settingsFiles: 'both',
      commandFiles: true,
      includeInactive: false,
      recursive: true,
      format: 'zip',
      includeUserPath: false,
    };
  }

  /**
   * Validate export options
   */
  static validateOptions(options: Partial<ExportOptions>): ExportOptions {
    return {
      memoryFiles: options.memoryFiles || 'all',
      settingsFiles: options.settingsFiles || 'both',
      commandFiles: options.commandFiles ?? true,
      includeInactive: options.includeInactive ?? false,
      recursive: options.recursive ?? true,
      format: options.format || 'zip',
      includeUserPath: options.includeUserPath ?? false,
      selectedFiles: options.selectedFiles,
    };
  }
}
