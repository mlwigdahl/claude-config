/**
 * Simplified hooks module that works with settings files
 * According to Claude Code docs: "Hooks are JSON configurations within settings files"
 */

// Export the simplified hooks API
export {
  validateHooksConfig,
  formatHooksForClaudeCode,
  type HooksConfig,
  type SimpleHookDefinition,
  type HookValidationResult,
} from './validation.js';

export {
  extractHooksFromSettings,
  mergeHooksConfigs,
  getHooksForEvent,
  matchesHookPattern,
  findMatchingHooks,
  validateAndReportHooks,
  getHooksStatistics,
} from './utils.js';

// Re-export event types from the original types
export { HookEventType } from '../types/hooks.js';
