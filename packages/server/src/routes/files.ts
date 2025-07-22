import { Router, Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler.js';
import {
  serverConfigurationService,
  ConfigurationFileType,
} from '@claude-config/core';

const router = Router();

/**
 * POST /api/files/create-template
 * Create empty template content for different file types
 */
router.post(
  '/create-template',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileType, name, namespace, type } = req.body;

      if (!fileType) {
        throw createError(
          'Missing required field: fileType',
          400,
          'MISSING_FILE_TYPE'
        );
      }

      // Validate file type
      if (!['memory', 'settings', 'command'].includes(fileType)) {
        throw createError(
          `Invalid file type: ${fileType}`,
          400,
          'INVALID_FILE_TYPE'
        );
      }

      const options: Record<string, any> = {};

      if (fileType === 'command') {
        if (!name) {
          throw createError(
            'Command name is required for command templates',
            400,
            'MISSING_COMMAND_NAME'
          );
        }
        options.name = name;
        options.namespace = namespace;
      } else if (fileType === 'settings') {
        options.type = type || 'project';
      } else if (fileType === 'memory') {
        options.path = name;
      }

      const template = serverConfigurationService.createTemplateForEndpoint(
        fileType as ConfigurationFileType,
        options
      );

      res.json({
        success: true,
        message: 'Template created successfully',
        data: {
          fileType,
          template,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/files/process
 * Process file content using business logic
 */
router.post(
  '/process',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileType, content, filePath } = req.body;

      if (!fileType || content === undefined) {
        throw createError(
          'Missing required fields: fileType, content',
          400,
          'MISSING_FIELDS'
        );
      }

      // Validate file type
      if (!['memory', 'settings', 'command'].includes(fileType)) {
        throw createError(
          `Invalid file type: ${fileType}`,
          400,
          'INVALID_FILE_TYPE'
        );
      }

      let result;

      switch (fileType) {
        case 'memory':
          result = serverConfigurationService.processMemoryFile({
            content,
            path: filePath || 'CLAUDE.md',
          });
          break;

        case 'settings':
          result = serverConfigurationService.processSettingsFile({
            content,
            path: filePath || 'settings.json',
          });
          break;

        case 'command':
          result = serverConfigurationService.processCommandFile({
            content,
            path: filePath || 'command.md',
          });
          break;

        default:
          throw createError(
            `Unsupported file type: ${fileType}`,
            400,
            'INVALID_FILE_TYPE'
          );
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/files/validate
 * Validate file content
 */
router.post(
  '/validate',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileType, content, filePath } = req.body;

      if (!fileType || content === undefined) {
        throw createError(
          'Missing required fields: fileType, content',
          400,
          'MISSING_FIELDS'
        );
      }

      // Validate file type
      if (!['memory', 'settings', 'command'].includes(fileType)) {
        throw createError(
          `Invalid file type: ${fileType}`,
          400,
          'INVALID_FILE_TYPE'
        );
      }

      const validation = serverConfigurationService.validateFileContent(
        content,
        filePath || `example.${fileType === 'settings' ? 'json' : 'md'}`,
        fileType as ConfigurationFileType
      );

      res.json({
        success: true,
        message: validation.valid
          ? 'File validation passed'
          : 'File validation failed',
        data: validation,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/files/analyze
 * Analyze file content and provide insights
 */
router.post(
  '/analyze',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { fileType, content, filePath } = req.body;

      if (!fileType || content === undefined) {
        throw createError(
          'Missing required fields: fileType, content',
          400,
          'MISSING_FIELDS'
        );
      }

      // Validate file type
      if (!['memory', 'settings', 'command'].includes(fileType)) {
        throw createError(
          `Invalid file type: ${fileType}`,
          400,
          'INVALID_FILE_TYPE'
        );
      }

      const summary = serverConfigurationService.generateFileInfoSummary(
        content,
        filePath || `example.${fileType === 'settings' ? 'json' : 'md'}`,
        fileType as ConfigurationFileType
      );

      res.json({
        success: true,
        message: 'File analysis completed',
        data: {
          analysis: summary,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/files/validate-batch
 * Validate multiple files in batch
 */
router.post(
  '/validate-batch',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { files } = req.body;

      if (!files || !Array.isArray(files)) {
        throw createError(
          'Missing required field: files (array)',
          400,
          'MISSING_FILES'
        );
      }

      const validationResults =
        serverConfigurationService.validateMultipleFiles(files);

      res.json({
        success: true,
        message: 'Batch validation completed',
        data: {
          results: validationResults,
          totalFiles: files.length,
          validFiles: validationResults.filter(r => r.valid).length,
          invalidFiles: validationResults.filter(r => !r.valid).length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/files/templates-batch
 * Create multiple templates in batch
 */
router.post(
  '/templates-batch',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { requests } = req.body;

      if (!requests || !Array.isArray(requests)) {
        throw createError(
          'Missing required field: requests (array)',
          400,
          'MISSING_REQUESTS'
        );
      }

      const templates =
        serverConfigurationService.createMultipleTemplates(requests);

      res.json({
        success: true,
        message: 'Batch template creation completed',
        data: {
          templates,
          count: templates.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as filesRouter };
