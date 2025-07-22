/**
 * Unified types export for configuration system
 */

// Core configuration types
export * from './configuration.js';

// Specific domain types
export * from './memory.js';
export * from './settings.js';
export * from './commands.js';
export * from './hooks.js';

// Re-export commonly used types for convenience
export type {
  ConfigurationFileType,
  UnifiedValidationResult,
  ConfigurationFileTemplate,
  ConfigurationOperationResult,
  ConfigurationCore,
  ClientConfigurationService,
  ServerConfigurationService,
  ValidationAdapter,
  LocalValidationAdapter,
  APIValidationAdapter,
  ConfigurationServiceFactory,
  ConfigurationServiceError,
  ConfigurationErrorCode,
} from './configuration.js';

export type {
  MemoryFileInfo,
  MemoryOperationResult,
  MemoryFileValidationResult,
  MemoryOperationError,
} from './memory.js';

export type {
  SettingsConfig,
  SettingsFileInfo,
  SettingsOperationResult,
  SettingsFileType,
  PermissionRule,
  SettingsHookDefinition,
  SettingsHookMatcher,
  HookEvent,
} from './settings.js';

export type {
  SlashCommandInfo,
  SlashCommandContent,
  SlashCommandOperationResult,
  SlashCommandType,
  CommandFrontmatter,
  SpecialSyntaxValidationResult,
} from './commands.js';

export type {
  HookDefinition,
  HookConfig,
  HookValidationResult,
  HookOperationResult,
} from './hooks.js';
