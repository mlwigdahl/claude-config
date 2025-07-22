/**
 * TypeScript types and interfaces for hook configuration operations
 */

/**
 * Hook event types that can trigger hook execution
 */
export enum HookEventType {
  PRE_TOOL_USE = 'PreToolUse',
  POST_TOOL_USE = 'PostToolUse',
  NOTIFICATION = 'Notification',
  STOP = 'Stop',
  SUBAGENT_STOP = 'SubagentStop',
  PRE_COMPACT = 'PreCompact',
}

/**
 * Hook definition structure
 */
export interface HookDefinition {
  type: 'command';
  command: string;
  timeout?: number; // defaults to 60 seconds
  description?: string;
}

/**
 * Hook matcher pattern types
 */
export enum HookMatcherType {
  EXACT = 'exact',
  REGEX = 'regex',
  TOOL_PATTERN = 'tool_pattern',
}

/**
 * Hook matcher configuration
 */
export interface HookMatcher {
  type: HookMatcherType;
  pattern: string;
  description?: string;
}

/**
 * Complete hook configuration
 */
export interface HookConfig {
  id: string;
  eventType: HookEventType;
  matcher: HookMatcher;
  definition: HookDefinition;
  enabled?: boolean;
  description?: string;
  settingsPath?: string; // Path to the settings file containing this hook
  precedence?: number; // Calculated precedence based on settings hierarchy
}

/**
 * Hook operation result
 */
export interface HookOperationResult {
  success: boolean;
  message: string;
  hookConfig?: HookConfig;
  settingsPath?: string;
  error?: HookError;
  warnings?: string[];
  securityWarnings?: string[];
}

/**
 * Hook operation options
 */
export interface HookOperationOptions {
  dryRun?: boolean;
  force?: boolean;
  backup?: boolean;
  validateSecurity?: boolean;
  skipWarnings?: boolean;
}

/**
 * Hook error codes
 */
export enum HookErrorCode {
  // General errors
  OPERATION_FAILED = 'OPERATION_FAILED',
  INVALID_HOOK_CONFIG = 'INVALID_HOOK_CONFIG',
  HOOK_NOT_FOUND = 'HOOK_NOT_FOUND',
  HOOK_ALREADY_EXISTS = 'HOOK_ALREADY_EXISTS',

  // Security errors
  DANGEROUS_COMMAND = 'DANGEROUS_COMMAND',
  COMMAND_INJECTION_RISK = 'COMMAND_INJECTION_RISK',
  PRIVILEGED_OPERATION = 'PRIVILEGED_OPERATION',
  UNSAFE_PATTERN = 'UNSAFE_PATTERN',

  // Validation errors
  INVALID_EVENT_TYPE = 'INVALID_EVENT_TYPE',
  INVALID_MATCHER_PATTERN = 'INVALID_MATCHER_PATTERN',
  INVALID_COMMAND_SYNTAX = 'INVALID_COMMAND_SYNTAX',
  INVALID_TIMEOUT_VALUE = 'INVALID_TIMEOUT_VALUE',

  // Settings file errors
  SETTINGS_FILE_ERROR = 'SETTINGS_FILE_ERROR',
  INVALID_SETTINGS_PATH = 'INVALID_SETTINGS_PATH',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Hierarchy errors
  HOOK_CONFLICT = 'HOOK_CONFLICT',
  PRECEDENCE_ERROR = 'PRECEDENCE_ERROR',
  INHERITANCE_ERROR = 'INHERITANCE_ERROR',
}

/**
 * Hook error
 */
