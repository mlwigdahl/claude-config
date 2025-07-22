/**
 * Configuration service that provides basic business logic for API consumption
 * This is a simplified version that doesn't depend on the complex @core modules
 */

import { TemplateFactory } from '@claude-config/core';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface FileTemplate {
  content: string;
  path: string;
}

export class ConfigurationServiceAPI {
  /**
   * Determine configuration file type based on filename
   */
  static getFileConfigurationType(
    filename: string
  ): { type: 'memory' | 'settings' | 'command' } | null {
    // Remove .inactive suffix for type checking
    const baseFilename = filename.replace(/\.inactive$/, '');

    // Memory files
    if (baseFilename.endsWith('.md')) {
      return { type: 'memory' };
    }

    // Settings files
    if (
      baseFilename === 'settings.json' ||
      baseFilename === 'settings.local.json'
    ) {
      return { type: 'settings' };
    }

    // Command files
    if (baseFilename === 'commands.json') {
      return { type: 'command' };
    }

    return null;
  }

  /**
   * Create empty templates for different file types
   */
  static createEmptyMemoryFile(): FileTemplate {
    const template = TemplateFactory.createMinimalMemoryTemplate();
    return {
      content: template.content,
      path: template.path,
    };
  }

  static createEmptySettings(): any {
    const template = TemplateFactory.createMinimalSettingsTemplate();
    return JSON.parse(template.content);
  }

  static createEmptyCommandFile(): FileTemplate {
    const template = TemplateFactory.createMinimalCommandTemplate();
    return {
      content: template.content,
      path: template.path,
    };
  }

  /**
   * Validation methods
   */
  static validateMemoryFile(
    content: string,
    filePath: string
  ): ValidationResult {
    try {
      // Basic memory file validation
      if (!content || content.trim().length === 0) {
        return {
          isValid: false,
          errors: ['Memory file cannot be empty'],
        };
      }

      // Check if it's a markdown file
      if (!filePath.endsWith('.md')) {
        return {
          isValid: false,
          errors: ['Memory files should have .md extension'],
        };
      }

      // Check for basic markdown structure
      if (!content.includes('#')) {
        return {
          isValid: true,
          errors: [],
          warnings: [
            'Memory file should contain at least one header for better organization',
          ],
        };
      }

      return {
        isValid: true,
        errors: [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
      };
    }
  }

  static validateSettingsFile(content: string): ValidationResult {
    try {
      // First parse JSON
      let parsedSettings;
      try {
        parsedSettings = JSON.parse(content);
      } catch {
        return {
          isValid: false,
          errors: ['Invalid JSON format'],
        };
      }

      // Basic settings validation since validateSettings doesn't exist
      if (typeof parsedSettings !== 'object' || parsedSettings === null) {
        return {
          isValid: false,
          errors: ['Settings must be a valid JSON object'],
        };
      }

      // Check for required structure
      if (Object.keys(parsedSettings).length === 0) {
        return {
          isValid: false,
          errors: ['Settings file cannot be empty'],
        };
      }

      // Additional validation can be added here
      return {
        isValid: true,
        errors: [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          error instanceof Error ? error.message : 'Settings validation failed',
        ],
      };
    }
  }

  static validateCommandFile(
    content: string,
    filePath: string
  ): ValidationResult {
    try {
      // Basic command file validation
      if (!content || content.trim().length === 0) {
        return {
          isValid: false,
          errors: ['Command file cannot be empty'],
        };
      }

      // Check if it's a markdown file
      if (!filePath.endsWith('.md')) {
        return {
          isValid: false,
          errors: ['Command files must have .md extension'],
        };
      }

      return {
        isValid: true,
        errors: [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          error instanceof Error ? error.message : 'Command validation failed',
        ],
      };
    }
  }

  /**
   * Parse file content
   */
  static parseMemoryFile(content: string): any {
    // Simple markdown parsing
    const lines = content.split('\n');
    const sections: any[] = [];
    let currentSection: any = null;

    for (const line of lines) {
      if (line.startsWith('#')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: line.replace(/^#+\s*/, ''),
          content: '',
          level: (line.match(/^#+/) || [''])[0].length,
        };
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    return {
      sections,
      metadata: {
        totalLines: lines.length,
        sectionCount: sections.length,
      },
      content,
    };
  }

  static parseSettingsFile(content: string): any {
    try {
      return JSON.parse(content);
    } catch {
      throw new Error('Invalid JSON format');
    }
  }

  static parseCommandFile(content: string): any {
    const lines = content.split('\n');
    const commands: any[] = [];
    let inCodeBlock = false;
    let currentCommand = '';

    for (const line of lines) {
      if (line.includes('```')) {
        if (inCodeBlock && currentCommand.trim()) {
          commands.push({
            type: 'code-block',
            content: currentCommand.trim(),
            language: 'bash', // default
          });
          currentCommand = '';
        }
        inCodeBlock = !inCodeBlock;
      } else if (inCodeBlock) {
        currentCommand += line + '\n';
      }
    }

    return {
      commands,
      metadata: {
        totalLines: lines.length,
        commandCount: commands.length,
      },
      content,
    };
  }

  /**
   * Process files (placeholder for more complex processing)
   */
  static processMemoryFile(data: { content: string; path: string }): any {
    return {
      processed: true,
      content: data.content,
      path: data.path,
      timestamp: new Date().toISOString(),
    };
  }

  static processSettings(settings: any): any {
    return {
      processed: true,
      settings,
      timestamp: new Date().toISOString(),
    };
  }

  static processCommandFile(data: { content: string; path: string }): any {
    return {
      processed: true,
      content: data.content,
      path: data.path,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Hooks extraction
   */
  static extractHooksFromSettings(settings: any): any[] {
    try {
      // Simple hooks extraction from settings
      if (!settings || typeof settings !== 'object') {
        return [];
      }

      // Look for hooks property
      if (settings.hooks && typeof settings.hooks === 'object') {
        // Convert hooks object to array format
        return Object.entries(settings.hooks).map(([name, command]) => ({
          name,
          command,
          type: 'hook',
        }));
      }

      return [];
    } catch (error) {
      console.error('Failed to extract hooks:', error);
      return [];
    }
  }

  static validateHook(hook: any): ValidationResult {
    try {
      if (!hook || typeof hook !== 'object') {
        return {
          isValid: false,
          errors: ['Hook must be an object'],
        };
      }

      if (!hook.name || typeof hook.name !== 'string') {
        return {
          isValid: false,
          errors: ['Hook must have a valid name'],
        };
      }

      if (!hook.command || typeof hook.command !== 'string') {
        return {
          isValid: false,
          errors: ['Hook must have a valid command'],
        };
      }

      return {
        isValid: true,
        errors: [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          error instanceof Error ? error.message : 'Hook validation failed',
        ],
      };
    }
  }
}
