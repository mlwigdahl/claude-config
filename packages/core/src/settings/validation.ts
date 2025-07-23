/**
 * Validation utilities for settings file operations
 */

import * as path from 'path';
import * as os from 'os';
import { SettingsFileType } from '../types/settings.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('settings-validation');

/**
 * Simplified validation for settings file content
 * Used by the configuration core service
 */
export function validateSettings(content: string): {
  valid: boolean;
  errors: string[];
  warnings?: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if content is empty
  if (!content || content.trim().length === 0) {
    errors.push('Settings file cannot be empty');
    return { valid: false, errors, warnings };
  }

  // Try to parse as JSON
  try {
    const settings = JSON.parse(content);

    // Basic validation of settings structure
    if (typeof settings !== 'object' || settings === null) {
      errors.push('Settings must be a JSON object');
      return { valid: false, errors, warnings };
    }

    // Validate permissions structure if present
    if (settings.permissions) {
      if (typeof settings.permissions !== 'object') {
        errors.push('permissions must be an object');
      } else {
        if (
          settings.permissions.allow &&
          !Array.isArray(settings.permissions.allow)
        ) {
          errors.push('permissions.allow must be an array');
        }
        if (
          settings.permissions.deny &&
          !Array.isArray(settings.permissions.deny)
        ) {
          errors.push('permissions.deny must be an array');
        }
      }
    }

    // Validate hooks structure if present
    if (settings.hooks) {
      if (typeof settings.hooks !== 'object') {
        errors.push('hooks must be an object');
      } else {
        const validEvents = [
          'PreToolUse',
          'PostToolUse',
          'UserPromptSubmit',
          'Notification',
          'Stop',
          'SubagentStop',
          'PreCompact',
        ];

        for (const [eventName, matchers] of Object.entries(settings.hooks)) {
          // Validate event name
          if (!validEvents.includes(eventName)) {
            warnings.push(
              `Unknown hook event "${eventName}". Valid events: ${validEvents.join(', ')}`
            );
          }

          // Validate matchers array
          if (!Array.isArray(matchers)) {
            errors.push(`hooks.${eventName} must be an array`);
            continue;
          }

          // Validate each matcher
          for (let i = 0; i < matchers.length; i++) {
            const matcher = matchers[i];

            if (typeof matcher !== 'object' || matcher === null) {
              errors.push(`hooks.${eventName}[${i}] must be an object`);
              continue;
            }

            // Validate matcher property
            if (typeof matcher.matcher !== 'string') {
              errors.push(`hooks.${eventName}[${i}].matcher must be a string`);
            }

            // Validate hooks array
            if (!Array.isArray(matcher.hooks)) {
              errors.push(`hooks.${eventName}[${i}].hooks must be an array`);
              continue;
            }

            // Validate individual hook definitions
            for (let j = 0; j < matcher.hooks.length; j++) {
              const hookDef = matcher.hooks[j];

              if (typeof hookDef !== 'object' || hookDef === null) {
                errors.push(
                  `hooks.${eventName}[${i}].hooks[${j}] must be an object`
                );
                continue;
              }

              if (hookDef.type !== 'command') {
                errors.push(
                  `hooks.${eventName}[${i}].hooks[${j}].type must be 'command'`
                );
              }

              if (
                typeof hookDef.command !== 'string' ||
                hookDef.command.length === 0
              ) {
                errors.push(
                  `hooks.${eventName}[${i}].hooks[${j}].command must be a non-empty string`
                );
              }

              if (
                hookDef.timeout !== undefined &&
                (typeof hookDef.timeout !== 'number' || hookDef.timeout <= 0)
              ) {
                errors.push(
                  `hooks.${eventName}[${i}].hooks[${j}].timeout must be a positive number`
                );
              }
            }
          }
        }
      }
    }

    // Validate model if present
    if (settings.model !== undefined && typeof settings.model !== 'string') {
      errors.push('model must be a string');
    }

    // Validate env if present
    if (settings.env !== undefined) {
      if (typeof settings.env !== 'object' || settings.env === null) {
        errors.push('env must be an object');
      } else {
        for (const [key, value] of Object.entries(settings.env)) {
          if (typeof value !== 'string') {
            errors.push(`env.${key} must be a string`);
          }
        }
      }
    }
  } catch (parseError) {
    errors.push(
      `Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Parse error'}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valid settings file names
 */
const VALID_SETTINGS_FILENAMES = ['settings.json', 'settings.local.json'];

/**
 * Settings directory name
 */
const SETTINGS_DIR = '.claude';

/**
 * Result of path validation
 */
export interface SettingsPathValidationResult {
  valid: boolean;
  message?: string;
  details?: any;
  context?: Record<string, any>;
}

/**
 * Validates that a path is appropriate for a settings file
 */
export async function validateSettingsPath(
  projectRoot: string,
  targetPath: string
): Promise<SettingsPathValidationResult> {
  logger.debug(`Validating settings path: ${targetPath}`);

  // Special case for command line settings
  if (targetPath === '<command-line>') {
    return { valid: true };
  }

  // Normalize and resolve paths
  const normalizedTarget = path.resolve(targetPath);
  const normalizedRoot = path.resolve(projectRoot);
  const homeDir = os.homedir();

  // Extract filename
  const filename = path.basename(normalizedTarget);
  const parentDir = path.dirname(normalizedTarget);
  const parentDirName = path.basename(parentDir);

  // Check filename
  if (!VALID_SETTINGS_FILENAMES.includes(filename)) {
    return {
      valid: false,
      message: `Invalid settings filename: ${filename}. Must be one of: ${VALID_SETTINGS_FILENAMES.join(', ')}`,
      context: { filename, validFilenames: VALID_SETTINGS_FILENAMES },
    };
  }

  // Check that parent directory is .claude
  if (parentDirName !== SETTINGS_DIR) {
    return {
      valid: false,
      message: `Settings files must be in a ${SETTINGS_DIR} directory`,
      context: { parentDir: parentDirName, requiredDir: SETTINGS_DIR },
    };
  }

  // Determine if this is a user or project settings file
  const userSettingsDir = path.join(homeDir, SETTINGS_DIR);
  const projectSettingsDir = path.join(normalizedRoot, SETTINGS_DIR);

  const isUserSettings = parentDir === userSettingsDir;
  const isProjectSettings = parentDir === projectSettingsDir;

  if (!isUserSettings && !isProjectSettings) {
    // Check if it's in a subdirectory of the project
    if (normalizedTarget.startsWith(normalizedRoot)) {
      // It's within the project, but not in the project's .claude directory
      return {
        valid: false,
        message: `Project settings must be in ${projectSettingsDir}`,
        context: {
          actualPath: normalizedTarget,
          expectedPath: path.join(projectSettingsDir, filename),
        },
      };
    } else {
      // It's outside the project and not in user home
      return {
        valid: false,
        message: `Settings files must be in either ${userSettingsDir} or ${projectSettingsDir}`,
        context: {
          actualPath: normalizedTarget,
          validLocations: [userSettingsDir, projectSettingsDir],
        },
      };
    }
  }

  // Additional validation for settings.local.json
  if (filename === 'settings.local.json' && isUserSettings) {
    return {
      valid: false,
      message: 'settings.local.json is only valid for project-level settings',
      context: {
        filename,
        location: 'user',
        validLocation: 'project',
      },
    };
  }

  logger.debug('Settings path validation successful');
  return { valid: true };
}

/**
 * Determines the type of settings file based on its path
 */
export function getSettingsFileType(filePath: string): SettingsFileType {
  const normalizedPath = path.resolve(filePath);
  const homeDir = os.homedir();
  const userSettingsDir = path.join(homeDir, SETTINGS_DIR);
  const filename = path.basename(normalizedPath);

  // Check for command line placeholder
  if (normalizedPath === '<command-line>') {
    return SettingsFileType.COMMAND_LINE;
  }

  // Check if it's in user home directory
  if (normalizedPath.startsWith(userSettingsDir)) {
    return SettingsFileType.USER;
  }

  // Check if it's settings.local.json (project local)
  if (filename === 'settings.local.json') {
    return SettingsFileType.PROJECT_LOCAL;
  }

  // Check if it's settings.json in project (shared)
  if (filename === 'settings.json') {
    return SettingsFileType.PROJECT_SHARED;
  }

  // Default to enterprise (though this shouldn't happen with proper validation)
  return SettingsFileType.ENTERPRISE;
}

/**
 * Gets the standard settings file paths for a project
 */
export function getStandardSettingsPaths(
  projectRoot: string
): Record<SettingsFileType, string> {
  const homeDir = os.homedir();

  return {
    [SettingsFileType.USER]: path.join(homeDir, SETTINGS_DIR, 'settings.json'),
    [SettingsFileType.PROJECT_SHARED]: path.join(
      projectRoot,
      SETTINGS_DIR,
      'settings.json'
    ),
    [SettingsFileType.PROJECT_LOCAL]: path.join(
      projectRoot,
      SETTINGS_DIR,
      'settings.local.json'
    ),
    [SettingsFileType.COMMAND_LINE]: '<command-line>', // Special placeholder for command line settings
    [SettingsFileType.ENTERPRISE]: '/etc/claude/settings.json', // Placeholder, would be system-specific
  };
}

/**
 * Validates a permission pattern
 */
export function validatePermissionPattern(pattern: string): boolean {
  // Basic validation - patterns should not be empty
  if (!pattern || pattern.trim().length === 0) {
    return false;
  }

  // Patterns can contain wildcards
  // Tool names typically contain alphanumeric characters, underscores, and wildcards
  const validPattern = /^[\w\s*()[\].]+$/;
  return validPattern.test(pattern);
}

/**
 * Validates hook event type
 */
export function validateHookEventType(eventType: string): boolean {
  const validEventTypes = [
    'PreToolUse',
    'PostToolUse',
    'Notification',
    'Stop',
    'SubagentStop',
    'PreCompact',
  ];

  return validEventTypes.includes(eventType);
}

/**
 * Validates hook matcher pattern
 */
export function validateHookMatcher(matcher: string): boolean {
  // Matchers can be exact strings or regex patterns
  if (!matcher || matcher.trim().length === 0) {
    return false;
  }

  // Check for regex patterns (start with '/')
  if (matcher.startsWith('/')) {
    // If it starts with '/' but doesn't end with '/', it's invalid
    if (!matcher.endsWith('/')) {
      return false;
    }

    // Try to compile as regex to check validity
    try {
      new RegExp(matcher.slice(1, -1));
      return true;
    } catch {
      return false;
    }
  }

  // Otherwise it's an exact string match, which is always valid
  return true;
}

/**
 * Checks if a path is safe (no directory traversal)
 */
export function isPathSafe(basePath: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(basePath, targetPath);

  return resolvedTarget.startsWith(resolvedBase);
}
