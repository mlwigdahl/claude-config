/**
 * Simplified hook utilities that work with settings files
 * According to Claude Code docs: "Hooks are JSON configurations within settings files"
 */

import { HookEventType } from '../types/hooks.js';
import { SettingsConfig } from '../types/settings.js';
import {
  HooksConfig,
  SimpleHookDefinition,
  validateHooksConfig,
} from './validation.js';

/**
 * Extract hooks from settings configuration
 */
export function extractHooksFromSettings(
  settings: SettingsConfig
): HooksConfig {
  if (!settings.hooks) {
    return {};
  }

  // Convert from Claude Code format to simplified format
  const hooks: HooksConfig = {};

  for (const [eventType, matchers] of Object.entries(settings.hooks)) {
    // Validate event type
    if (!Object.values(HookEventType).includes(eventType as HookEventType)) {
      throw new Error(
        `Invalid hook event type: "${eventType}". Valid event types are: ${Object.values(HookEventType).join(', ')}`
      );
    }

    if (!Array.isArray(matchers)) {
      throw new Error(
        `Hook event type "${eventType}" must be an array of matchers in Claude Code format`
      );
    }

    hooks[eventType] = {};

    // Claude Code format: array of matchers
    for (const matcher of matchers) {
      // Each matcher has a pattern and array of hook definitions
      for (const hookDef of matcher.hooks) {
        hooks[eventType][matcher.matcher] = {
          type: hookDef.type,
          command: hookDef.command,
          timeout: hookDef.timeout,
        };
      }
    }
  }

  return hooks;
}

/**
 * Merge hooks from multiple settings files according to precedence
 */
export function mergeHooksConfigs(
  configs: { hooks: HooksConfig; precedence: number }[]
): HooksConfig {
  // Sort by precedence (lower number = lower precedence, higher number = higher precedence)
  const sorted = configs.sort((a, b) => a.precedence - b.precedence);

  const merged: HooksConfig = {};

  // Merge in precedence order (lower precedence first, higher precedence overwrites)
  for (const { hooks } of sorted) {
    for (const [eventType, eventHooks] of Object.entries(hooks)) {
      if (!merged[eventType]) {
        merged[eventType] = {};
      }

      // Higher precedence hooks override lower precedence ones
      for (const [toolPattern, hookDef] of Object.entries(eventHooks)) {
        merged[eventType][toolPattern] = hookDef;
      }
    }
  }

  return merged;
}

/**
 * Get all hooks that match a specific event type
 */
export function getHooksForEvent(
  hooks: HooksConfig,
  eventType: HookEventType
): Record<string, SimpleHookDefinition> {
  const eventHooks = hooks[eventType];
  if (!eventHooks) {
    return {};
  }

  // Since HooksConfig now only contains SimpleHookDefinition objects,
  // we can return eventHooks directly
  return eventHooks;
}

/**
 * Check if a tool matches a hook pattern
 */
export function matchesHookPattern(toolName: string, pattern: string): boolean {
  // Exact match
  if (pattern === toolName) {
    return true;
  }

  // Basic regex support
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(toolName);
  } catch {
    // If regex is invalid, fall back to exact match
    return pattern === toolName;
  }
}

/**
 * Find all hooks that should execute for a given tool and event
 */
export function findMatchingHooks(
  hooks: HooksConfig,
  eventType: HookEventType,
  toolName: string
): Array<{ pattern: string; hook: SimpleHookDefinition }> {
  const eventHooks = getHooksForEvent(hooks, eventType);
  const matches: Array<{ pattern: string; hook: SimpleHookDefinition }> = [];

  for (const [pattern, hookDef] of Object.entries(eventHooks)) {
    if (matchesHookPattern(toolName, pattern)) {
      matches.push({ pattern, hook: hookDef });
    }
  }

  return matches;
}

/**
 * Validate hooks configuration and return user-friendly results
 */
export function validateAndReportHooks(hooks: HooksConfig): {
  valid: boolean;
  summary: string;
  issues: Array<{ type: 'error' | 'warning' | 'security'; message: string }>;
} {
  const result = validateHooksConfig(hooks);
  const issues: Array<{
    type: 'error' | 'warning' | 'security';
    message: string;
  }> = [];

  // Add errors
  for (const error of result.errors) {
    issues.push({ type: 'error', message: error });
  }

  // Add warnings
  for (const warning of result.warnings) {
    issues.push({ type: 'warning', message: warning });
  }

  // Add security issues
  for (const security of result.securityIssues) {
    issues.push({ type: 'security', message: security });
  }

  let summary = '';
  if (result.valid) {
    summary = `Hooks configuration is valid. Found ${Object.keys(hooks).length} event types configured.`;
  } else {
    summary = `Hooks configuration has ${result.errors.length} errors, ${result.warnings.length} warnings, and ${result.securityIssues.length} security issues.`;
  }

  return {
    valid: result.valid,
    summary,
    issues,
  };
}

/**
 * Get statistics about hooks configuration
 */
export function getHooksStatistics(hooks: HooksConfig): {
  totalHooks: number;
  eventTypes: string[];
  toolPatterns: string[];
  averageTimeout: number;
  securityIssueCount: number;
} {
  let totalHooks = 0;
  const eventTypes = new Set<string>();
  const toolPatterns = new Set<string>();
  const timeouts: number[] = [];
  let securityIssueCount = 0;

  for (const [eventType, eventHooks] of Object.entries(hooks)) {
    eventTypes.add(eventType);

    for (const [toolPattern, hookDef] of Object.entries(eventHooks)) {
      totalHooks++;
      toolPatterns.add(toolPattern);

      if (hookDef.timeout) {
        timeouts.push(hookDef.timeout);
      }

      // Quick security check
      if (
        hookDef.command.includes('sudo') ||
        hookDef.command.includes('rm -rf')
      ) {
        securityIssueCount++;
      }
    }
  }

  const averageTimeout =
    timeouts.length > 0
      ? timeouts.reduce((a, b) => a + b, 0) / timeouts.length
      : 60; // Default timeout

  return {
    totalHooks,
    eventTypes: Array.from(eventTypes),
    toolPatterns: Array.from(toolPatterns),
    averageTimeout,
    securityIssueCount,
  };
}
