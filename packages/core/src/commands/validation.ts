/**
 * Validation utilities for slash command operations
 */

import * as path from 'path';
import * as os from 'os';
import {
  SlashCommandType,
  CommandNameValidationResult,
  RESERVED_COMMAND_NAMES,
  COMMAND_NAME_PATTERN,
  NAMESPACE_PATTERN,
} from '../types/commands.js';
import { getLogger } from '../utils/logger.js';
import { COMMAND_VALIDATION } from '../constants/validation.js';

const logger = getLogger('command-validation');

/**
 * Commands directory name
 */
const COMMANDS_DIR = 'commands';

/**
 * Settings directory name
 */
const SETTINGS_DIR = '.claude';

/**
 * Result of path validation
 */
export interface CommandPathValidationResult {
  valid: boolean;
  message?: string;
  details?: any;
}

/**
 * Validates that a path is appropriate for a slash command
 */
export async function validateCommandPath(
  projectRoot: string,
  targetPath: string,
  commandName: string,
  namespace?: string,
  customBaseDir?: string
): Promise<CommandPathValidationResult> {
  logger.debug(`Validating command path: ${targetPath}`);

  // Normalize and resolve paths
  const normalizedTarget = path.resolve(targetPath);
  const normalizedRoot = path.resolve(projectRoot);
  const homeDir = os.homedir();

  // Extract filename and validate it's a .md file
  const filename = path.basename(normalizedTarget);
  const expectedFilename = `${commandName}.md`;

  if (filename !== expectedFilename) {
    return {
      valid: false,
      message: `Command filename must be ${expectedFilename}`,
      details: { filename, expected: expectedFilename },
    };
  }

  // Validate command name
  const nameValidation = validateCommandName(commandName);
  if (!nameValidation.valid) {
    return {
      valid: false,
      message: nameValidation.message,
      details: nameValidation.details,
    };
  }

  // Validate namespace if provided
  if (namespace) {
    const namespaceValidation = validateNamespace(namespace);
    if (!namespaceValidation.valid) {
      return {
        valid: false,
        message: namespaceValidation.message,
        details: namespaceValidation.details,
      };
    }
  }

  // Check that the file is in a valid commands directory
  const userCommandsDir = path.join(homeDir, SETTINGS_DIR, COMMANDS_DIR);
  const projectCommandsDir = path.join(
    normalizedRoot,
    SETTINGS_DIR,
    COMMANDS_DIR
  );

  const isUserCommand = normalizedTarget.startsWith(userCommandsDir);
  const isProjectCommand = normalizedTarget.startsWith(projectCommandsDir);
  const isParentCommand = isParentCommandPath(normalizedTarget, normalizedRoot);
  
  // Check if using custom directory
  let isCustomCommand = false;
  if (customBaseDir) {
    const customCommandsDir = path.join(customBaseDir, SETTINGS_DIR, COMMANDS_DIR);
    isCustomCommand = normalizedTarget.startsWith(path.resolve(customCommandsDir));
  }

  if (!isUserCommand && !isProjectCommand && !isParentCommand && !isCustomCommand) {
    const validLocations = [userCommandsDir, projectCommandsDir, 'parent/.claude/commands/'];
    if (customBaseDir) {
      validLocations.push(`${customBaseDir}/.claude/commands/`);
    }
    
    return {
      valid: false,
      message: `Command files must be in either ${validLocations.join(', ')}`,
      details: {
        actualPath: normalizedTarget,
        validLocations,
      },
    };
  }

  // Validate the namespace path structure
  let baseDir: string;
  if (isUserCommand) {
    baseDir = userCommandsDir;
  } else if (isProjectCommand) {
    baseDir = projectCommandsDir;
  } else if (isCustomCommand && customBaseDir) {
    baseDir = path.join(customBaseDir, SETTINGS_DIR, COMMANDS_DIR);
  } else {
    // Parent command - find the parent commands directory
    baseDir = findParentCommandsDir(normalizedTarget);
  }
  
  const relativePath = path.relative(baseDir, path.dirname(normalizedTarget));

  if (namespace) {
    const expectedRelativePath = namespace.replace(/:/g, path.sep);
    if (relativePath !== expectedRelativePath) {
      return {
        valid: false,
        message: `Namespace path mismatch. Expected ${expectedRelativePath}, got ${relativePath}`,
        details: { expected: expectedRelativePath, actual: relativePath },
      };
    }
  } else {
    if (relativePath !== '') {
      return {
        valid: false,
        message: `Command is in a subdirectory but no namespace was specified`,
        details: { relativePath },
      };
    }
  }

  logger.debug('Command path validation successful');
  return { valid: true };
}

/**
 * Validates a command name
 */
