/**
 * Core CRUD operations for settings files
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import {
  SettingsConfig,
  SettingsFileType,
  SettingsOperationResult,
  SettingsOperationOptions,
} from '../types/settings.js';
import { ErrorCode, ApplicationError } from '../utils/error-handling.js';
import {
  readJsonFile,
  writeJsonFile,
  updateJsonFile,
  validateSettingsSchema,
} from '../utils/json-file.js';
import { getLogger } from '../utils/logger.js';
import { validateSettingsPath, getSettingsFileType } from './validation.js';

const logger = getLogger('settings-operations');

/**
 * Creates a new settings file with the provided configuration
 */
export async function createSettingsFile(
  projectRoot: string,
  targetPath: string,
  settings: SettingsConfig,
  options: SettingsOperationOptions = {}
): Promise<SettingsOperationResult> {
  logger.info(`Creating settings file: ${targetPath}`);

  try {
    // Validate the target path
    const pathValidation = await validateSettingsPath(projectRoot, targetPath);
    if (!pathValidation.valid) {
      return {
        success: false,
        message: pathValidation.message || 'Invalid settings path',
        error: new ApplicationError({
          code: ErrorCode.INVALID_PATH,
          message: pathValidation.message || 'Invalid settings path',
          context: pathValidation.details,
        }),
      };
    }

    // Validate settings content
    const schemaValidation = validateSettingsSchema(settings);
    if (!schemaValidation.valid) {
      return {
        success: false,
        message: 'Invalid settings format',
        error: new ApplicationError({
          code: ErrorCode.SCHEMA_VALIDATION_ERROR,
          message: 'Settings do not match required schema',
          context: schemaValidation.errors || {},
        }),
      };
    }

    // Check if file already exists
    try {
      await fs.access(targetPath);
      if (!options.force) {
        return {
          success: false,
          message: `Settings file already exists: ${targetPath}`,
          error: new ApplicationError({
            code: ErrorCode.FILE_ALREADY_EXISTS,
            message: `Settings file already exists: ${targetPath}`,
            context: { path: targetPath },
          }),
        };
      }
    } catch {
      // File doesn't exist, which is what we want
    }

    // Perform dry run if requested
    if (options.dryRun) {
      return {
        success: true,
        message: `[DRY RUN] Would create settings file: ${targetPath}`,
        filePath: targetPath,
        settings,
      };
    }

    // Write the settings file
    await writeJsonFile(targetPath, settings, {
      createBackup: options.backup,
      prettyPrint: true,
    });

    logger.info(`Successfully created settings file: ${targetPath}`);
    return {
      success: true,
      message: `Created settings file: ${targetPath}`,
      filePath: targetPath,
      settings,
    };
  } catch (error: any) {
    logger.error(`Failed to create settings file: ${error.message}`);
    return {
      success: false,
      message: `Failed to create settings file: ${error.message}`,
      error: new ApplicationError({
        code: error.code || ErrorCode.OPERATION_FAILED,
        message: error.message,
        context: error.context || {},
      }),
    };
  }
}

/**
 * Updates an existing settings file with new configuration
 */
