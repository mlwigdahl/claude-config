import request from 'supertest';
import express from 'express';
import { ExportService } from '../../services/exportService.js';
import exportRouter from '../export.js';

// Mock dependencies to prevent import issues
jest.mock('archiver', () => jest.fn());
jest.mock('@claude-config/core', () => ({
  ConsolidatedFileSystem: {},
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }),
}));
jest.mock('../../services/configurationService.js', () => ({
  ConfigurationServiceAPI: {},
}));

// Mock middleware
jest.mock('../../middleware/asyncHandler.js', () => ({
  asyncHandler: (fn: any) => (req: any, res: any, next: any) => {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') {
        return result.catch(next);
      }
      return result;
    } catch (error) {
      return next(error);
    }
  },
}));

jest.mock('../../middleware/errorHandler.js', () => ({
  createError: (message: string, status: number) => {
    const error = new Error(message);
    (error as any).status = status;
    return error;
  },
}));

// Mock the ExportService
jest.mock('../../services/exportService.js');
const mockedExportService = ExportService as jest.Mocked<typeof ExportService>;

describe('Export Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/export', exportRouter);
    
    // Add error handling middleware
    app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(error.status || 500).json({
        error: error.message || 'Internal Server Error'
      });
    });
    
    jest.clearAllMocks();
  });

  describe('POST /api/export', () => {
    const testProjectPath = '/test/project';
    const mockBuffer = Buffer.from('mock-zip-data');

    it('should export project successfully', async () => {
      mockedExportService.validateOptions.mockReturnValue({
        memoryFiles: 'all',
        settingsFiles: 'both',
        commandFiles: true,
        includeInactive: false,
        recursive: true,
        format: 'zip',
        includeUserPath: false
      });

      mockedExportService.exportProject.mockResolvedValue({
        success: true,
        filename: 'project-export.zip',
        data: mockBuffer,
        fileCount: 5
      });

      const response = await request(app)
        .post('/api/export')
        .send({
          projectPath: testProjectPath,
          options: {
            memoryFiles: 'all',
            settingsFiles: 'both'
          }
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/zip');
      expect(response.headers['content-disposition']).toBe('attachment; filename="project-export.zip"');
      expect(response.body).toBeDefined();
    });

    it('should return 400 for missing project path', async () => {
      const response = await request(app)
        .post('/api/export')
        .send({
          options: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Project path is required and must be a string');
    });

    it('should return 400 for invalid project path type', async () => {
      const response = await request(app)
        .post('/api/export')
        .send({
          projectPath: 123,
          options: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Project path is required and must be a string');
    });

    it('should return 500 for export failure', async () => {
      mockedExportService.validateOptions.mockReturnValue({
        memoryFiles: 'all',
        settingsFiles: 'both',
        commandFiles: true,
        includeInactive: false,
        recursive: true,
        format: 'zip',
        includeUserPath: false
      });

      mockedExportService.exportProject.mockResolvedValue({
        success: false,
        error: 'Export failed: Project not found',
        fileCount: 0
      });

      const response = await request(app)
        .post('/api/export')
        .send({
          projectPath: testProjectPath,
          options: {}
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Export failed: Project not found');
    });

    it('should use default options when none provided', async () => {
      const defaultOptions = {
        memoryFiles: 'all' as const,
        settingsFiles: 'both' as const,
        commandFiles: true,
        includeInactive: false,
        recursive: true,
        format: 'zip' as const,
        includeUserPath: false
      };

      mockedExportService.validateOptions.mockReturnValue(defaultOptions);
      mockedExportService.exportProject.mockResolvedValue({
        success: true,
        filename: 'project-export.zip',
        data: mockBuffer,
        fileCount: 3
      });

      const response = await request(app)
        .post('/api/export')
        .send({
          projectPath: testProjectPath
        });

      expect(response.status).toBe(200);
      expect(mockedExportService.validateOptions).toHaveBeenCalledWith({});
      expect(mockedExportService.exportProject).toHaveBeenCalledWith(
        testProjectPath,
        defaultOptions
      );
    });
  });

  describe('GET /api/export/defaults', () => {
    it('should return default export options', async () => {
      const defaultOptions = {
        memoryFiles: 'all' as const,
        settingsFiles: 'both' as const,
        commandFiles: true,
        includeInactive: false,
        recursive: true,
        format: 'zip' as const,
        includeUserPath: false
      };

      mockedExportService.getDefaultOptions.mockReturnValue(defaultOptions);

      const response = await request(app)
        .get('/api/export/defaults');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(defaultOptions);
    });
  });
});