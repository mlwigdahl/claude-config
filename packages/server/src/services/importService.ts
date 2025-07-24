import { ConsolidatedFileSystem } from '@claude-config/core';
import * as path from 'path';
import * as os from 'os';
import yauzl from 'yauzl';
import { createError } from '../middleware/errorHandler.js';
import { getLogger } from '@claude-config/core';
import { ConfigurationServiceAPI } from './configurationService.js';
import type {
  ImportFileEntry,
  ImportConflict,
  ImportPreviewResult,
  ImportOptions,
  ImportResult,
} from '@claude-config/shared';

const logger = getLogger('server-import');

export class ImportService {
  /**
   * Preview import from archive without actually importing files
   */
  static async previewImport(
    archiveBuffer: Buffer,
    targetPath: string
  ): Promise<ImportPreviewResult> {
    try {
      logger.info(`Starting import preview for target: ${targetPath}`);

      // Validate target path exists
      if (!(await ConsolidatedFileSystem.directoryExists(targetPath))) {
        throw createError(`Target path not found: ${targetPath}`, 404);
      }

      // Extract and analyze files from archive
      const filesToImport = await this.extractArchiveContents(
        archiveBuffer,
        targetPath
      );

      if (filesToImport.length === 0) {
        return {
          success: false,
          totalFiles: 0,
          conflicts: [],
          filesToImport: [],
          error: 'No valid configuration files found in archive',
        };
      }

      // Check for conflicts
      const conflicts = await this.detectConflicts(filesToImport);

      logger.info(`Import preview completed`, {
        targetPath,
        totalFiles: filesToImport.length,
        conflicts: conflicts.length,
      });

      return {
        success: true,
        totalFiles: filesToImport.length,
        conflicts,
        filesToImport,
      };
    } catch (error) {
      logger.error('Import preview failed', {
        targetPath,
        errorMessage: error instanceof Error ? error.message : String(error),
      } as any);
      return {
        success: false,
        totalFiles: 0,
        conflicts: [],
        filesToImport: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Import files from archive with conflict resolution
   */
  static async importProject(
    archiveBuffer: Buffer,
    targetPath: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    try {
      logger.info(`Starting import to target: ${targetPath}`, { options });

      // First, preview to get files and conflicts
      const preview = await this.previewImport(archiveBuffer, targetPath);

      if (!preview.success) {
        return {
          success: false,
          filesImported: 0,
          filesSkipped: 0,
          conflicts: [],
          error: preview.error,
        };
      }

      // Filter files based on options
      let filesToProcess = preview.filesToImport;
      
      // Filter out user files if not requested
      if (!options.includeUserPath) {
        filesToProcess = filesToProcess.filter(file => file.source !== 'user');
      }
      
      // Filter by selected files if provided
      if (options.selectedFiles && options.selectedFiles.length > 0) {
        filesToProcess = filesToProcess.filter(file => 
          options.selectedFiles!.includes(file.archivePath)
        );
      }

      let filesImported = 0;
      let filesSkipped = 0;
      const remainingConflicts: ImportConflict[] = [];

      // Process each file
      for (const fileEntry of filesToProcess) {
        const hasConflict = preview.conflicts.some(
          (c: ImportConflict) => c.targetPath === fileEntry.targetPath
        );

        if (hasConflict && !options.overwriteConflicts) {
          // Skip conflicting files if not overwriting
          filesSkipped++;
          const conflict = preview.conflicts.find(
            (c: ImportConflict) => c.targetPath === fileEntry.targetPath
          )!;
          remainingConflicts.push(conflict);
          logger.debug(`Skipping conflicting file: ${fileEntry.targetPath}`);
          continue;
        }

        try {
          // Ensure target directory exists
          const targetDir = path.dirname(fileEntry.targetPath);
          await ConsolidatedFileSystem.ensureDirectory(targetDir);

          // Write the file
          await ConsolidatedFileSystem.writeFile(
            fileEntry.targetPath,
            fileEntry.content
          );
          filesImported++;
          logger.debug(`Imported file: ${fileEntry.targetPath}`);
        } catch (fileError) {
          logger.warn(`Failed to import file: ${fileEntry.targetPath}`, {
            fileError,
          });
          filesSkipped++;
        }
      }

      logger.info(`Import completed`, {
        targetPath,
        filesImported,
        filesSkipped,
        remainingConflicts: remainingConflicts.length,
      });

      return {
        success: true,
        filesImported,
        filesSkipped,
        conflicts: remainingConflicts,
      };
    } catch (error) {
      logger.error('Import failed', {
        targetPath,
        options,
        errorMessage: error instanceof Error ? error.message : String(error),
      } as any);
      return {
        success: false,
        filesImported: 0,
        filesSkipped: 0,
        conflicts: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Extract contents from ZIP archive
   */
  private static async extractArchiveContents(
    archiveBuffer: Buffer,
    targetPath: string
  ): Promise<ImportFileEntry[]> {
    return new Promise((resolve, reject) => {
      const files: ImportFileEntry[] = [];

      yauzl.fromBuffer(archiveBuffer, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          reject(new Error(`Failed to read archive: ${err.message}`));
          return;
        }

        if (!zipfile) {
          reject(new Error('Invalid archive file'));
          return;
        }

        zipfile.readEntry();

        zipfile.on('entry', async entry => {
          // Skip directories
          if (entry.fileName.endsWith('/')) {
            zipfile.readEntry();
            return;
          }

          try {
            // Get file content
            const content = await this.readZipEntry(zipfile, entry);

            // Analyze file to see if it's a configuration file
            const filename = path.basename(entry.fileName);
            const isInactive = filename.endsWith('.inactive');
            const baseFilename = isInactive
              ? filename.replace('.inactive', '')
              : filename;

            const configCheck =
              ConfigurationServiceAPI.getFileConfigurationType(baseFilename);

            if (configCheck?.type) {
              // Normalize path separators
              const normalizedArchivePath = entry.fileName.replace(/\\/g, '/');
              
              // Determine source and relative path
              let source: 'project' | 'user' = 'project';
              let relativePath = normalizedArchivePath;
              
              if (normalizedArchivePath.startsWith('user/')) {
                source = 'user';
                relativePath = normalizedArchivePath.substring(5); // Remove 'user/' prefix
              } else if (normalizedArchivePath.startsWith('project/')) {
                source = 'project';
                relativePath = normalizedArchivePath.substring(8); // Remove 'project/' prefix
              }
              
              // Calculate target path based on source
              let targetFilePath: string;
              if (source === 'user') {
                // User files go to the user's home directory
                const userClaudePath = path.join(os.homedir(), '.claude');
                targetFilePath = path.resolve(userClaudePath, relativePath);
              } else {
                // Project files go to the specified target path
                targetFilePath = path.resolve(targetPath, relativePath);
              }

              const fileEntry: ImportFileEntry = {
                archivePath: entry.fileName,
                targetPath: targetFilePath,
                content: content.toString('utf8'),
                type: configCheck.type as 'memory' | 'settings' | 'command',
                isInactive,
                size: content.length,
                source,
              };

              files.push(fileEntry);
            }
          } catch (entryError) {
            logger.warn(`Failed to process archive entry: ${entry.fileName}`, {
              entryError,
            });
          }

          zipfile.readEntry();
        });

        zipfile.on('end', () => {
          resolve(files);
        });

        zipfile.on('error', error => {
          reject(new Error(`Archive processing failed: ${error.message}`));
        });
      });
    });
  }

  /**
   * Read content from a ZIP entry
   */
  private static async readZipEntry(
    zipfile: yauzl.ZipFile,
    entry: yauzl.Entry
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zipfile.openReadStream(entry, (err, readStream) => {
        if (err) {
          reject(err);
          return;
        }

        if (!readStream) {
          reject(new Error('Failed to create read stream'));
          return;
        }

        const chunks: Buffer[] = [];

        readStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        readStream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        readStream.on('error', error => {
          reject(error);
        });
      });
    });
  }

  /**
   * Detect conflicts between archive files and existing files
   */
  private static async detectConflicts(
    filesToImport: ImportFileEntry[]
  ): Promise<ImportConflict[]> {
    const conflicts: ImportConflict[] = [];

    for (const fileEntry of filesToImport) {
      try {
        // Check if file exists
        if (await ConsolidatedFileSystem.fileExists(fileEntry.targetPath)) {
          const stats = await ConsolidatedFileSystem.getFileStats(
            fileEntry.targetPath
          );

          const conflict: ImportConflict = {
            archivePath: fileEntry.archivePath,
            targetPath: fileEntry.targetPath,
            existingSize: stats.size || 0,
            newSize: fileEntry.size,
            existingModified: stats.lastModified || new Date(0),
            type: fileEntry.type,
            isInactive: fileEntry.isInactive,
            source: fileEntry.source,
          };

          conflicts.push(conflict);
        }
      } catch (error) {
        // If we can't stat the file, assume no conflict
        logger.debug(`Could not check for conflict: ${fileEntry.targetPath}`, {
          error,
        });
      }
    }

    return conflicts;
  }

  /**
   * Get default import options
   */
  static getDefaultOptions(): ImportOptions {
    return {
      overwriteConflicts: false,
      preserveDirectoryStructure: true,
      includeUserPath: false,
    };
  }

  /**
   * Validate import options
   */
  static validateOptions(options: Partial<ImportOptions>): ImportOptions {
    return {
      overwriteConflicts: options.overwriteConflicts ?? false,
      preserveDirectoryStructure: options.preserveDirectoryStructure ?? true,
      includeUserPath: options.includeUserPath ?? false,
      selectedFiles: options.selectedFiles,
    };
  }
}
