/**
 * Type definitions for slash command operations
 */

import { ApplicationError, ErrorCode } from '../utils/error-handling.js';

/**
 * Types of slash command files based on their location
 */
export enum SlashCommandType {
  USER = 'USER', // ~/.claude/commands/
  PROJECT = 'PROJECT', // .claude/commands/
}

/**
 * YAML frontmatter structure for slash commands
 */
export interface CommandFrontmatter {
  description?: string; // Brief command explanation
  'allowed-tools'?: string[]; // Array of permitted tools for the command
}

/**
 * Parsed slash command content structure
 */
export interface SlashCommandContent {
  frontmatter?: CommandFrontmatter; // Optional YAML frontmatter
  content: string; // Markdown content (without frontmatter)
  rawContent: string; // Original file content including frontmatter
}

/**
 * Slash command metadata and information
 */
export interface SlashCommandInfo {
  name: string; // Command name (without .md extension)
  namespace?: string; // Namespace (subdirectory path)
  fullName: string; // Full command name with namespace (e.g., "git:commit")
  path: string; // Absolute file path
  type: SlashCommandType; // USER or PROJECT
  exists: boolean; // Whether the file exists
  content?: SlashCommandContent; // Parsed command content
  invocation: string; // How to invoke the command (e.g., "/git:commit")
  isActive: boolean; // Whether this command is accessible (not overridden)
  overriddenBy?: string; // Path to command that overrides this one
}

/**
 * Result of a slash command operation
 */
export interface SlashCommandOperationResult {
  success: boolean;
  message: string;
  commandPath?: string;
  commandInfo?: SlashCommandInfo;
  error?: SlashCommandOperationError;
  warnings?: string[];
}

/**
 * Type alias for slash command operation errors - uses unified error handling
 */
export type SlashCommandOperationError = ApplicationError;

/**
 * Legacy compatibility export - use ErrorCode from error-handling.js instead
 */
export const SlashCommandErrorCode = ErrorCode;

/**
 * Options for slash command operations
 */
export interface SlashCommandOperationOptions {
  dryRun?: boolean; // Preview operation without making changes
  backup?: boolean; // Create backup before modifying
  force?: boolean; // Force operation even with warnings
  createNamespace?: boolean; // Create namespace directory if it doesn't exist
}

/**
 * Special syntax validation result
 */
export interface SpecialSyntaxValidationResult {
  valid: boolean;
  errors?: SpecialSyntaxError[];
  warnings?: string[];
}

/**
 * Individual special syntax error
 */
export interface SpecialSyntaxError {
  type: SpecialSyntaxType;
  line: number;
  column: number;
  message: string;
  suggestion?: string;
}

/**
 * Types of special syntax in slash commands
 */
export enum SpecialSyntaxType {
  ARGUMENTS = 'ARGUMENTS', // $ARGUMENTS placeholder
  BASH_COMMAND = 'BASH_COMMAND', // ! prefix for bash commands
  FILE_REFERENCE = 'FILE_REFERENCE', // @ prefix for file content inclusion
  THINKING_KEYWORD = 'THINKING_KEYWORD', // Extended thinking keywords
}

/**
 * Command discovery result
 */
export interface CommandDiscoveryResult {
  commands: SlashCommandInfo[];
  conflicts: CommandConflict[];
  namespaces: string[];
}

/**
 * Represents a conflict between commands
 */
export interface CommandConflict {
  commandName: string;
  namespace?: string;
  conflictingCommands: Array<{
    path: string;
    type: SlashCommandType;
    priority: number; // Higher number = higher priority
  }>;
  resolved: SlashCommandInfo; // The command that wins the conflict
}

/**
 * Namespace information
 */
export interface NamespaceInfo {
  name: string; // Namespace name
  path: string; // Directory path
  type: SlashCommandType; // USER or PROJECT
  commandCount: number; // Number of commands in this namespace
  subNamespaces: string[]; // Child namespace names
}

/**
 * Command name validation result
 */
export interface CommandNameValidationResult {
  valid: boolean;
  message?: string;
  suggestion?: string;
  details?: any;
}

/**
 * Reserved command names that cannot be used
 */
export const RESERVED_COMMAND_NAMES = [
  'help',
  'list',
  'search',
  'create',
  'edit',
  'delete',
  'move',
  'copy',
  'run',
  'exec',
  'test',
  'debug',
] as const;

/**
 * Valid command name pattern (alphanumeric, hyphens, underscores)
 */
export const COMMAND_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

/**
 * Valid namespace pattern (alphanumeric, hyphens, forward slashes for nesting)
 */
export const NAMESPACE_PATTERN =
  /^[a-zA-Z0-9][a-zA-Z0-9_-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9_-]*)*$/;