export async function updateSettingsFile(
  projectRoot: string,
  targetPath: string,
  settings: Partial<SettingsConfig>,
  options: SettingsOperationOptions = {}
): Promise<SettingsOperationResult> {
  logger.info(`Updating settings file: ${targetPath}`);

  try {
    // Validate the target path
    const pathValidation = await validateSettingsPath(projectRoot, targetPath);
    if (!pathValidation.valid) {
      return {
        success: false,
        message: pathValidation.message || 'Invalid settings path',
        error: new ApplicationError({
          code: ErrorCode.INVALID_PATH,
          message: pathValidation.message || 'Invalid settings path',
          context: pathValidation.details,
        }),
      };
    }

    // Check if file exists
    try {
      await fs.access(targetPath);
    } catch {
      return {
        success: false,
        message: `Settings file not found: ${targetPath}`,
        error: new ApplicationError({
          code: ErrorCode.FILE_NOT_FOUND,
          message: `Settings file not found: ${targetPath}`,
          context: { path: targetPath },
        }),
      };
    }

    // Read existing settings
    const existingSettings = await readJsonFile<SettingsConfig>(targetPath);

    // Merge settings based on strategy
    let mergedSettings: SettingsConfig;
    if (options.mergeStrategy === 'replace') {
      mergedSettings = settings as SettingsConfig;
    } else if (options.mergeStrategy === 'deep-merge') {
      mergedSettings = await updateJsonFile(targetPath, settings, {
        mergeArrays: true,
        createBackup: options.backup,
      });
    } else {
      // Default 'merge' strategy
      mergedSettings = { ...existingSettings, ...settings };
    }

    // Validate merged settings
    const schemaValidation = validateSettingsSchema(mergedSettings);
    if (!schemaValidation.valid) {
      return {
        success: false,
        message: 'Invalid settings format after merge',
        error: new ApplicationError({
          code: ErrorCode.SCHEMA_VALIDATION_ERROR,
          message: 'Merged settings do not match required schema',
          context: schemaValidation.errors || {},
        }),
      };
    }

    // Perform dry run if requested
    if (options.dryRun) {
      return {
        success: true,
        message: `[DRY RUN] Would update settings file: ${targetPath}`,
        filePath: targetPath,
        settings: mergedSettings,
      };
    }

    // Write the merged settings
    if (options.mergeStrategy !== 'deep-merge') {
      await writeJsonFile(targetPath, mergedSettings, {
        createBackup: options.backup,
        prettyPrint: true,
      });
    }

    logger.info(`Successfully updated settings file: ${targetPath}`);
    return {
      success: true,
      message: `Updated settings file: ${targetPath}`,
      filePath: targetPath,
      settings: mergedSettings,
    };
  } catch (error: any) {
    logger.error(`Failed to update settings file: ${error.message}`);
    return {
      success: false,
      message: `Failed to update settings file: ${error.message}`,
      error: new ApplicationError({
        code: error.code || ErrorCode.OPERATION_FAILED,
        message: error.message,
        context: error.context || {},
      }),
    };
  }
}

/**
 * Moves a settings file to a new location
 */
