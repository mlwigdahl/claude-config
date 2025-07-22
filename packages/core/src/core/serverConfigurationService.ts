/**
 * Server-side configuration service implementation
 * Consolidates and replaces the original server/src/services/configurationService.ts
 */

import {
  ServerConfigurationService,
  ConfigurationFileType,
  ConfigurationFileTemplate,
  ConfigurationOperationResult,
  ConfigurationServiceError,
  ConfigurationErrorCode,
  UnifiedValidationResult,
  MemoryParseResult,
  SettingsParseResult,
  CommandParseResult,
} from '../types/configuration.js';

import { ConfigurationCoreImpl } from './configurationCore.js';
import { HookDefinition } from '../types/hooks.js';
import { SettingsConfig } from '../types/settings.js';

/**
 * Server-side configuration service implementation
 */
export class ServerConfigurationServiceImpl
  extends ConfigurationCoreImpl
  implements ServerConfigurationService
{
  /**
   * Process memory file data for API responses
   */
  processMemoryFile(data: {
    content: string;
    path: string;
  }): ConfigurationOperationResult {
    try {
      const validation = this.validateMemoryFile(data.content, data.path);
      const parseResult = this.parseMemoryFile(data.content);

      if (!validation.valid) {
        return {
          success: false,
          message: 'Memory file validation failed',
          filePath: data.path,
          fileType: 'memory',
          errors: validation.errors,
          warnings: validation.warnings,
        };
      }

      return {
        success: true,
        message: 'Memory file processed successfully',
        filePath: data.path,
        fileType: 'memory',
        data: {
          validation,
          parseResult,
          imports: parseResult.imports,
          hasImports: parseResult.imports.length > 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process memory file',
        filePath: data.path,
        fileType: 'memory',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Process settings file data for API responses
   */
  processSettingsFile(data: {
    content: string;
    path: string;
  }): ConfigurationOperationResult {
    try {
      const validation = this.validateSettingsFile(data.content);
      const parseResult = this.parseSettingsFile(data.content);

      if (!validation.valid) {
        return {
          success: false,
          message: 'Settings file validation failed',
          filePath: data.path,
          fileType: 'settings',
          errors: validation.errors,
          warnings: validation.warnings,
        };
      }

      return {
        success: true,
        message: 'Settings file processed successfully',
        filePath: data.path,
        fileType: 'settings',
        data: {
          validation,
          parseResult,
          settings: parseResult.settings,
          hooks: parseResult.hooks,
          hasHooks: parseResult.hooks.length > 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process settings file',
        filePath: data.path,
        fileType: 'settings',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Process command file data for API responses
   */
  processCommandFile(data: {
    content: string;
    path: string;
  }): ConfigurationOperationResult {
    try {
      const validation = this.validateCommandFile(data.content, data.path);
      const parseResult = this.parseCommandFile(data.content);

      if (!validation.valid) {
        return {
          success: false,
          message: 'Command file validation failed',
          filePath: data.path,
          fileType: 'command',
          errors: validation.errors,
          warnings: validation.warnings,
        };
      }

      return {
        success: true,
        message: 'Command file processed successfully',
        filePath: data.path,
        fileType: 'command',
        data: {
          validation,
          parseResult,
          frontmatter: parseResult.frontmatter,
          hasSpecialSyntax: !!parseResult.specialSyntax,
          specialSyntaxValid: parseResult.specialSyntax?.valid ?? true,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process command file',
        filePath: data.path,
        fileType: 'command',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Create template for API endpoint
   */
  createTemplateForEndpoint(
    fileType: ConfigurationFileType,
    options: Record<string, any> = {}
  ): ConfigurationFileTemplate {
    try {
      switch (fileType) {
        case 'memory':
          return this.createMemoryTemplate(options.path);

        case 'settings':
          return this.createSettingsTemplate(options.type || 'project');

        case 'command':
          if (!options.name) {
            throw new ConfigurationServiceError(
              'Command name is required for command template',
              ConfigurationErrorCode.TEMPLATE_CREATION_FAILED,
              undefined,
              'command'
            );
          }
          return this.createCommandTemplate(options.name, options.namespace);

        default:
          throw new ConfigurationServiceError(
            `Unsupported file type: ${fileType}`,
            ConfigurationErrorCode.INVALID_FILE_TYPE,
            undefined,
            fileType
          );
      }
    } catch (error) {
      if (error instanceof ConfigurationServiceError) {
        throw error;
      }

      throw new ConfigurationServiceError(
        `Failed to create template for ${fileType}`,
        ConfigurationErrorCode.TEMPLATE_CREATION_FAILED,
        undefined,
        fileType,
        error
      );
    }
  }

  /**
   * Validate file content and return standardized result
   */
  validateFileContent(
    content: string,
    filePath: string,
    fileType: ConfigurationFileType
  ): UnifiedValidationResult {
    switch (fileType) {
      case 'memory':
        return this.validateMemoryFile(content, filePath);
      case 'settings':
        return this.validateSettingsFile(content);
      case 'command':
        return this.validateCommandFile(content, filePath);
      default:
        return {
          valid: false,
          errors: [`Unsupported file type: ${fileType}`],
          warnings: [],
        };
    }
  }

  /**
   * Parse file content and return standardized result
   */
  parseFileContent(
    content: string,
    fileType: ConfigurationFileType
  ): MemoryParseResult | SettingsParseResult | CommandParseResult {
    switch (fileType) {
      case 'memory':
        return this.parseMemoryFile(content);
      case 'settings':
        return this.parseSettingsFile(content);
      case 'command':
        return this.parseCommandFile(content);
      default:
        throw new ConfigurationServiceError(
          `Unsupported file type: ${fileType}`,
          ConfigurationErrorCode.INVALID_FILE_TYPE,
          undefined,
          fileType
        );
    }
  }

  /**
   * Extract hooks from settings with enhanced metadata
   */
  extractHooksFromSettingsWithMetadata(settings: SettingsConfig): {
    hooks: HookDefinition[];
    metadata: {
      totalHooks: number;
      hooksByTool: Record<string, number>;
      hooksByEvent: Record<string, number>;
    };
  } {
    const hooks = this.extractHooksFromSettings(settings);
    const hooksByTool: Record<string, number> = {};
    const hooksByEvent: Record<string, number> = {};

    // Count hooks by tool and event
    if (settings.hooks) {
      for (const [toolName, toolHooks] of Object.entries(settings.hooks)) {
        hooksByTool[toolName] = Object.keys(toolHooks).length;

        for (const eventType of Object.keys(toolHooks)) {
          hooksByEvent[eventType] = (hooksByEvent[eventType] || 0) + 1;
        }
      }
    }

    return {
      hooks,
      metadata: {
        totalHooks: hooks.length,
        hooksByTool,
        hooksByEvent,
      },
    };
  }

  /**
   * Validate multiple files in batch
   */
  validateMultipleFiles(
    files: Array<{
      content: string;
      path: string;
      type: ConfigurationFileType;
    }>
  ): Array<
    UnifiedValidationResult & {
      filePath: string;
      fileType: ConfigurationFileType;
    }
  > {
    return files.map(file => ({
      ...this.validateFileContent(file.content, file.path, file.type),
      filePath: file.path,
      fileType: file.type,
    }));
  }

  /**
   * Create multiple templates in batch
   */
  createMultipleTemplates(
    requests: Array<{
      type: ConfigurationFileType;
      options?: Record<string, any>;
    }>
  ): ConfigurationFileTemplate[] {
    return requests.map(request =>
      this.createTemplateForEndpoint(request.type, request.options || {})
    );
  }

  /**
   * Get file type from path
   */
  getFileTypeFromPath(filePath: string): ConfigurationFileType | null {
    const fileName = filePath.split('/').pop() || '';

    if (fileName.endsWith('.md')) {
      if (fileName === 'CLAUDE.md' || filePath.includes('CLAUDE.md')) {
        return 'memory';
      }
      return 'command';
    }

    if (
      fileName.endsWith('.json') &&
      (fileName === 'settings.json' || fileName === 'settings.local.json')
    ) {
      return 'settings';
    }

    return null;
  }

  /**
   * Generate file info summary
   */
  generateFileInfoSummary(
    content: string,
    filePath: string,
    fileType: ConfigurationFileType
  ): Record<string, any> {
    const validation = this.validateFileContent(content, filePath, fileType);
    const parseResult = this.parseFileContent(content, fileType);

    const base = {
      filePath,
      fileType,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      size: content.length,
      lines: content.split('\n').length,
    };

    switch (fileType) {
      case 'memory': {
        const memoryResult = parseResult as MemoryParseResult;
        return {
          ...base,
          imports: memoryResult.imports,
          hasImports: memoryResult.imports.length > 0,
        };
      }

      case 'settings': {
        const settingsResult = parseResult as SettingsParseResult;
        return {
          ...base,
          settings: settingsResult.settings,
          hooks: settingsResult.hooks,
          hasHooks: settingsResult.hooks.length > 0,
          settingsKeys: Object.keys(settingsResult.settings),
        };
      }

      case 'command': {
        const commandResult = parseResult as CommandParseResult;
        return {
          ...base,
          frontmatter: commandResult.frontmatter,
          hasFrontmatter: !!commandResult.frontmatter,
          specialSyntax: commandResult.specialSyntax,
        };
      }

      default:
        return base;
    }
  }
}

/**
 * Create a singleton instance of the server configuration service
 */
export const serverConfigurationService = new ServerConfigurationServiceImpl();
