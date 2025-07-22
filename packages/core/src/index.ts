// Export main library functionality
export * from './memory/index.js';
export * from './settings/index.js';
export * from './commands/index.js';

// Hooks API (works with settings files)
export {
  validateHooksConfig,
  formatHooksForClaudeCode,
  extractHooksFromSettings,
  mergeHooksConfigs,
  getHooksForEvent,
  matchesHookPattern,
  findMatchingHooks,
  validateAndReportHooks,
  getHooksStatistics,
  HookEventType,
  type HooksConfig,
  type SimpleHookDefinition,
  type HookValidationResult
} from './hooks/index.js';


export * from './types/memory.js';
export * from './types/commands.js';
export * from './types/hooks.js';
export * from './types/configuration.js';

// Export core services
export * from './core/serverConfigurationService.js';
export * from './core/clientConfigurationService.js';
export * from './core/configurationCore.js';

// Export settings types but exclude HookDefinition to avoid conflict with hooks
export {
  SettingsFileType,
  PermissionRule,
  SettingsConfig,
  SettingsFileInfo,
  SettingsOperationResult,
  SettingsOperationError,
  SettingsOperationOptions,
  SettingsHierarchyResolution,
  SettingsConflict,
  SchemaValidationResult,
  SchemaValidationError
} from './types/settings.js';

// Export unified error handling
export { ErrorCode, ApplicationError } from './utils/error-handling.js';
export * from './utils/file-system.js';
export * from './utils/logger.js';
export * from './utils/template-factory.js';
export * from './utils/consolidated-filesystem.js';
export * from './utils/error-handling.js';

export function main(): void {
  console.log('Claude Config - Business Logic Framework');
  console.log('Phase 1.2 - Memory File Operations - Implemented');
  console.log('Phase 1.3 - Settings File Operations - Implemented');
  console.log('Phase 1.4 - Slash Command File Operations - Implemented');
  console.log('Phase 1.5 - Hook Configuration Operations - Implemented (works with settings files)');
}

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  main();
}