import request from 'supertest';
import express from 'express';
import { filesRouter } from '../files.js';

// Mock the core configuration service
jest.mock('@claude-config/core', () => ({
  serverConfigurationService: {
    validateFileContent: jest.fn().mockReturnValue({ valid: true }),
    generateFileInfoSummary: jest.fn().mockReturnValue({ summary: 'Empty file' }),
    processMemoryFile: jest.fn().mockReturnValue({ processed: true }),
    processSettingsFile: jest.fn().mockReturnValue({ processed: true }),
    processCommandFile: jest.fn().mockReturnValue({ processed: true }),
  },
}));

describe('Files Routes - Empty Content Handling', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/files', filesRouter);
    jest.clearAllMocks();
  });

  describe('POST /api/files/analyze', () => {
    it('should handle empty content correctly', async () => {
      const response = await request(app)
        .post('/api/files/analyze')
        .send({
          fileType: 'memory',
          content: '', // Empty content should be valid
          filePath: '/test/empty.md'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('File analysis completed');
    });

    it('should reject undefined content', async () => {
      await request(app)
        .post('/api/files/analyze')
        .send({
          fileType: 'memory',
          // content is undefined
          filePath: '/test/file.md'
        })
        .expect(400);
    });

    it('should reject missing fileType', async () => {
      await request(app)
        .post('/api/files/analyze')
        .send({
          content: 'some content',
          filePath: '/test/file.md'
        })
        .expect(400);
    });
  });

  describe('POST /api/files/validate', () => {
    it('should handle empty content correctly', async () => {
      const response = await request(app)
        .post('/api/files/validate')
        .send({
          fileType: 'memory',
          content: '', // Empty content should be valid
          filePath: '/test/empty.md'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject undefined content', async () => {
      await request(app)
        .post('/api/files/validate')
        .send({
          fileType: 'memory',
          // content is undefined
          filePath: '/test/file.md'
        })
        .expect(400);
    });
  });

  describe('POST /api/files/process', () => {
    it('should handle empty content correctly', async () => {
      await request(app)
        .post('/api/files/process')
        .send({
          fileType: 'memory',
          content: '', // Empty content should be valid
          filePath: '/test/empty.md'
        })
        .expect(200);
    });

    it('should reject undefined content', async () => {
      await request(app)
        .post('/api/files/process')
        .send({
          fileType: 'memory',
          // content is undefined
          filePath: '/test/file.md'
        })
        .expect(400);
    });
  });
});