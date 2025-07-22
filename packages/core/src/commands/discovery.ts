/**
 * Command discovery and namespace management
 */

import * as path from 'path';
import { promises as fs } from 'fs';
import {
  SlashCommandInfo,
  SlashCommandType,
  CommandDiscoveryResult,
  CommandConflict,
  NamespaceInfo,
} from '../types/commands.js';
import { readMarkdownFile } from '../utils/markdown-file.js';
import { getLogger } from '../utils/logger.js';
import { getStandardCommandPaths, parseCommandPath } from './validation.js';

const logger = getLogger('command-discovery');

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
 * Discovers all slash commands in the hierarchy
 */
export async function discoverSlashCommands(
  projectRoot: string
): Promise<CommandDiscoveryResult> {
  logger.debug(`Discovering slash commands for project: ${projectRoot}`);

  const commandPaths = getStandardCommandPaths(projectRoot);
  const discoveredCommands: SlashCommandInfo[] = [];
  const conflicts: CommandConflict[] = [];
  const namespaces = new Set<string>();

  // Define precedence (higher number = higher precedence)
  const precedenceMap: Record<SlashCommandType, number> = {
    [SlashCommandType.PROJECT]: 2, // Project commands override user commands
    [SlashCommandType.USER]: 1,
  };

  // Discover commands in each directory
  for (const [type, dirPath] of Object.entries(commandPaths)) {
    const commandType = type as SlashCommandType;

    try {
      await fs.access(dirPath);
      const commands = await discoverCommandsInDirectory(dirPath, commandType);
      discoveredCommands.push(...commands);

      // Collect namespaces
      commands.forEach(cmd => {
        if (cmd.namespace) {
          namespaces.add(cmd.namespace);
        }
      });
    } catch {
      // Directory doesn't exist, which is fine
      logger.debug(`Commands directory does not exist: ${dirPath}`);
    }
  }

  // Sort by precedence (highest first) for conflict resolution
  discoveredCommands.sort(
    (a, b) => precedenceMap[b.type] - precedenceMap[a.type]
  );

  // Detect conflicts and update isActive status
  const commandMap = new Map<string, SlashCommandInfo[]>();

  // Group commands by full name
  for (const command of discoveredCommands) {
    const key = command.fullName;
    if (!commandMap.has(key)) {
      commandMap.set(key, []);
    }
    commandMap.get(key)!.push(command);
  }

  // Process conflicts
  for (const [, commands] of commandMap.entries()) {
    if (commands.length > 1) {
      // Sort by precedence
      commands.sort((a, b) => precedenceMap[b.type] - precedenceMap[a.type]);

      const winner = commands[0];
      const losers = commands.slice(1);

      // Mark winner as active, losers as inactive
      winner.isActive = true;
      for (const loser of losers) {
        loser.isActive = false;
        loser.overriddenBy = winner.path;
      }

      // Create conflict record
      conflicts.push({
        commandName: winner.name,
        namespace: winner.namespace,
        conflictingCommands: commands.map(cmd => ({
          path: cmd.path,
          type: cmd.type,
          priority: precedenceMap[cmd.type],
        })),
        resolved: winner,
      });
    } else {
      // No conflict, mark as active
      commands[0].isActive = true;
    }
  }

  logger.debug(
    `Discovered ${discoveredCommands.length} commands with ${conflicts.length} conflicts`
  );
  return {
    commands: discoveredCommands,
    conflicts,
    namespaces: Array.from(namespaces).sort(),
  };
}

/**
 * Discovers commands in a specific directory
 */