export function validateCommandName(
  commandName: string
): CommandNameValidationResult {
  // Check for empty or whitespace-only names
  if (!commandName || commandName.trim().length === 0) {
    const error = 'Command name cannot be empty';
    return {
      valid: false,
      errors: [error],
      message: error, // Backward compatibility
      details: { commandName },
    };
  }

  // Check for reserved names
  if (RESERVED_COMMAND_NAMES.includes(commandName as any)) {
    const error = `Command name "${commandName}" is reserved`;
    return {
      valid: false,
      errors: [error],
      message: error, // Backward compatibility
      suggestion: `Try a different name like "${commandName}-custom" or "my-${commandName}"`,
      details: { commandName, reservedNames: RESERVED_COMMAND_NAMES },
    };
  }

  // Check pattern
  if (!COMMAND_NAME_PATTERN.test(commandName)) {
    const error = 'Command name must start with a letter or number and contain only letters, numbers, hyphens, and underscores';
    return {
      valid: false,
      errors: [error],
      message: error, // Backward compatibility
      suggestion: 'Use alphanumeric characters, hyphens, and underscores only',
      details: { commandName, pattern: COMMAND_NAME_PATTERN.source },
    };
  }

  // Check length
  if (commandName.length > COMMAND_VALIDATION.MAX_NAME_LENGTH) {
    const error = `Command name is too long (maximum ${COMMAND_VALIDATION.MAX_NAME_LENGTH} characters)`;
    return {
      valid: false,
      errors: [error],
      message: error, // Backward compatibility
      suggestion: 'Use a shorter, more concise name',
      details: { commandName, length: commandName.length, maxLength: COMMAND_VALIDATION.MAX_NAME_LENGTH },
    };
  }

  return { valid: true };
}

/**
 * Validates a namespace
 */
export function validateNamespace(
  namespace: string
): CommandNameValidationResult {
  // Check for empty or whitespace-only namespace
  if (!namespace || namespace.trim().length === 0) {
    return {
      valid: false,
      message: 'Namespace cannot be empty',
      details: { namespace },
    };
  }

  // Check for consecutive slashes or leading/trailing slashes FIRST
  if (
    namespace.includes('//') ||
    namespace.startsWith('/') ||
    namespace.endsWith('/')
  ) {
    return {
      valid: false,
      message:
        'Namespace cannot have consecutive, leading, or trailing slashes',
      suggestion: 'Use single forward slashes to separate namespace levels',
      details: { namespace },
    };
  }

  // Check pattern
  if (!NAMESPACE_PATTERN.test(namespace)) {
    return {
      valid: false,
      message:
        'Namespace must contain only letters, numbers, hyphens, underscores, and forward slashes for nesting',
      suggestion:
        'Use alphanumeric characters, hyphens, underscores, and forward slashes only',
      details: { namespace, pattern: NAMESPACE_PATTERN.source },
    };
  }

  // Check depth
  const levels = namespace.split('/');
  if (levels.length > COMMAND_VALIDATION.MAX_NAMESPACE_DEPTH) {
    return {
      valid: false,
      message: `Namespace depth cannot exceed ${COMMAND_VALIDATION.MAX_NAMESPACE_DEPTH} levels`,
      suggestion: 'Use fewer nested levels in your namespace',
      details: { namespace, levels: levels.length, maxLevels: COMMAND_VALIDATION.MAX_NAMESPACE_DEPTH },
    };
  }

  // Validate each level
  for (const level of levels) {
    if (!COMMAND_NAME_PATTERN.test(level)) {
      return {
        valid: false,
        message: `Namespace level "${level}" is invalid`,
        suggestion:
          'Each namespace level must follow the same rules as command names',
        details: { namespace, invalidLevel: level },
      };
    }
  }

  return { valid: true };
}

/**
 * Determines the type of command file based on its path
 */
export function getCommandType(filePath: string, projectRoot?: string): SlashCommandType {
  const normalizedPath = path.resolve(filePath);
  const homeDir = os.homedir();
  const userCommandsDir = path.join(homeDir, SETTINGS_DIR, COMMANDS_DIR);

  // Check if it's in user home directory
  if (normalizedPath.startsWith(userCommandsDir)) {
    return SlashCommandType.USER;
  }

  // Check if it's a parent command (if projectRoot is provided)
  if (projectRoot && isParentCommandPath(normalizedPath, projectRoot)) {
    return SlashCommandType.PARENT;
  }

  // Otherwise assume it's a project command
  return SlashCommandType.PROJECT;
}

/**
 * Builds the file path for a command
 */
export function buildCommandPath(
  projectRoot: string,
  commandName: string,
  namespace?: string,
  type: SlashCommandType = SlashCommandType.PROJECT,
  customBaseDir?: string
): string {
  const homeDir = os.homedir();
  
  let baseDir: string;
  if (customBaseDir) {
    // Use custom directory with .claude/commands structure
    baseDir = path.join(customBaseDir, SETTINGS_DIR, COMMANDS_DIR);
  } else {
    // Use standard directories
    baseDir =
      type === SlashCommandType.USER
        ? path.join(homeDir, SETTINGS_DIR, COMMANDS_DIR)
        : path.join(projectRoot, SETTINGS_DIR, COMMANDS_DIR);
  }

  const namespacePath = namespace ? namespace.replace(/:/g, path.sep) : '';
  const filename = `${commandName}.md`;

  return path.join(baseDir, namespacePath, filename);
}

