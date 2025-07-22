/**
 * File Operations Service
 * Handles all file-related operations using server HTTP APIs
 */

// API base URL - same as fileSystemService
const API_BASE_URL = 'http://localhost:5001';

export interface FileTemplate {
  fileType: 'memory' | 'settings' | 'command';
  template: string;
}

export interface FileProcessResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

export interface FileValidationResult {
  valid: boolean;
  errors?: Array<{
    message: string;
    line?: number;
    column?: number;
  }>;
  warnings?: Array<{
    message: string;
    line?: number;
    column?: number;
  }>;
}

export interface FileAnalysis {
  fileType: string;
  summary?: string;
  sections?: Array<{
    name: string;
    content: string;
  }>;
  hooks?: Array<{
    event: string;
    command: string;
  }>;
  commands?: Array<{
    name: string;
    namespace?: string;
  }>;
}

export interface BatchValidationResult {
  results: Array<{
    filePath: string;
    valid: boolean;
    errors?: Array<{ message: string }>;
  }>;
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
}

export class FileOperationsService {
  /**
   * Create a template for a specific file type
   */
  static async createTemplate(
    fileType: 'memory' | 'settings' | 'command',
    options?: {
      name?: string;
      namespace?: string;
      type?: 'project' | 'user';
    }
  ): Promise<FileTemplate> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/files/create-template`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileType,
            ...options,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create template');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      throw new Error(`Failed to create template: ${(error as Error).message}`);
    }
  }

  /**
   * Process file content using business logic
   */
  static async processFile(
    fileType: 'memory' | 'settings' | 'command',
    content: string,
    filePath?: string
  ): Promise<FileProcessResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileType,
          content,
          filePath,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to process file');
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: 'Failed to process file',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Validate file content
   */
  static async validateFile(
    fileType: 'memory' | 'settings' | 'command',
    content: string,
    filePath?: string
  ): Promise<FileValidationResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileType,
          content,
          filePath,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to validate file');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            message: `Validation error: ${(error as Error).message}`,
          },
        ],
      };
    }
  }

  /**
   * Analyze file content and provide insights
   */
  static async analyzeFile(
    fileType: 'memory' | 'settings' | 'command',
    content: string,
    filePath?: string
  ): Promise<FileAnalysis> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileType,
          content,
          filePath,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to analyze file');
      }

      const result = await response.json();
      return result.data.analysis;
    } catch (error) {
      throw new Error(`Failed to analyze file: ${(error as Error).message}`);
    }
  }

  /**
   * Validate multiple files in batch
   */
  static async validateBatch(
    files: Array<{
      filePath: string;
      content: string;
      fileType: 'memory' | 'settings' | 'command';
    }>
  ): Promise<BatchValidationResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/files/validate-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to validate files');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      throw new Error(`Failed to validate files: ${(error as Error).message}`);
    }
  }

  /**
   * Create multiple templates in batch
   */
  static async createTemplatesBatch(
    requests: Array<{
      fileType: 'memory' | 'settings' | 'command';
      name?: string;
      namespace?: string;
      type?: 'project' | 'user';
    }>
  ): Promise<FileTemplate[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/files/templates-batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ requests }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create templates');
      }

      const result = await response.json();
      return result.data.templates;
    } catch (error) {
      throw new Error(
        `Failed to create templates: ${(error as Error).message}`
      );
    }
  }

  /**
   * Check if a file is a command file (*.md file in .claude/commands directory or subdirectories)
   */
  static isCommandFile(filePath: string): boolean {
    // Normalize the path - handle Windows backslashes and trailing slashes
    let normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+$/, '');

    // Handle relative paths by resolving them
    if (normalizedPath.includes('../')) {
      const parts = normalizedPath.split('/');
      const resolved: string[] = [];
      for (const part of parts) {
        if (part === '..') {
          resolved.pop();
        } else if (part !== '.' && part !== '') {
          resolved.push(part);
        }
      }
      normalizedPath = resolved.join('/');
    }

    const pathSegments = normalizedPath
      .split('/')
      .filter(segment => segment !== '');

    // Find .claude directory in path
    const claudeIndex = pathSegments.findIndex(
      segment => segment === '.claude'
    );
    if (claudeIndex === -1) return false;

    // Check if there's a commands directory after .claude
    const commandsIndex = pathSegments.findIndex(
      (segment, index) => index > claudeIndex && segment === 'commands'
    );
    if (commandsIndex === -1) return false;

    // File must be .md extension and have a valid filename
    const fileName = pathSegments[pathSegments.length - 1] || '';
    return fileName.endsWith('.md') && fileName !== '.md';
  }

  /**
   * Get file type from file path
   */
  static getFileType(
    filePath: string
  ): 'memory' | 'settings' | 'command' | null {
    // Normalize path - remove trailing slashes
    const normalizedPath = filePath.replace(/\/+$/, '');

    const fileName = normalizedPath.split('/').pop() || '';

    // Check if file has .inactive extension
    const isInactive = fileName.endsWith('.inactive');
    const actualFileName = isInactive ? fileName.slice(0, -9) : fileName; // Remove '.inactive'

    // Settings files: settings.json, settings.local.json
    if (
      actualFileName === 'settings.json' ||
      actualFileName === 'settings.local.json'
    ) {
      return 'settings';
    }

    // Check if file is in .claude/commands directory (command files)
    const actualFilePath = isInactive
      ? normalizedPath.slice(0, -9)
      : normalizedPath; // Remove '.inactive' from path
    if (this.isCommandFile(actualFilePath) && actualFileName.endsWith('.md')) {
      return 'command';
    }

    // Memory files: any .md file that is NOT in .claude/commands directory
    if (actualFileName.endsWith('.md')) {
      return 'memory';
    }
    return null;
  }

  /**
   * Get appropriate file extension for file type
   */
  static getFileExtension(fileType: 'memory' | 'settings' | 'command'): string {
    switch (fileType) {
      case 'settings':
        return 'json';
      case 'memory':
      case 'command':
        return 'md';
      default:
        return 'txt';
    }
  }

  /**
   * Create default file name for file type
   */
  static getDefaultFileName(
    fileType: 'memory' | 'settings' | 'command'
  ): string {
    switch (fileType) {
      case 'memory':
        return 'CLAUDE.md';
      case 'settings':
        return 'settings.json';
      case 'command':
        return 'new-command.md';
      default:
        return 'new-file.txt';
    }
  }
}