export interface HookError {
  code: HookErrorCode;
  message: string;
  details?: Record<string, any>;
  securityLevel?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Hook discovery result
 */
export interface HookDiscoveryResult {
  hooks: HookConfig[];
  conflicts: HookConflict[];
  settingsFiles: string[];
  totalHooks: number;
  enabledHooks: number;
  securityIssues: HookSecurityIssue[];
}

/**
 * Hook conflict information
 */
export interface HookConflict {
  eventType: HookEventType;
  matcherPattern: string;
  conflictingHooks: HookConfig[];
  resolved: HookConfig; // The hook that takes precedence
  reason: string;
}

/**
 * Hook security issue
 */
export interface HookSecurityIssue {
  hookId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  message: string;
  recommendation: string;
  command?: string;
}

/**
 * Hook validation result
 */
export interface HookValidationResult {
  valid: boolean;
  errors?: HookValidationError[];
  warnings?: string[];
  securityIssues?: HookSecurityIssue[];
}

/**
 * Hook validation error
 */
export interface HookValidationError {
  field: string;
  value: any;
  message: string;
  code: HookErrorCode;
}

/**
 * Hook scope validation result
 */
export interface HookScopeValidationResult {
  valid: boolean;
  settingsPath: string;
  settingsType: string;
  permissions: HookPermissions;
  conflicts?: HookConflict[];
  warnings?: string[];
}

/**
 * Hook permissions
 */
export interface HookPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canTransfer: boolean;
  restrictedCommands?: string[];
  maxTimeout?: number;
}

/**
 * Hook statistics
 */
export interface HookStatistics {
  totalHooks: number;
  enabledHooks: number;
  disabledHooks: number;
  hooksByEventType: Record<HookEventType, number>;
  hooksByMatcherType: Record<HookMatcherType, number>;
  averageTimeout: number;
  securityIssueCount: number;
  conflictCount: number;
}

/**
 * Hook execution context (for testing and simulation)
 */
export interface HookExecutionContext {
  eventType: HookEventType;
  toolName?: string;
  toolArguments?: Record<string, any>;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  duration?: number;
  timestamp: string;
}

/**
 * Hook matcher test result
 */
export interface HookMatcherTestResult {
  matched: boolean;
  pattern: string;
  input: string;
  matcherType: HookMatcherType;
  captureGroups?: string[];
  error?: string;
}

/**
 * Common hook patterns for validation
 */
export const COMMON_HOOK_PATTERNS = {
  // Tool-specific patterns
  BASH_COMMANDS: /^Bash\(/,
  READ_OPERATIONS: /^Read\(/,
  WRITE_OPERATIONS: /^Write\(/,
  EDIT_OPERATIONS: /^Edit\(/,

  // Dangerous command patterns
  SUDO_COMMANDS: /sudo\s+/i,
  RM_COMMANDS: /\brm\s+-rf?\s+/,
  CHMOD_COMMANDS: /chmod\s+/,
  SYSTEM_COMMANDS: /\b(reboot|shutdown|halt|init)\b/i,

  // Network patterns
  CURL_COMMANDS: /\bcurl\s+/,
  WGET_COMMANDS: /\bwget\s+/,
  SSH_COMMANDS: /\bssh\s+/,

  // File system patterns
  HOME_DIRECTORY: /~|\$HOME/,
  SYSTEM_PATHS: /\/(etc|usr|var|sys|proc|dev)\//,
  HIDDEN_FILES: /\/\.[^/]+/,
} as const;

/**
 * Default hook timeouts by event type
 */
export const DEFAULT_HOOK_TIMEOUTS: Record<HookEventType, number> = {
  [HookEventType.PRE_TOOL_USE]: 30,
  [HookEventType.POST_TOOL_USE]: 60,
  [HookEventType.NOTIFICATION]: 10,
  [HookEventType.STOP]: 30,
  [HookEventType.SUBAGENT_STOP]: 15,
  [HookEventType.PRE_COMPACT]: 60,
} as const;

/**
 * Maximum allowed timeout values
 */
export const MAX_HOOK_TIMEOUT = 300; // 5 minutes
export const MIN_HOOK_TIMEOUT = 1; // 1 second

/**
 * Hook precedence levels based on settings file types
 */
export const HOOK_PRECEDENCE_LEVELS = {
  ENTERPRISE: 1000,
  PROJECT_LOCAL: 500,
  PROJECT_SHARED: 400,
  USER: 100,
} as const;

/**
 * Reserved hook IDs that cannot be used
 */
export const RESERVED_HOOK_IDS = [
  'system',
  'default',
  'internal',
  'claude',
  'anthropic',
  '__proto__',
  'constructor',
  'prototype',
] as const;
