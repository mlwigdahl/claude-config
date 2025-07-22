/**
 * Simplified hook validation that works with settings files
 * According to Claude Code docs: "Hooks are JSON configurations within settings files"
 */

import { HookEventType } from '../types/hooks.js';

/**
 * Simple hook definition for settings files
 */
export interface SimpleHookDefinition {
  type: 'command';
  command: string;
  timeout?: number;
}

/**
 * Hook configuration as stored in settings files
 * Format: { "EventType": { "ToolPattern": HookDefinition } }
 */
export type HooksConfig = Record<string, Record<string, SimpleHookDefinition>>;

/**
 * Validation result for hook configurations
 */
export interface HookValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  securityIssues: string[];
}

/**
 * Validate a complete hooks configuration from settings
 */
export function validateHooksConfig(hooks: HooksConfig): HookValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const securityIssues: string[] = [];

  // Validate each event type
  for (const [eventType, eventHooks] of Object.entries(hooks)) {
    // Validate event type
    if (!Object.values(HookEventType).includes(eventType as HookEventType)) {
      errors.push(`Invalid event type: ${eventType}`);
      continue;
    }

    // Validate hooks for this event
    for (const [toolPattern, hookDef] of Object.entries(eventHooks)) {
      const result = validateSingleHook(eventType, toolPattern, hookDef);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
      securityIssues.push(...result.securityIssues);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    securityIssues,
  };
}

/**
 * Validate a single hook definition
 */
function validateSingleHook(
  eventType: string,
  toolPattern: string,
  hookDef: SimpleHookDefinition
): HookValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const securityIssues: string[] = [];

  // Validate hook definition structure
  if (hookDef.type !== 'command') {
    errors.push(
      `Hook for ${eventType}:${toolPattern} must have type 'command'`
    );
  }

  if (!hookDef.command || typeof hookDef.command !== 'string') {
    errors.push(
      `Hook for ${eventType}:${toolPattern} must have a command string`
    );
  }

  // Validate timeout if provided
  if (hookDef.timeout !== undefined) {
    if (
      typeof hookDef.timeout !== 'number' ||
      hookDef.timeout < 1 ||
      hookDef.timeout > 300
    ) {
      errors.push(
        `Hook timeout for ${eventType}:${toolPattern} must be between 1 and 300 seconds`
      );
    }
  }

  // Validate tool pattern
  if (!toolPattern || typeof toolPattern !== 'string') {
    errors.push(`Invalid tool pattern for ${eventType}: ${toolPattern}`);
  }

  // Security validation
  if (hookDef.command) {
    const securityResult = validateCommandSecurity(hookDef.command);
    securityIssues.push(...securityResult.issues);
    warnings.push(...securityResult.warnings);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    securityIssues,
  };
}

/**
 * Security validation for hook commands
 */
function validateCommandSecurity(command: string): {
  issues: string[];
  warnings: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check for dangerous patterns
  const dangerousPatterns = [
    {
      pattern: /sudo\s+/i,
      message: 'sudo command detected - potential privilege escalation',
    },
    {
      pattern: /\brm\s+-rf?\s+/i,
      message: 'rm -rf command detected - potential data loss',
    },
    {
      pattern: /\bchmod\s+/i,
      message: 'chmod command detected - potential permission changes',
    },
    {
      pattern: /\b(reboot|shutdown|halt|init)\b/i,
      message: 'system control command detected',
    },
    {
      pattern: /\bcurl\s+.*\|\s*sh/i,
      message: 'curl pipe to shell detected - potential remote execution',
    },
    {
      pattern: /\bwget\s+.*\|\s*sh/i,
      message: 'wget pipe to shell detected - potential remote execution',
    },
    {
      pattern: /\beval\s+/i,
      message: 'eval command detected - potential code injection',
    },
    {
      pattern: /\$\([^)]*\)/g,
      message: 'command substitution detected - review for safety',
    },
    {
      pattern: /`[^`]*`/g,
      message: 'backtick command substitution detected - review for safety',
    },
  ];

  for (const { pattern, message } of dangerousPatterns) {
    if (pattern.test(command)) {
      if (
        message.includes('potential privilege escalation') ||
        message.includes('potential data loss')
      ) {
        issues.push(message);
      } else {
        warnings.push(message);
      }
    }
  }

  // Check for path traversal
  if (command.includes('..')) {
    warnings.push('Path traversal detected in command - ensure paths are safe');
  }

  // Check for network operations
  if (/\b(curl|wget|nc|telnet|ssh)\b/i.test(command)) {
    warnings.push(
      'Network command detected - ensure network operations are safe'
    );
  }

  return { issues, warnings };
}

/**
 * Convert hooks config to the format expected by Claude Code
 */
export function formatHooksForClaudeCode(
  hooks: HooksConfig
): Record<string, Record<string, SimpleHookDefinition>> {
  // Since HooksConfig now only contains SimpleHookDefinition objects,
  // we can return it directly
  return hooks;
}
