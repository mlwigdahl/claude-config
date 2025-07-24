/**
 * Centralized validation constants for Claude Config
 *
 * This file consolidates all magic numbers and validation limits
 * that were previously scattered throughout the codebase.
 */

/**
 * Memory file validation limits
 */
export const MEMORY_VALIDATION = {
  /** Maximum import chain depth allowed (Claude Code's limit) */
  MAX_IMPORT_DEPTH: 5,
  /** Depth threshold for showing warning about approaching limit */
  IMPORT_DEPTH_WARNING_THRESHOLD: 4,
  /** File size threshold for showing size warning (in characters) */
  FILE_SIZE_WARNING_THRESHOLD: 50000,
} as const;

/**
 * Command validation limits
 */
export const COMMAND_VALIDATION = {
  /** Maximum length for command names */
  MAX_NAME_LENGTH: 50,
  /** Maximum namespace depth levels allowed */
  MAX_NAMESPACE_DEPTH: 3,
} as const;

/**
 * Hook timeout validation limits
 * Note: MIN_HOOK_TIMEOUT and MAX_HOOK_TIMEOUT are already defined in types/hooks.ts
 * We maintain consistency by re-exporting them here for validation use
 */
export const HOOK_VALIDATION = {
  /** Minimum hook timeout in seconds */
  MIN_TIMEOUT: 1,
  /** Maximum hook timeout in seconds (5 minutes) */
  MAX_TIMEOUT: 300,
  /** Default hook timeout when none specified */
  DEFAULT_TIMEOUT: 60,
} as const;

/**
 * General file validation limits
 */
export const FILE_VALIDATION = {
  /** Maximum paragraph length before suggesting line breaks */
  PARAGRAPH_LENGTH_WARNING: 100,
} as const;

/**
 * Consolidated validation limits for easy access
 */
export const VALIDATION_LIMITS = {
  ...MEMORY_VALIDATION,
  ...COMMAND_VALIDATION,
  ...HOOK_VALIDATION,
  ...FILE_VALIDATION,
} as const;
