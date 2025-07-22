/**
 * File CRUD Service
 * Handles Create, Read, Update, Delete operations for configuration files
 * Integrates with both FileSystemService and FileOperationsService
 */

import { FileSystemService } from './fileSystemService';
import {
  FileOperationsService,
  FileValidationResult,
  FileAnalysis,
  FileProcessResult,
} from './fileOperationsService';

export interface CreateFileOptions {
  fileType: 'memory' | 'settings' | 'command';
  fileName?: string;
  directoryPath: string;
  templateOptions?: {
    name?: string;
    namespace?: string;
    type?: 'project' | 'user';
  };
}

export interface FileOperationResult {
  success: boolean;
  message: string;
  data?: {
    path?: string;
    name?: string;
    type?: 'memory' | 'settings' | 'command';
    content?: string;
    validation?: FileValidationResult;
    analysis?: FileAnalysis;
    processResult?: FileProcessResult;
    sourcePath?: string;
    targetPath?: string;
    note?: string;
    exists?: boolean;
  };
  error?: string;
}

export interface FileInfo {
  path: string;
  name: string;
  type: 'memory' | 'settings' | 'command';
  content: string;
  lastModified?: Date;
  size?: number;
}

export class FileCRUDService {
  /**
   * Create a new configuration file
   */
  static async createFile(
    options: CreateFileOptions
  ): Promise<FileOperationResult> {
    try {
      const { fileType, fileName, directoryPath, templateOptions } = options;

      // Generate appropriate file name if not provided
      let finalFileName = fileName;
      if (!finalFileName) {
        finalFileName = FileOperationsService.getDefaultFileName(fileType);
      }

      // Ensure file has correct extension
      const expectedExtension =
        FileOperationsService.getFileExtension(fileType);
      if (!finalFileName.endsWith(`.${expectedExtension}`)) {
        finalFileName = `${finalFileName}.${expectedExtension}`;
      }

      // Create the file path
      // Normalize path separators to forward slashes for cross-platform compatibility
      const normalizedDir = directoryPath.replace(/\\/g, '/');
      const filePath = `${normalizedDir}/${finalFileName}`.replace(/\/+/g, '/');

      // Check if file already exists
      const exists = await FileSystemService.fileExists(filePath);
      if (exists) {
        return {
          success: false,
          message: 'File already exists',
          error: `A file named ${finalFileName} already exists in ${directoryPath}`,
        };
      }

      // Create template content using the server API
      const template = await FileOperationsService.createTemplate(
        fileType,
        templateOptions
      );

      // Ensure template content is a string
      let templateContent: string;
      if (typeof template.template === 'string') {
        templateContent = template.template;
      } else if (
        typeof template.template === 'object' &&
        template.template !== null
      ) {
        // If template is an object, extract the content field (for structured templates)
        const templateObj = template.template as any;
        if (templateObj.content && typeof templateObj.content === 'string') {
          templateContent = templateObj.content;
        } else {
          // Fallback: stringify the entire object
          templateContent = JSON.stringify(template.template, null, 2);
        }
      } else {
        // Fallback to string conversion
        templateContent = String(template.template);
      }

      // Write the file using the file system service
      await FileSystemService.writeTextToFile(filePath, templateContent);

      // Validate the created file
      const validation = await FileOperationsService.validateFile(
        fileType,
        templateContent,
        filePath
      );

      return {
        success: true,
        message: 'File created successfully',
        data: {
          path: filePath,
          name: finalFileName,
          type: fileType,
          content: templateContent,
          validation,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create file',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Read a configuration file
   */
  static async readFile(filePath: string): Promise<FileOperationResult> {
    try {
      // Check if file exists
      const exists = await FileSystemService.fileExists(filePath);
      if (!exists) {
        return {
          success: false,
          message: 'File not found',
          error: `File ${filePath} does not exist`,
        };
      }

      // Read file content
      const content = await FileSystemService.readFileAsText(filePath);

      // Determine file type
      const fileType = FileOperationsService.getFileType(filePath);
      if (!fileType) {
        return {
          success: false,
          message: 'Unknown file type',
          error: `File ${filePath} is not a recognized configuration file type`,
        };
      }

      // For validation purposes, use the active file path (without .inactive)
      // since we're validating content, not the file state
      const fileName = filePath.split('/').pop() || '';
      const isInactive = fileName.endsWith('.inactive');
      const validationPath = isInactive
        ? filePath.replace('.inactive', '')
        : filePath;

      // Validate and analyze the file
      const validation = await FileOperationsService.validateFile(
        fileType,
        content,
        validationPath
      );
      const analysis = await FileOperationsService.analyzeFile(
        fileType,
        content,
        validationPath
      );

      return {
        success: true,
        message: 'File read successfully',
        data: {
          path: filePath,
          name: fileName,
          type: fileType,
          content,
          validation,
          analysis,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to read file',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Update a configuration file
   */
  static async updateFile(
    filePath: string,
    content: string
  ): Promise<FileOperationResult> {
    try {
      // Check if file exists
      const exists = await FileSystemService.fileExists(filePath);
      if (!exists) {
        return {
          success: false,
          message: 'File not found',
          error: `File ${filePath} does not exist`,
        };
      }

      // Determine file type
      const fileType = FileOperationsService.getFileType(filePath);
      if (!fileType) {
        return {
          success: false,
          message: 'Unknown file type',
          error: `File ${filePath} is not a recognized configuration file type`,
        };
      }

      // For validation purposes, use the active file path (without .inactive)
      const fileName = filePath.split('/').pop() || '';
      const isInactive = fileName.endsWith('.inactive');
      const validationPath = isInactive
        ? filePath.replace('.inactive', '')
        : filePath;

      // Validate content before saving
      const validation = await FileOperationsService.validateFile(
        fileType,
        content,
        validationPath
      );
      if (
        !validation.valid &&
        validation.errors &&
        validation.errors.length > 0
      ) {
        return {
          success: false,
          message: 'Validation failed',
          error: validation.errors.map(e => e.message).join(', '),
          data: { validation },
        };
      }

      // Process the file content using business logic
      const processResult = await FileOperationsService.processFile(
        fileType,
        content,
        validationPath
      );

      // Save the file
      await FileSystemService.writeTextToFile(filePath, content);

      // Re-validate and analyze the saved file
      const finalValidation = await FileOperationsService.validateFile(
        fileType,
        content,
        validationPath
      );
      const analysis = await FileOperationsService.analyzeFile(
        fileType,
        content,
        validationPath
      );

      return {
        success: true,
        message: 'File updated successfully',
        data: {
          path: filePath,
          content,
          validation: finalValidation,
          analysis,
          processResult,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update file',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Delete a configuration file
   */
  static async deleteFile(filePath: string): Promise<FileOperationResult> {
    try {
      // Check if file exists
      const exists = await FileSystemService.fileExists(filePath);
      if (!exists) {
        return {
          success: false,
          message: 'File not found',
          error: `File ${filePath} does not exist`,
        };
      }

      // Delete the file using the file system service
      await FileSystemService.deleteFile(filePath);

      const fileName = filePath.split('/').pop() || '';

      return {
        success: true,
        message: 'File deleted successfully',
        data: {
          path: filePath,
          name: fileName,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete file',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Copy a configuration file
   */
  static async copyFile(
    sourcePath: string,
    targetPath: string
  ): Promise<FileOperationResult> {
    try {
      // Check if source file exists
      const exists = await FileSystemService.fileExists(sourcePath);
      if (!exists) {
        return {
          success: false,
          message: 'Source file not found',
          error: `Source file ${sourcePath} does not exist`,
        };
      }

      // Check if target file already exists
      const targetExists = await FileSystemService.fileExists(targetPath);
      if (targetExists) {
        return {
          success: false,
          message: 'Target file already exists',
          error: `Target file ${targetPath} already exists`,
        };
      }

      // Read source file
      const content = await FileSystemService.readFileAsText(sourcePath);

      // Write to target location
      await FileSystemService.writeTextToFile(targetPath, content);

      // Validate the copied file
      const fileType = FileOperationsService.getFileType(targetPath);
      if (fileType) {
        const validation = await FileOperationsService.validateFile(
          fileType,
          content,
          targetPath
        );

        return {
          success: true,
          message: 'File copied successfully',
          data: {
            sourcePath,
            targetPath,
            validation,
          },
        };
      }

      return {
        success: true,
        message: 'File copied successfully',
        data: {
          sourcePath,
          targetPath,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to copy file',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Move/rename a configuration file
   */
  static async moveFile(
    sourcePath: string,
    targetPath: string
  ): Promise<FileOperationResult> {
    try {
      // First copy the file
      const copyResult = await this.copyFile(sourcePath, targetPath);
      if (!copyResult.success) {
        return copyResult;
      }

      // Then delete the original (when delete is implemented)
      // const deleteResult = await this.deleteFile(sourcePath);
      // if (!deleteResult.success) {
      //   // If delete fails, we should probably clean up the copied file
      //   return deleteResult;
      // }

      return {
        success: true,
        message: 'File moved successfully (delete not implemented)',
        data: {
          sourcePath,
          targetPath,
          note: 'Original file not deleted - delete functionality needs to be implemented',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to move file',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Batch validate multiple files
   */
  static async validateFiles(
    filePaths: string[]
  ): Promise<FileOperationResult> {
    try {
      const files = [];

      for (const filePath of filePaths) {
        const exists = await FileSystemService.fileExists(filePath);
        if (!exists) continue;

        const content = await FileSystemService.readFileAsText(filePath);
        const fileType = FileOperationsService.getFileType(filePath);

        if (fileType) {
          files.push({
            filePath,
            content,
            fileType,
          });
        }
      }

      if (files.length === 0) {
        return {
          success: false,
          message: 'No valid configuration files found',
          error: 'None of the provided paths contain valid configuration files',
        };
      }

      const batchResult = await FileOperationsService.validateBatch(files);

      return {
        success: true,
        message: 'Batch validation completed',
        data: batchResult,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to validate files',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get file information without reading full content
   */
  static async getFileInfo(filePath: string): Promise<FileOperationResult> {
    try {
      const exists = await FileSystemService.fileExists(filePath);
      if (!exists) {
        return {
          success: false,
          message: 'File not found',
          error: `File ${filePath} does not exist`,
        };
      }

      const fileType = FileOperationsService.getFileType(filePath);
      const fileName = filePath.split('/').pop() || '';

      return {
        success: true,
        message: 'File info retrieved successfully',
        data: {
          path: filePath,
          name: fileName,
          type: fileType,
          exists: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get file info',
        error: (error as Error).message,
      };
    }
  }
}
