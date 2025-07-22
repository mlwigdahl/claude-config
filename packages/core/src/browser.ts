/**
 * Browser-specific exports for claude-config core
 * Only exports browser-compatible functionality
 */

// Export only types and browser-compatible functionality
export * from './types/configuration.js';
export * from './types/memory.js';
export * from './types/commands.js';
export { HookEventType, type HookConfig, type HookDefinition, type HookValidationResult } from './types/hooks.js';
export * from './types/settings.js';

// Browser-compatible client configuration service  
export { createClientConfigurationService, ClientConfigurationServiceImpl as ClientConfigurationService } from './core/clientConfigurationService.js';

// Export any browser-compatible utilities
export { LogLevel, Logger, getLogger } from './utils/logger.js';
export { TemplateFactory, createMemoryTemplate, createSettingsTemplate, createCommandTemplate } from './utils/template-factory.js';