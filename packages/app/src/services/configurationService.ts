/**
 * Minimal configuration service for browser compatibility
 * Provides basic functionality until core service is updated
 */

import { FileSystemService } from './fileSystemService.js';

export interface ConfigurationResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

export class ConfigurationService {
  private static instance: ConfigurationService;
  private projectRoot: string | null = null;

  static getInstance(): ConfigurationService {
    if (!ConfigurationService.instance) {
      ConfigurationService.instance = new ConfigurationService();
    }
    return ConfigurationService.instance;
  }

  /**
   * Set project directory path
   */
  static setProjectPath(path: string): void {
    ConfigurationService.getInstance().projectRoot = path;
  }

  /**
   * Get project directory path
   */
  static getProjectPath(): string | null {
    return ConfigurationService.getInstance().projectRoot;
  }

  /**
   * Read file content
   */
  static async readFile(filePath: string): Promise<ConfigurationResult> {
    try {
      const content = await FileSystemService.readFileAsText(filePath);
      return {
        success: true,
        message: 'File read successfully',
        data: { content },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to read file',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Write file content
   */
  static async writeFile(
    filePath: string,
    content: string
  ): Promise<ConfigurationResult> {
    try {
      await FileSystemService.writeTextToFile(filePath, content);
      return {
        success: true,
        message: 'File written successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to write file',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    return await FileSystemService.fileExists(filePath);
  }

  /**
   * Basic validation - just checks if content is valid JSON for settings files
   */
  static validateFile(filePath: string, content: string): ConfigurationResult {
    try {
      if (filePath.endsWith('.json')) {
        JSON.parse(content);
      }
      return {
        success: true,
        message: 'File is valid',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Invalid file format',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a new file with template content
   */
  static async createFile(
    filePath: string,
    type: 'memory' | 'settings' | 'command'
  ): Promise<ConfigurationResult> {
    try {
      let templateContent = '';

      switch (type) {
        case 'memory':
          templateContent =
            '# Project Memory\n\nAdd your project-specific instructions here.\n';
          break;
        case 'settings':
          templateContent =
            '{\n  "name": "project-settings",\n  "version": "1.0.0"\n}\n';
          break;
        case 'command':
          templateContent =
            '# Command\n\nAdd your command documentation here.\n';
          break;
      }

      await FileSystemService.writeTextToFile(filePath, templateContent);

      return {
        success: true,
        message: 'File created successfully',
        data: { content: templateContent },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create file',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
