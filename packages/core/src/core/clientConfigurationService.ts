/**
 * Client-side configuration service implementation
 * Consolidates and replaces the original app/src/services/configurationService.ts
 */

import {
  ClientConfigurationService,
  ConfigurationFileType,
  ConfigurationOperationResult,
  ConfigurationServiceError,
  ConfigurationErrorCode,
  UnifiedValidationResult,
  ValidationAdapter,
  LocalValidationAdapter,
  APIValidationAdapter,
  ConfigurationOperationOptions,
} from '../types/configuration.js';

import { ConfigurationCoreImpl } from './configurationCore.js';

/**
 * File system types (would be provided by browser environment)
 */
interface FileSystemHandle {
  name: string;
  kind: 'file' | 'directory';
}

interface DirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  values(): AsyncIterableIterator<[string, FileSystemHandle]>;
  getFileHandle(name: string): Promise<FileHandle>;
  getDirectoryHandle(name: string): Promise<DirectoryHandle>;
}

interface FileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream {
  write(data: string | BufferSource): Promise<void>;
  close(): Promise<void>;
}

/**
 * Client-side configuration service implementation
 */
export class ClientConfigurationServiceImpl
  extends ConfigurationCoreImpl
  implements ClientConfigurationService
{
  private projectHandle: DirectoryHandle | null = null;
  private validationAdapter: ValidationAdapter;

  constructor(private apiBaseUrl: string = '/api') {
    super();

    // Create validation adapter with local fallback
    const localAdapter = new LocalValidationAdapter(this);
    this.validationAdapter = new APIValidationAdapter(apiBaseUrl, localAdapter);
  }

  /**
   * Set the project directory handle
   */
  setProjectHandle(handle: DirectoryHandle): void {
    this.projectHandle = handle;
  }

  /**
   * Discover project files using File System Access API
   */
  async discoverProjectFiles(): Promise<any[]> {
    if (!this.projectHandle) {
      throw new Error('No project selected');
    }

    try {
      const files = await this.discoverClaudeFiles(this.projectHandle);
      return files;
    } catch (error) {
      throw new Error(
        `Failed to discover project files: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<string> {
    try {
      const fileHandle = await this.getFileHandle(filePath);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (_error) {
      throw new Error(`Failed to read file: ${filePath}`);
    }
  }

  /**
   * Write file content
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const fileHandle = await this.getFileHandle(filePath);
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (_error) {
      throw new Error(`Failed to write file: ${filePath}`);
    }
  }

  /**
   * Create a new file
   */
  async createFile(
    path: string,
    content: string,
    type: ConfigurationFileType
  ): Promise<ConfigurationOperationResult> {
    const options: ConfigurationOperationOptions = { validateContent: true };
    try {
      // Validate content before creating
      if (options.validateContent !== false) {
        const validation = await this.validateViaAPI(content, path, type);
        if (!validation.valid) {
          return {
            success: false,
            message: 'Content validation failed',
            filePath: path,
            fileType: type,
            errors: validation.errors,
            warnings: validation.warnings,
          };
        }
      }

      // Create the file
      if (!options.dryRun) {
        await this.writeFile(path, content);
      }

      return {
        success: true,
        message: options.dryRun
          ? 'File would be created'
          : 'File created successfully',
        filePath: path,
        fileType: type,
        data: { content, size: content.length },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create file: ${path}`,
        filePath: path,
        fileType: type,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filePath: string): Promise<ConfigurationOperationResult> {
    try {
      // For now, we'll just return success as File System Access API
      // doesn't have a direct delete method
      return {
        success: true,
        message: 'File deletion not implemented in File System Access API',
        filePath,
        warnings: ['File deletion requires manual action'],
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to delete file: ${filePath}`,
        filePath,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Validate via API with fallback to local validation
   */
  async validateViaAPI(
    content: string,
    filePath: string,
    fileType: ConfigurationFileType
  ): Promise<UnifiedValidationResult> {
    try {
      switch (fileType) {
        case 'memory':
          return await this.validationAdapter.validateMemoryFile(
            content,
            filePath
          );
        case 'settings':
          return await this.validationAdapter.validateSettingsFile(content);
        case 'command':
          return await this.validationAdapter.validateCommandFile(
            content,
            filePath
          );
        default:
          throw new ConfigurationServiceError(
            `Unsupported file type: ${fileType}`,
            ConfigurationErrorCode.INVALID_FILE_TYPE,
            filePath,
            fileType
          );
      }
    } catch (_error) {
      // If API validation fails, fall back to local validation
      return this.validateFileContent(content, filePath, fileType);
    }
  }

  /**
   * Batch validate multiple files
   */
  async validateMultipleFiles(
    files: Array<{
      content: string;
      path: string;
      type: ConfigurationFileType;
    }>
  ): Promise<
    Array<
      UnifiedValidationResult & {
        filePath: string;
        fileType: ConfigurationFileType;
      }
    >
  > {
    const results = await Promise.allSettled(
      files.map(file =>
        this.validateViaAPI(file.content, file.path, file.type).then(
          result => ({ ...result, filePath: file.path, fileType: file.type })
        )
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          valid: false,
          errors: [`Validation failed: ${result.reason}`],
          warnings: [],
          filePath: files[index].path,
          fileType: files[index].type,
        };
      }
    });
  }

  /**
   * Create file template with validation
   */
  async createFileTemplate(
    type: ConfigurationFileType,
    options: Record<string, any> = {}
  ): Promise<ConfigurationOperationResult> {
    try {
      const template = this.createTemplateForEndpoint(type, options);

      // Validate the template content
      const validation = await this.validateViaAPI(
        template.content,
        template.path,
        type
      );

      return {
        success: true,
        message: 'Template created successfully',
        filePath: template.path,
        fileType: type,
        data: {
          template,
          validation,
          valid: validation.valid,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create ${type} template`,
        fileType: type,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  // Private helper methods

  private async getFileHandle(filePath: string): Promise<FileHandle> {
    if (!this.projectHandle) {
      throw new Error('No project handle set');
    }

    const pathParts = filePath.split('/').filter(part => part.length > 0);
    let currentHandle: DirectoryHandle | FileHandle = this.projectHandle;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const isLastPart = i === pathParts.length - 1;

      if (currentHandle.kind === 'directory') {
        if (isLastPart) {
          currentHandle = await currentHandle.getFileHandle(part);
        } else {
          currentHandle = await currentHandle.getDirectoryHandle(part);
        }
      } else {
        throw new Error(`Cannot navigate into file: ${part}`);
      }
    }

    if (currentHandle.kind !== 'file') {
      throw new Error(`Expected file, got directory: ${filePath}`);
    }

    return currentHandle;
  }

  private async discoverClaudeFiles(
    rootHandle: DirectoryHandle
  ): Promise<any[]> {
    const files: any[] = [];

    try {
      // Look for .claude directory
      const claudeHandle = await rootHandle.getDirectoryHandle('.claude');
      const claudeFiles = await this.discoverClaudeDirectoryFiles(claudeHandle);
      files.push(...claudeFiles);
    } catch (_error) {
      // .claude directory doesn't exist, that's okay
    }

    try {
      // Look for CLAUDE.md files
      const memoryFiles = await this.discoverMemoryFiles(rootHandle);
      files.push(...memoryFiles);
    } catch (_error) {
      // No memory files found, that's okay
    }

    return files;
  }

  private async discoverClaudeDirectoryFiles(
    claudeHandle: DirectoryHandle
  ): Promise<any[]> {
    const files: any[] = [];

    for await (const [name, handle] of claudeHandle.values()) {
      if (handle.kind === 'file' && name.endsWith('.json')) {
        files.push({
          name,
          path: `.claude/${name}`,
          type: 'settings',
          handle,
        });
      } else if (handle.kind === 'directory' && name === 'commands') {
        const commandFiles = await this.discoverCommandFiles(
          handle as DirectoryHandle
        );
        files.push(...commandFiles);
      }
    }

    return files;
  }

  private async discoverMemoryFiles(
    rootHandle: DirectoryHandle
  ): Promise<any[]> {
    const files: any[] = [];

    try {
      const memoryHandle = await rootHandle.getFileHandle('CLAUDE.md');
      files.push({
        name: 'CLAUDE.md',
        path: 'CLAUDE.md',
        type: 'memory',
        handle: memoryHandle,
      });
    } catch (_error) {
      // CLAUDE.md doesn't exist
    }

    return files;
  }

  private async discoverCommandFiles(
    commandsHandle: DirectoryHandle
  ): Promise<any[]> {
    const files: any[] = [];

    for await (const [name, handle] of commandsHandle.values()) {
      if (handle.kind === 'file' && name.endsWith('.md')) {
        files.push({
          name,
          path: `.claude/commands/${name}`,
          type: 'command',
          handle,
        });
      } else if (handle.kind === 'directory') {
        const namespaceFiles = await this.discoverNamespaceFiles(
          handle as DirectoryHandle,
          name
        );
        files.push(...namespaceFiles);
      }
    }

    return files;
  }

  private async discoverNamespaceFiles(
    namespaceHandle: DirectoryHandle,
    namespacePath: string
  ): Promise<any[]> {
    const files: any[] = [];

    for await (const [name, handle] of namespaceHandle.values()) {
      if (handle.kind === 'file' && name.endsWith('.md')) {
        files.push({
          name,
          path: `.claude/commands/${namespacePath}/${name}`,
          type: 'command',
          namespace: namespacePath,
          handle,
        });
      } else if (handle.kind === 'directory') {
        const subNamespaceFiles = await this.discoverNamespaceFiles(
          handle as DirectoryHandle,
          `${namespacePath}/${name}`
        );
        files.push(...subNamespaceFiles);
      }
    }

    return files;
  }

  private validateFileContent(
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

  private createTemplateForEndpoint(
    fileType: ConfigurationFileType,
    options: Record<string, any> = {}
  ): any {
    switch (fileType) {
      case 'memory':
        return this.createMemoryTemplate(options.path);
      case 'settings':
        return this.createSettingsTemplate(options.type || 'project');
      case 'command':
        if (!options.name) {
          throw new Error('Command name is required for command template');
        }
        return this.createCommandTemplate(options.name, options.namespace);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }
}

/**
 * Create a client configuration service instance
 */
export function createClientConfigurationService(
  apiBaseUrl: string = '/api'
): ClientConfigurationService {
  return new ClientConfigurationServiceImpl(apiBaseUrl);
}
