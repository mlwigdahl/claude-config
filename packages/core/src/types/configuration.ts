/**
 * Unified types for configuration service operations
 * This file defines the shared interfaces used across client and server configuration services
 */

import { SettingsConfig } from './settings.js';
import { SpecialSyntaxValidationResult } from './commands.js';
import { HookDefinition } from './hooks.js';

/**
 * Unified file types across all configuration services
 */
export type ConfigurationFileType = 'memory' | 'settings' | 'command';

/**
 * Standardized validation result interface
 * Replaces the inconsistent valid/isValid property names
 */
export interface UnifiedValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Template for creating new configuration files
 */
export interface ConfigurationFileTemplate {
  content: string;
  path: string;
  type: ConfigurationFileType;
  metadata?: Record<string, unknown>;
}

/**
 * Core configuration service interface
 * Defines the essential operations that both client and server services must implement
 */
export interface ConfigurationCore {
  // Validation operations
  validateMemoryFile(
    content: string,
    filePath: string
  ): UnifiedValidationResult;
  validateSettingsFile(content: string): UnifiedValidationResult;
  validateCommandFile(
    content: string,
    filePath: string
  ): UnifiedValidationResult;

  // Template creation operations
  createMemoryTemplate(path?: string): ConfigurationFileTemplate;
  createSettingsTemplate(type?: 'user' | 'project'): ConfigurationFileTemplate;
  createCommandTemplate(
    name: string,
    namespace?: string
  ): ConfigurationFileTemplate;

  // Content parsing operations
  parseMemoryFile(content: string): MemoryParseResult;
  parseSettingsFile(content: string): SettingsParseResult;
  parseCommandFile(content: string): CommandParseResult;

  // Hook operations
  extractHooksFromSettings(settings: SettingsConfig): HookDefinition[];
  validateHook(hook: HookDefinition): UnifiedValidationResult;
}

/**
 * Memory file parsing result
 */
export interface MemoryParseResult {
  content: string;
  imports: string[];
  metadata?: Record<string, unknown>;
  errors?: string[];
}

/**
 * Settings file parsing result
 */
export interface SettingsParseResult {
  settings: SettingsConfig;
  hooks: HookDefinition[];
  metadata?: Record<string, unknown>;
  errors?: string[];
}

/**
 * Command file parsing result
 */
export interface CommandParseResult {
  frontmatter?: Record<string, unknown>;
  content: string;
  specialSyntax?: SpecialSyntaxValidationResult;
  metadata?: Record<string, unknown>;
  errors?: string[];
}

/**
 * Configuration operation result
 * Standardized result type for all configuration operations
 */
export interface ConfigurationOperationResult {
  success: boolean;
  message: string;
  filePath?: string;
  fileType?: ConfigurationFileType;
  data?: unknown;
  errors?: string[];
  warnings?: string[];
}

/**
 * Configuration operation options
 */
export interface ConfigurationOperationOptions {
  dryRun?: boolean;
  backup?: boolean;
  force?: boolean;
  validateContent?: boolean;
}

/**
 * Client-specific configuration service interface
 * Extends ConfigurationCore with client-specific operations
 */
export interface ClientConfigurationService extends ConfigurationCore {
  // File system operations
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  createFile(
    path: string,
    content: string,
    type: ConfigurationFileType
  ): Promise<ConfigurationOperationResult>;
  deleteFile(filePath: string): Promise<ConfigurationOperationResult>;

  // Project operations
  setProjectHandle(handle: any): void;
  discoverProjectFiles(): Promise<any[]>;

  // API integration
  validateViaAPI(
    content: string,
    filePath: string,
    fileType: ConfigurationFileType
  ): Promise<UnifiedValidationResult>;
}

/**
 * Server-specific configuration service interface
 * Extends ConfigurationCore with server-specific operations
 */
export interface ServerConfigurationService extends ConfigurationCore {
  // Processing operations
  processMemoryFile(data: {
    content: string;
    path: string;
  }): ConfigurationOperationResult;
  processSettingsFile(data: {
    content: string;
    path: string;
  }): ConfigurationOperationResult;
  processCommandFile(data: {
    content: string;
    path: string;
  }): ConfigurationOperationResult;