async function discoverCommandsInDirectory(
  dirPath: string,
  type: SlashCommandType
): Promise<SlashCommandInfo[]> {
  const commands: SlashCommandInfo[] = [];

  try {
    await walkDirectory(dirPath, dirPath, type, commands);
  } catch (error) {
    logger.warn(
      `Failed to discover commands in ${dirPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return commands;
}

/**
 * Recursively walks a directory to find command files
 */
async function walkDirectory(
  currentPath: string,
  basePath: string,
  type: SlashCommandType,
  commands: SlashCommandInfo[]
): Promise<void> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively walk subdirectories
      await walkDirectory(fullPath, basePath, type, commands);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Process command file
      try {
        const commandInfo = await processCommandFile(fullPath, basePath, type);
        commands.push(commandInfo);
      } catch (error) {
        logger.warn(
          `Failed to process command file ${fullPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }
}

/**
 * Processes a single command file and creates CommandInfo
 */
async function processCommandFile(
  filePath: string,
  basePath: string,
  type: SlashCommandType
): Promise<SlashCommandInfo> {
  const { name, namespace } = parseCommandPath(filePath, basePath);
  const fullName = namespace ? `${namespace}:${name}` : name;
  const invocation = `/${fullName}`;

  // Try to read the command content
  let content;
  try {
    content = await readMarkdownFile(filePath);
  } catch (error) {
    // Only log parsing warnings in non-test environments to reduce test noise
    if (!isTestEnvironment()) {
      logger.warn(
        `Failed to read command file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return {
    name,
    namespace,
    fullName,
    path: filePath,
    type,
    exists: true,
    content,
    invocation,
    isActive: true, // Will be updated during conflict resolution
  };
}

/**
 * Gets all active commands (those not overridden by higher precedence)
 */
export async function getActiveCommands(
  projectRoot: string
): Promise<SlashCommandInfo[]> {
  const discovery = await discoverSlashCommands(projectRoot);
  return discovery.commands.filter(cmd => cmd.isActive);
}

/**
 * Finds a specific command by name and namespace
 */
export async function findCommand(
  projectRoot: string,
  commandName: string,
  namespace?: string
): Promise<SlashCommandInfo | undefined> {
  const discovery = await discoverSlashCommands(projectRoot);
  const fullName = namespace ? `${namespace}:${commandName}` : commandName;

  return discovery.commands.find(
    cmd => cmd.fullName === fullName && cmd.isActive
  );
}

/**
 * Discovers all namespaces in the command hierarchy
 */
export async function discoverNamespaces(
  projectRoot: string
): Promise<NamespaceInfo[]> {
  logger.debug('Discovering command namespaces');

  const commandPaths = getStandardCommandPaths(projectRoot);
  const namespaceMap = new Map<string, NamespaceInfo>();

  for (const [type, dirPath] of Object.entries(commandPaths)) {
    const commandType = type as SlashCommandType;

    try {
      await fs.access(dirPath);
      await discoverNamespacesInDirectory(
        dirPath,
        dirPath,
        commandType,
        namespaceMap
      );
    } catch {
      // Directory doesn't exist
    }
  }

  return Array.from(namespaceMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/**
 * Discovers namespaces in a specific directory
 */
async function discoverNamespacesInDirectory(
  currentPath: string,
  basePath: string,
  type: SlashCommandType,
  namespaceMap: Map<string, NamespaceInfo>
): Promise<void> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(basePath, fullPath);
      const namespaceName = relativePath.replace(path.sep, '/');

      // Count commands in this namespace
      let commandCount = 0;
      const subNamespaces: string[] = [];

      try {
        const namespaceEntries = await fs.readdir(fullPath, {
          withFileTypes: true,
        });
        for (const namespaceEntry of namespaceEntries) {
          if (namespaceEntry.isFile() && namespaceEntry.name.endsWith('.md')) {
            commandCount++;
          } else if (namespaceEntry.isDirectory()) {
            subNamespaces.push(namespaceEntry.name);
          }
        }
      } catch (error) {
        logger.warn(
          `Failed to read namespace directory ${fullPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Create or update namespace info
      const key = `${type}:${namespaceName}`;
      if (!namespaceMap.has(key)) {
        namespaceMap.set(key, {
          name: namespaceName,
          path: fullPath,
          type,
          commandCount,
          subNamespaces,
        });
      }

      // Recursively discover sub-namespaces
      await discoverNamespacesInDirectory(
        fullPath,
        basePath,
        type,
        namespaceMap
      );
    }
  }
}

/**
 * Gets commands in a specific namespace
 */
export async function getCommandsInNamespace(
  projectRoot: string,
  namespace: string
): Promise<SlashCommandInfo[]> {
  const discovery = await discoverSlashCommands(projectRoot);
  return discovery.commands.filter(
    cmd => cmd.namespace === namespace && cmd.isActive
  );
}

/**
 * Checks if a namespace exists
 */
export async function namespaceExists(
  projectRoot: string,
  namespace: string,
  type?: SlashCommandType
): Promise<boolean> {
  const commandPaths = getStandardCommandPaths(projectRoot);

  const typesToCheck = type
    ? [type]
    : (Object.keys(commandPaths) as SlashCommandType[]);

  for (const typeToCheck of typesToCheck) {
    const basePath = commandPaths[typeToCheck];
    const namespacePath = path.join(
      basePath,
      namespace.replace(/:/g, path.sep)
    );

    try {
      const stat = await fs.stat(namespacePath);
      if (stat.isDirectory()) {
        return true;
      }
    } catch {
      // Directory doesn't exist
    }
  }

  return false;
}

/**
 * Creates a namespace directory
 */
export async function createNamespace(
  projectRoot: string,
  namespace: string,
  type: SlashCommandType = SlashCommandType.PROJECT
): Promise<void> {
  const commandPaths = getStandardCommandPaths(projectRoot);
  const basePath = commandPaths[type];
  const namespacePath = path.join(basePath, namespace.replace(/:/g, path.sep));

  logger.debug(`Creating namespace directory: ${namespacePath}`);
  await fs.mkdir(namespacePath, { recursive: true });
}

/**
 * Lists all commands with optional filtering
 */
export async function listCommands(
  projectRoot: string,
  options: {
    namespace?: string;
    type?: SlashCommandType;
    activeOnly?: boolean;
  } = {}
): Promise<SlashCommandInfo[]> {
  const discovery = await discoverSlashCommands(projectRoot);
  let commands = discovery.commands;

  // Apply filters
  if (options.namespace) {
    commands = commands.filter(cmd => cmd.namespace === options.namespace);
  }

  if (options.type) {
    commands = commands.filter(cmd => cmd.type === options.type);
  }

  if (options.activeOnly !== false) {
    commands = commands.filter(cmd => cmd.isActive);
  }

  return commands.sort((a, b) => a.fullName.localeCompare(b.fullName));
}
