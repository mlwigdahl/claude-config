/**
 * Settings file discovery and hierarchy resolution
 */

// import * as path from 'path';
import { promises as fs } from 'fs';
import {
  SettingsConfig,
  SettingsFileInfo,
  SettingsFileType,
  SettingsHierarchyResolution,
  SettingsConflict,
} from '../types/settings.js';
import { readJsonFile } from '../utils/json-file.js';
import { getLogger } from '../utils/logger.js';
import { getStandardSettingsPaths } from './validation.js';

const logger = getLogger('settings-discovery');

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
 * Discovers all settings files in the hierarchy
 */
export async function discoverSettingsFiles(
  projectRoot: string
): Promise<SettingsFileInfo[]> {
  logger.debug(`Discovering settings files for project: ${projectRoot}`);

  const settingsPaths = getStandardSettingsPaths(projectRoot);
  const discoveredFiles: SettingsFileInfo[] = [];

  // Define precedence order (higher number = higher precedence)
  // According to Claude Code docs: Enterprise > Command line > Local project > Shared project > User
  const precedenceMap: Record<SettingsFileType, number> = {
    [SettingsFileType.ENTERPRISE]: 5,
    [SettingsFileType.COMMAND_LINE]: 4,
    [SettingsFileType.PROJECT_LOCAL]: 3,
    [SettingsFileType.PROJECT_SHARED]: 2,
    [SettingsFileType.USER]: 1,
  };

  // Check each potential settings file
  for (const [type, filePath] of Object.entries(settingsPaths)) {
    const fileType = type as SettingsFileType;

    // Handle enterprise and command line as non-existent for now (would need special handling)
    if (
      fileType === SettingsFileType.ENTERPRISE ||
      fileType === SettingsFileType.COMMAND_LINE
    ) {
      discoveredFiles.push({
        type: fileType,
        path: filePath,
        content: undefined,
        precedence: precedenceMap[fileType],
        exists: false,
        isActive: false,
      });
      continue;
    }

    try {
      await fs.access(filePath);

      // File exists, try to read it
      let content: SettingsConfig | undefined;
      try {
        content = await readJsonFile<SettingsConfig>(filePath);
      } catch (error: unknown) {
        // Only log parsing warnings in non-test environments to reduce test noise
        if (!isTestEnvironment()) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.warn(
            `Failed to read settings file ${filePath}: ${errorMessage}`
          );
        }
      }

      discoveredFiles.push({
        path: filePath,
        type: fileType,
        exists: true,
        content,
        precedence: precedenceMap[fileType],
        isActive: true, // Will be updated during hierarchy resolution
      });
    } catch {
      // File doesn't exist
      discoveredFiles.push({
        path: filePath,
        type: fileType,
        exists: false,
        precedence: precedenceMap[fileType],
        isActive: false,
      });
    }
  }

  // Sort by precedence (highest first)
  discoveredFiles.sort((a, b) => b.precedence - a.precedence);

  // Update isActive and overriddenBy based on precedence
  for (let i = 0; i < discoveredFiles.length; i++) {
    const current = discoveredFiles[i];

    if (!current.exists || !current.content) {
      current.isActive = false;
      continue;
    }

    // Check if any higher precedence file overrides this one
    const overriddenBy: string[] = [];
    for (let j = 0; j < i; j++) {
      const higher = discoveredFiles[j];
      if (higher.exists && higher.content) {
        overriddenBy.push(higher.path);
      }
    }

    if (overriddenBy.length > 0) {
      current.overriddenBy = overriddenBy;
      // File is still active, but some settings may be overridden
    }
  }

  logger.debug(
    `Discovered ${discoveredFiles.filter(f => f.exists).length} settings files`
  );
  return discoveredFiles;
}

/**
 * Resolves the effective settings by merging the hierarchy
 */