export async function moveSettingsFile(
  projectRoot: string,
  sourcePath: string,
  targetPath: string,
  options: SettingsOperationOptions = {}
): Promise<SettingsOperationResult> {
  logger.info(`Moving settings file from ${sourcePath} to ${targetPath}`);

  try {
    // Validate both paths
    const sourceValidation = await validateSettingsPath(
      projectRoot,
      sourcePath
    );
    if (!sourceValidation.valid) {
      return {
        success: false,
        message: `Invalid source path: ${sourceValidation.message}`,
        error: new ApplicationError({
          code: ErrorCode.INVALID_PATH,
          message: sourceValidation.message || 'Invalid source path',
          context: sourceValidation.details,
        }),
      };
    }

    const targetValidation = await validateSettingsPath(
      projectRoot,
      targetPath
    );
    if (!targetValidation.valid) {
      return {
        success: false,
        message: `Invalid target path: ${targetValidation.message}`,
        error: new ApplicationError({
          code: ErrorCode.INVALID_PATH,
          message: targetValidation.message || 'Invalid target path',
          context: targetValidation.details,
        }),
      };
    }

    // Check if source exists
    try {
      await fs.access(sourcePath);
    } catch {
      return {
        success: false,
        message: `Source settings file not found: ${sourcePath}`,
        error: new ApplicationError({
          code: ErrorCode.FILE_NOT_FOUND,
          message: `Source settings file not found: ${sourcePath}`,
          context: { path: sourcePath },
        }),
      };
    }

    // Check if target already exists
    try {
      await fs.access(targetPath);
      if (!options.force) {
        return {
          success: false,
          message: `Target settings file already exists: ${targetPath}`,
          error: new ApplicationError({
            code: ErrorCode.FILE_ALREADY_EXISTS,
            message: `Target settings file already exists: ${targetPath}`,
            context: { path: targetPath },
          }),
        };
      }
    } catch {
      // Target doesn't exist, which is fine
    }

    // Read the source settings
    const settings = await readJsonFile<SettingsConfig>(sourcePath);

    // Perform dry run if requested
    if (options.dryRun) {
      return {
        success: true,
        message: `[DRY RUN] Would move settings file from ${sourcePath} to ${targetPath}`,
        filePath: targetPath,
        settings,
      };
    }

    // Create backup if requested
    if (options.backup) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${sourcePath}.backup.${timestamp}`;
      await fs.copyFile(sourcePath, backupPath);
      logger.debug(`Created backup: ${backupPath}`);
    }

    // Ensure target directory exists
    const targetDir = path.dirname(targetPath);
    await fs.mkdir(targetDir, { recursive: true });

    // Move the file
    await fs.rename(sourcePath, targetPath);

    logger.info(
      `Successfully moved settings file from ${sourcePath} to ${targetPath}`
    );
    return {
      success: true,
      message: `Moved settings file from ${sourcePath} to ${targetPath}`,
      filePath: targetPath,
      settings,
      warnings: [
        'Note: Moving settings between different scopes (user/project) may affect precedence',
      ],
    };
  } catch (error: any) {
    logger.error(`Failed to move settings file: ${error.message}`);
    return {
      success: false,
      message: `Failed to move settings file: ${error.message}`,
      error: new ApplicationError({
        code: error.code || ErrorCode.OPERATION_FAILED,
        message: error.message,
        context: error.context || {},
      }),
    };
  }
}

/**
 * Deletes a settings file
 */
export async function deleteSettingsFile(
  projectRoot: string,
  targetPath: string,
  options: SettingsOperationOptions = {}
): Promise<SettingsOperationResult> {
  logger.info(`Deleting settings file: ${targetPath}`);

  try {
    // Validate the target path
    const pathValidation = await validateSettingsPath(projectRoot, targetPath);
    if (!pathValidation.valid) {
      return {
        success: false,
        message: pathValidation.message || 'Invalid settings path',
        error: new ApplicationError({
          code: ErrorCode.INVALID_PATH,
          message: pathValidation.message || 'Invalid settings path',
          context: pathValidation.details,
        }),
      };
    }

    // Check if file exists
    let settings: SettingsConfig | undefined;
    try {
      settings = await readJsonFile<SettingsConfig>(targetPath);
    } catch (error: any) {
      if (error.code === ErrorCode.FILE_NOT_FOUND) {
        return {
          success: false,
          message: `Settings file not found: ${targetPath}`,
          error: new ApplicationError({
            code: ErrorCode.FILE_NOT_FOUND,
            message: `Settings file not found: ${targetPath}`,
            context: { path: targetPath },
          }),
        };
      }
      throw error;
    }

    // Get file type for warnings
    const fileType = getSettingsFileType(targetPath);
    const warnings: string[] = [];

    if (fileType === SettingsFileType.USER) {
      warnings.push('Warning: Deleting user settings will affect all projects');
    } else if (fileType === SettingsFileType.PROJECT_SHARED) {
      warnings.push(
        'Warning: Deleting shared project settings will affect all team members'
      );
    }

    // Perform dry run if requested
    if (options.dryRun) {
      return {
        success: true,
        message: `[DRY RUN] Would delete settings file: ${targetPath}`,
        filePath: targetPath,
        settings,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // Create backup if requested
    if (options.backup) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${targetPath}.backup.${timestamp}`;
      await fs.copyFile(targetPath, backupPath);
      logger.debug(`Created backup: ${backupPath}`);
      warnings.push(`Backup created: ${backupPath}`);
    }

    // Delete the file
    await fs.unlink(targetPath);

    logger.info(`Successfully deleted settings file: ${targetPath}`);
    return {
      success: true,
      message: `Deleted settings file: ${targetPath}`,
      filePath: targetPath,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error: any) {
    logger.error(`Failed to delete settings file: ${error.message}`);
    return {
      success: false,
      message: `Failed to delete settings file: ${error.message}`,
      error: new ApplicationError({
        code: error.code || ErrorCode.OPERATION_FAILED,
        message: error.message,
        context: error.context || {},
      }),
    };
  }
}
