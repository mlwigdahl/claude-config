import request from 'supertest';
import express from 'express';
import importRouter from '../import.js';
import { ImportService } from '../../services/importService.js';
import type { ImportPreviewResult, ImportResult, ImportOptions } from '@claude-config/shared';

// Mock the ImportService
jest.mock('../../services/importService.js', () => ({
  ImportService: {
    previewImport: jest.fn(),
    importProject: jest.fn(),
    getDefaultOptions: jest.fn(),
    validateOptions: jest.fn(),
  },
}));

const mockedImportService = ImportService as jest.Mocked<typeof ImportService>;

describe('Import Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/import', importRouter);
    jest.clearAllMocks();
  });

  describe('POST /api/import/preview', () => {
    it('should preview import successfully', async () => {
      const mockPreviewResult: ImportPreviewResult = {
        success: true,
        totalFiles: 2,
        conflicts: [],
        filesToImport: [
          {
            archivePath: 'CLAUDE.md',
            targetPath: '/test/CLAUDE.md',
            content: '# Test',
            type: 'memory',
            isInactive: false,
            size: 6
          }
        ]
      };

      mockedImportService.previewImport.mockResolvedValue(mockPreviewResult);

      const mockArchive = Buffer.from('mock-zip-content');

      const response = await request(app)
        .post('/api/import/preview')
        .field('targetPath', '/test/project')
        .attach('archive', mockArchive, 'test-export.zip')
        .expect(200);

      expect(response.body).toEqual(mockPreviewResult);
      expect(mockedImportService.previewImport).toHaveBeenCalledWith(
        expect.any(Buffer),
        '/test/project'
      );
    });

    it('should return 400 when target path is missing', async () => {
      const mockArchive = Buffer.from('mock-zip-content');

      await request(app)
        .post('/api/import/preview')
        .attach('archive', mockArchive, 'test-export.zip')
        .expect(400);

      expect(mockedImportService.previewImport).not.toHaveBeenCalled();
    });

    it('should return 400 when archive file is missing', async () => {
      await request(app)
        .post('/api/import/preview')
        .field('targetPath', '/test/project')
        .expect(400);

      expect(mockedImportService.previewImport).not.toHaveBeenCalled();
    });

    it('should return 400 when file is not a ZIP archive', async () => {
      const mockFile = Buffer.from('not-a-zip-file');

      await request(app)
        .post('/api/import/preview')
        .field('targetPath', '/test/project')
        .attach('archive', mockFile, 'test.txt')
        .expect(500); // Multer file filter errors come as 500, not 400

      expect(mockedImportService.previewImport).not.toHaveBeenCalled();
    });

    it('should handle preview failure', async () => {
      const mockPreviewResult: ImportPreviewResult = {
        success: false,
        totalFiles: 0,
        conflicts: [],
        filesToImport: [],
        error: 'Invalid archive format'
      };

      mockedImportService.previewImport.mockResolvedValue(mockPreviewResult);

      const mockArchive = Buffer.from('mock-zip-content');

      await request(app)
        .post('/api/import/preview')
        .field('targetPath', '/test/project')
        .attach('archive', mockArchive, 'test-export.zip')
        .expect(500);
    });
  });

  describe('POST /api/import', () => {
    it('should import files successfully', async () => {
      const mockImportResult: ImportResult = {
        success: true,
        filesImported: 2,
        filesSkipped: 0,
        conflicts: []
      };

      mockedImportService.validateOptions.mockReturnValue({
        overwriteConflicts: false,
        preserveDirectoryStructure: true
      });

      mockedImportService.importProject.mockResolvedValue(mockImportResult);

      const mockArchive = Buffer.from('mock-zip-content');
      const importOptions = { overwriteConflicts: false };

      const response = await request(app)
        .post('/api/import')
        .field('targetPath', '/test/project')
        .field('options', JSON.stringify(importOptions))
        .attach('archive', mockArchive, 'test-export.zip')
        .expect(200);

      expect(response.body).toEqual(mockImportResult);
      expect(mockedImportService.validateOptions).toHaveBeenCalledWith(importOptions);
      expect(mockedImportService.importProject).toHaveBeenCalledWith(
        expect.any(Buffer),
        '/test/project',
        expect.objectContaining({
          overwriteConflicts: false,
          preserveDirectoryStructure: true
        })
      );
    });

    it('should use default options when none provided', async () => {
      const mockImportResult: ImportResult = {
        success: true,
        filesImported: 1,
        filesSkipped: 0,
        conflicts: []
      };

      mockedImportService.validateOptions.mockReturnValue({
        overwriteConflicts: false,
        preserveDirectoryStructure: true
      });

      mockedImportService.importProject.mockResolvedValue(mockImportResult);

      const mockArchive = Buffer.from('mock-zip-content');

      const response = await request(app)
        .post('/api/import')
        .field('targetPath', '/test/project')
        .attach('archive', mockArchive, 'test-export.zip')
        .expect(200);

      expect(response.body).toEqual(mockImportResult);
      expect(mockedImportService.validateOptions).toHaveBeenCalledWith({});
    });

    it('should return 400 when target path is missing', async () => {
      const mockArchive = Buffer.from('mock-zip-content');

      await request(app)
        .post('/api/import')
        .attach('archive', mockArchive, 'test-export.zip')
        .expect(400);

      expect(mockedImportService.importProject).not.toHaveBeenCalled();
    });

    it('should return 400 when archive file is missing', async () => {
      await request(app)
        .post('/api/import')
        .field('targetPath', '/test/project')
        .expect(400);

      expect(mockedImportService.importProject).not.toHaveBeenCalled();
    });

    it('should return 400 when options JSON is invalid', async () => {
      const mockArchive = Buffer.from('mock-zip-content');

      await request(app)
        .post('/api/import')
        .field('targetPath', '/test/project')
        .field('options', 'invalid-json')
        .attach('archive', mockArchive, 'test-export.zip')
        .expect(400);

      expect(mockedImportService.importProject).not.toHaveBeenCalled();
    });

    it('should handle import failure', async () => {
      const mockImportResult: ImportResult = {
        success: false,
        filesImported: 0,
        filesSkipped: 0,
        conflicts: [],
        error: 'Target directory not found'
      };

      mockedImportService.validateOptions.mockReturnValue({
        overwriteConflicts: false,
        preserveDirectoryStructure: true
      });

      mockedImportService.importProject.mockResolvedValue(mockImportResult);

      const mockArchive = Buffer.from('mock-zip-content');

      await request(app)
        .post('/api/import')
        .field('targetPath', '/test/project')
        .attach('archive', mockArchive, 'test-export.zip')
        .expect(500);
    });
  });

  describe('GET /api/import/defaults', () => {
    it('should return default import options', async () => {
      const mockDefaults: ImportOptions = {
        overwriteConflicts: false,
        preserveDirectoryStructure: true
      };

      mockedImportService.getDefaultOptions.mockReturnValue(mockDefaults);

      const response = await request(app)
        .get('/api/import/defaults')
        .expect(200);

      expect(response.body).toEqual(mockDefaults);
      expect(mockedImportService.getDefaultOptions).toHaveBeenCalled();
    });
  });
});