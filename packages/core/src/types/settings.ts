/**
 * Type definitions for settings file operations
 */

import { ApplicationError, ErrorCode } from '../utils/error-handling.js';

/**
 * Types of settings files in the hierarchy
 */
export enum SettingsFileType {
  USER = 'USER', // ~/.claude/settings.json
  PROJECT_SHARED = 'PROJECT_SHARED', // .claude/settings.json
  PROJECT_LOCAL = 'PROJECT_LOCAL', // .claude/settings.local.json
  COMMAND_LINE = 'COMMAND_LINE', // Command line provided settings
  ENTERPRISE = 'ENTERPRISE', // System-level enterprise settings
}

/**
 * Permission rule structure
 */
export interface PermissionRule {
  allow?: string[]; // Array of permitted tool patterns
  deny?: string[]; // Array of forbidden tool patterns
}

/**
 * Settings configuration matching Claude Code schema
 */
export interface SettingsConfig {
  apiKeyHelper?: string; // Custom authentication script configuration
  cleanupPeriodDays?: number; // Transcript retention period
  env?: Record<string, string>; // Environment variables
  permissions?: PermissionRule; // Tool usage rules
  model?: string; // Override default model selection
  hooks?: Partial<Record<HookEvent, SettingsHookMatcher[]>>; // Event-based hook configuration matching Claude Code format
}

/**
 * Claude Code hook matcher structure - groups hooks by tool pattern
 * This matches the official Claude Code hooks format
 */
export interface SettingsHookMatcher {
  matcher: string; // Tool pattern (e.g., "Write|Edit" or "Write" or empty string for all tools)
  hooks: SettingsHookDefinition[];
}

/**
 * Claude Code hook definition structure
 * This matches the official Claude Code hooks format
 */
export interface SettingsHookDefinition {
  type: 'command';
  command: string;
  timeout?: number; // Defaults to 60 seconds
}

/**
 * Hook event types supported by Claude Code
 */
export type HookEvent =
  | 'PreToolUse' // Before tool execution
  | 'PostToolUse' // After tool completion
  | 'UserPromptSubmit' // When user submits a prompt
  | 'Notification' // On specific system notifications
  | 'Stop' // When main agent finishes
  | 'SubagentStop' // When subagent finishes
  | 'PreCompact'; // Before context compaction

/**
 * Settings file metadata and information
 */
export interface SettingsFileInfo {
  path: string;
  type: SettingsFileType;
  exists: boolean;
  content?: SettingsConfig;
  precedence: number; // Higher number = higher precedence
  isActive: boolean; // Whether this file's settings are in effect
  overriddenBy?: string[]; // Paths to files that override this one
}

/**
 * Result of a settings operation
 */
export interface SettingsOperationResult {
  success: boolean;
  message: string;
  filePath?: string;
  settings?: SettingsConfig;
  error?: SettingsOperationError;
  warnings?: string[];
}

/**
 * Type alias for settings operation errors - uses unified error handling
 */
export type SettingsOperationError = ApplicationError;

/**
 * Legacy compatibility export - use ErrorCode from error-handling.js instead
 */
export const SettingsErrorCode = ErrorCode;

/**
 * Options for settings operations
 */
export interface SettingsOperationOptions {
  dryRun?: boolean; // Preview operation without making changes
  backup?: boolean; // Create backup before modifying
  force?: boolean; // Force operation even with warnings
  mergeStrategy?: 'replace' | 'merge' | 'deep-merge'; // How to handle existing settings
}

/**
 * Settings hierarchy resolution result
 */
export interface SettingsHierarchyResolution {
  effectiveSettings: SettingsConfig;
  sourceFiles: SettingsFileInfo[];
  conflicts?: SettingsConflict[];
}

/**
 * Represents a conflict between settings files
 */
export interface SettingsConflict {
  key: string;
  values: Array<{
    value: any;
    source: string;
    precedence: number;
  }>;
  resolved: any; // The value that was chosen
}

/**
 * JSON schema validation result
 */
export interface SchemaValidationResult {
  valid: boolean;
  errors?: SchemaValidationError[];
}

/**
 * Individual schema validation error
 */
export interface SchemaValidationError {
  path: string; // JSON path to the error (e.g., "/permissions/allow/0")
  message: string; // Human-readable error message
  keyword: string; // JSON schema keyword that failed
  params?: any; // Additional error parameters
}