  // Template operations with server context
  createTemplateForEndpoint(
    fileType: ConfigurationFileType,
    options?: Record<string, any>
  ): ConfigurationFileTemplate;
}

/**
 * Validation adapter interface
 * Allows different validation strategies (local vs API)
 */
export interface ValidationAdapter {
  validateMemoryFile(
    content: string,
    filePath: string
  ): Promise<UnifiedValidationResult>;
  validateSettingsFile(content: string): Promise<UnifiedValidationResult>;
  validateCommandFile(
    content: string,
    filePath: string
  ): Promise<UnifiedValidationResult>;
}

/**
 * Local validation adapter
 * Uses core business logic for validation
 */
export class LocalValidationAdapter implements ValidationAdapter {
  constructor(private core: ConfigurationCore) {}

  async validateMemoryFile(
    content: string,
    filePath: string
  ): Promise<UnifiedValidationResult> {
    return this.core.validateMemoryFile(content, filePath);
  }

  async validateSettingsFile(
    content: string
  ): Promise<UnifiedValidationResult> {
    return this.core.validateSettingsFile(content);
  }

  async validateCommandFile(
    content: string,
    filePath: string
  ): Promise<UnifiedValidationResult> {
    return this.core.validateCommandFile(content, filePath);
  }
}

/**
 * API validation adapter
 * Uses server API for validation with local fallback
 */
export class APIValidationAdapter implements ValidationAdapter {
  constructor(
    private apiBaseUrl: string,
    private fallbackAdapter: LocalValidationAdapter
  ) {}

  async validateMemoryFile(
    content: string,
    filePath: string
  ): Promise<UnifiedValidationResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/validation/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filePath }),
      });

      if (!response.ok) {
        throw new Error(`API validation failed: ${response.status}`);
      }

      return await response.json();
    } catch (_error) {
      // Fallback to local validation
      return this.fallbackAdapter.validateMemoryFile(content, filePath);
    }
  }

  async validateSettingsFile(
    content: string
  ): Promise<UnifiedValidationResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/validation/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`API validation failed: ${response.status}`);
      }

      return await response.json();
    } catch (_error) {
      // Fallback to local validation
      return this.fallbackAdapter.validateSettingsFile(content);
    }
  }

  async validateCommandFile(
    content: string,
    filePath: string
  ): Promise<UnifiedValidationResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/validation/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, filePath }),
      });

      if (!response.ok) {
        throw new Error(`API validation failed: ${response.status}`);
      }

      return await response.json();
    } catch (_error) {
      // Fallback to local validation
      return this.fallbackAdapter.validateCommandFile(content, filePath);
    }
  }
}

/**
 * Configuration service factory
 * Creates appropriate service instances based on environment
 */
export class ConfigurationServiceFactory {
  /**
   * Create a client-side configuration service
   */
  static createClientService(_options: {
    apiBaseUrl: string;
    core: ConfigurationCore;
  }): ClientConfigurationService {
    // This would be implemented in the client service file
    throw new Error('Client service implementation required');
  }

  /**
   * Create a server-side configuration service
   */
  static createServerService(_options: {
    core: ConfigurationCore;
  }): ServerConfigurationService {
    // This would be implemented in the server service file
    throw new Error('Server service implementation required');
  }
}

/**
 * Error codes for configuration operations
 */
export enum ConfigurationErrorCode {
  // Validation errors
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  INVALID_CONTENT = 'INVALID_CONTENT',

  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // API errors
  API_UNAVAILABLE = 'API_UNAVAILABLE',
  API_ERROR = 'API_ERROR',

  // Operation errors
  OPERATION_FAILED = 'OPERATION_FAILED',
  TEMPLATE_CREATION_FAILED = 'TEMPLATE_CREATION_FAILED',
  PARSING_FAILED = 'PARSING_FAILED',
}

/**
 * Configuration service error
 */
export class ConfigurationServiceError extends Error {
  constructor(
    message: string,
    public code: ConfigurationErrorCode,
    public filePath?: string,
    public fileType?: ConfigurationFileType,
    public details?: any
  ) {
    super(message);
    this.name = 'ConfigurationServiceError';
  }
}