/**
 * Gets the standard command directory paths for a project
 */
export function getStandardCommandPaths(
  projectRoot: string
): Record<SlashCommandType, string> {
  const homeDir = os.homedir();

  return {
    [SlashCommandType.USER]: path.join(homeDir, SETTINGS_DIR, COMMANDS_DIR),
    [SlashCommandType.PROJECT]: path.join(
      projectRoot,
      SETTINGS_DIR,
      COMMANDS_DIR
    ),
    [SlashCommandType.PARENT]: '', // Parent paths are discovered dynamically
  };
}

/**
 * Extracts command name and namespace from a file path
 */
export function parseCommandPath(
  filePath: string,
  baseDir: string
): { name: string; namespace?: string } {
  const relativePath = path.relative(baseDir, filePath);
  const parsedPath = path.parse(relativePath);

  const name = parsedPath.name; // filename without extension
  const namespace = parsedPath.dir
    ? parsedPath.dir.replace(path.sep, '/')
    : undefined;

  return { name, namespace };
}

/**
 * Validates a full command invocation (e.g., "/git:commit")
 */
export function validateCommandInvocation(
  invocation: string
): CommandNameValidationResult {
  if (!invocation.startsWith('/')) {
    return {
      valid: false,
      message: 'Command invocation must start with /',
      details: { invocation },
    };
  }

  const commandPart = invocation.slice(1); // Remove leading /

  if (commandPart.includes(':')) {
    const [namespace, command] = commandPart.split(':', 2);

    const namespaceValidation = validateNamespace(namespace);
    if (!namespaceValidation.valid) {
      return namespaceValidation;
    }

    const commandValidation = validateCommandName(command);
    if (!commandValidation.valid) {
      return commandValidation;
    }
  } else {
    const commandValidation = validateCommandName(commandPart);
    if (!commandValidation.valid) {
      return commandValidation;
    }
  }

  return { valid: true };
}

/**
 * Simplified validation for command file content
 * Used by the configuration core service
 */
export function validateCommandFile(
  content: string,
  filePath: string
): {
  valid: boolean;
  errors: string[];
  warnings?: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract command name from file path
  const commandName = path.basename(filePath, '.md');

  // Validate command name
  const nameValidation = validateCommandName(commandName);
  if (!nameValidation.valid) {
    errors.push(nameValidation.message || 'Invalid command name');
  }

  // Check if file has content
  if (!content || content.trim().length === 0) {
    errors.push('Command file cannot be empty');
  }

  // Check for valid markdown structure
  if (content.includes('---')) {
    // Has frontmatter, validate it
    const frontmatterMatch = content.match(/^---\n(.*?)\n---/s);
    if (!frontmatterMatch) {
      errors.push('Invalid frontmatter format');
    }
  }

  // Check for special syntax
  if (content.includes('$ARGUMENTS')) {
    // Valid special syntax
  }

  // Check for bash commands
  const bashCommandLines = content
    .split('\n')
    .filter(line => line.trim().startsWith('!'));
  for (const line of bashCommandLines) {
    if (line.trim() === '!') {
      warnings.push('Empty bash command found');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Checks if a command path is in a parent directory
 */
function isParentCommandPath(commandPath: string, projectRoot: string): boolean {
  const normalizedCommandPath = path.resolve(commandPath);
  const normalizedProjectPath = path.resolve(projectRoot);
  
  // Check if the command path contains .claude/commands and is outside the project
  if (!normalizedCommandPath.includes(path.join('.claude', 'commands'))) {
    return false;
  }
  
  // Check if it's outside the project root
  if (normalizedCommandPath.startsWith(normalizedProjectPath)) {
    return false;
  }
  
  // Check if the project is within the parent directory of the command
  const commandDir = path.dirname(normalizedCommandPath);
  const parentDir = findParentCommandsDir(normalizedCommandPath);
  if (!parentDir) {
    return false;
  }
  
  const parentRootDir = path.dirname(parentDir);
  return normalizedProjectPath.startsWith(parentRootDir);
}

/**
 * Finds the parent commands directory for a given command path
 */
function findParentCommandsDir(commandPath: string): string {
  const normalizedPath = path.resolve(commandPath);
  const pathParts = normalizedPath.split(path.sep);
  
  // Find the index of '.claude' in the path
  const claudeIndex = pathParts.findIndex(part => part === '.claude');
  if (claudeIndex === -1) {
    return '';
  }
  
  // The commands directory should be right after .claude
  const commandsIndex = claudeIndex + 1;
  if (commandsIndex >= pathParts.length || pathParts[commandsIndex] !== 'commands') {
    return '';
  }
  
  // Return the path up to and including 'commands'
  return pathParts.slice(0, commandsIndex + 1).join(path.sep);
}
