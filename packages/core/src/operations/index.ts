/**
 * Unified operations module - Phase 2 refactoring
 * Provides consistent CRUD operations for all file types using template method pattern
 */

// Base classes and interfaces
export {
  BaseCrudOperations,
  BaseOperationOptions,
  BaseOperationResult,
  UnifiedValidationResult,
  ValidationError,
  ValidationWarning,
} from './base.js';

// Memory operations
export {
  MemoryFileOperations,
  MemoryOperationOptions,
  MemoryOperationResult,
  createMemoryFile,
  updateMemoryFile,
  moveMemoryFile,
  deleteMemoryFile,
} from './memory.js';

// Settings operations
export {
  SettingsFileOperations,
  SettingsOperationOptions,
  SettingsOperationResult,
  createSettingsFile,
  updateSettingsFile,
  moveSettingsFile,
  deleteSettingsFile,
} from './settings.js';

// Command operations
export {
  CommandFileOperations,
  CommandOperationOptions,
  CommandOperationResult,
  createSlashCommand,
  updateSlashCommand,
  moveSlashCommand,
  deleteSlashCommand,
} from './commands.js';

// ========================================
// Unified Factory Functions
// ========================================

import { MemoryFileOperations } from './memory.js';
import { SettingsFileOperations } from './settings.js';
import { CommandFileOperations } from './commands.js';

/**
 * Factory function to create appropriate operations instance based on file type
 */
export function createOperations(fileType: 'memory' | 'settings' | 'command') {
  switch (fileType) {
    case 'memory':
      return new MemoryFileOperations();
    case 'settings':
      return new SettingsFileOperations();
    case 'command':
      return new CommandFileOperations();
    default:
      throw new Error(`Unknown file type: ${fileType}`);
  }
}

/**
 * Pre-configured operations instances for convenience
 */
export const operations = {
  memory: new MemoryFileOperations(),
  settings: new SettingsFileOperations(),
  command: new CommandFileOperations(),
} as const;