export async function resolveSettingsHierarchy(
  projectRoot: string
): Promise<SettingsHierarchyResolution> {
  logger.debug('Resolving settings hierarchy');

  const files = await discoverSettingsFiles(projectRoot);
  const existingFiles = files.filter(f => f.exists && f.content);

  if (existingFiles.length === 0) {
    return {
      effectiveSettings: {},
      sourceFiles: files,
      conflicts: [],
    };
  }

  // Start with lowest precedence and merge upwards
  let effectiveSettings: SettingsConfig = {};
  const conflicts: SettingsConflict[] = [];
  const mergeHistory = new Map<
    string,
    Array<{ value: any; source: string; precedence: number }>
  >();

  // Reverse to start with lowest precedence
  const filesToMerge = [...existingFiles].reverse();

  for (const file of filesToMerge) {
    if (!file.content) continue;

    // Track conflicts for each top-level key
    for (const [key, value] of Object.entries(file.content)) {
      if (key in effectiveSettings) {
        // Track the conflict
        if (!mergeHistory.has(key)) {
          mergeHistory.set(key, []);
        }

        const history = mergeHistory.get(key)!;

        // Add previous value if this is the first conflict for this key
        if (history.length === 0) {
          const prevFile = filesToMerge.find(
            f => f.precedence < file.precedence && f.content && key in f.content
          );
          if (prevFile) {
            history.push({
              value: (effectiveSettings as any)[key],
              source: prevFile.path,
              precedence: prevFile.precedence,
            });
          }
        }

        // Add current value
        history.push({
          value,
          source: file.path,
          precedence: file.precedence,
        });
      }

      // Apply the setting (higher precedence wins)
      if (key === 'env' || key === 'permissions' || key === 'hooks') {
        // For objects, we might want to merge rather than replace
        if (
          typeof value === 'object' &&
          typeof effectiveSettings[key as keyof SettingsConfig] === 'object'
        ) {
          effectiveSettings = {
            ...effectiveSettings,
            [key]: mergeSettingsObjects(
              effectiveSettings[key as keyof SettingsConfig] as any,
              value
            ),
          };
        } else {
          effectiveSettings = { ...effectiveSettings, [key]: value };
        }
      } else {
        // Simple replacement for other fields
        effectiveSettings = { ...effectiveSettings, [key]: value };
      }
    }
  }

  // Convert merge history to conflicts
  for (const [key, history] of mergeHistory.entries()) {
    if (history.length > 1) {
      conflicts.push({
        key,
        values: history,
        resolved: (effectiveSettings as any)[key],
      });
    }
  }

  logger.debug(`Resolved settings with ${conflicts.length} conflicts`);
  return {
    effectiveSettings,
    sourceFiles: files,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  };
}

/**
 * Merges two settings objects with special handling for certain fields
 */
function mergeSettingsObjects(target: any, source: any): any {
  if (!target || !source) {
    return source || target;
  }

  const result = { ...target };

  for (const [key, value] of Object.entries(source)) {
    if (key === 'allow' || key === 'deny') {
      // For permission arrays, concatenate and deduplicate
      if (Array.isArray(target[key]) && Array.isArray(value)) {
        result[key] = [...new Set([...target[key], ...value])];
      } else {
        result[key] = value;
      }
    } else if (key === 'PreToolUse' || key === 'PostToolUse') {
      // For hook event arrays, concatenate them
      if (Array.isArray(target[key]) && Array.isArray(value)) {
        result[key] = [...target[key], ...value];
      } else if (Array.isArray(value)) {
        result[key] = value;
      } else if (Array.isArray(target[key])) {
        result[key] = target[key];
      } else {
        result[key] = value;
      }
    } else if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value !== null
    ) {
      // Recursively merge objects
      result[key] = mergeSettingsObjects(target[key], value);
    } else {
      // Simple replacement
      result[key] = value;
    }
  }

  return result;
}

/**
 * Finds which settings file provides a specific configuration key
 */
export async function findSettingSource(
  projectRoot: string,
  settingKey: string
): Promise<SettingsFileInfo | undefined> {
  const resolution = await resolveSettingsHierarchy(projectRoot);

  // Check files in precedence order
  const sortedFiles = resolution.sourceFiles
    .filter(f => f.exists && f.content)
    .sort((a, b) => b.precedence - a.precedence);

  for (const file of sortedFiles) {
    if (file.content && settingKey in file.content) {
      return file;
    }
  }

  return undefined;
}

/**
 * Gets active settings files (those that contribute to the effective configuration)
 */
export async function getActiveSettingsFiles(
  projectRoot: string
): Promise<SettingsFileInfo[]> {
  const files = await discoverSettingsFiles(projectRoot);
  return files.filter(f => f.exists && f.isActive);
}
