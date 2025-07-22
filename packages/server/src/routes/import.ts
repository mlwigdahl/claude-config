import express from 'express';
import multer from 'multer';
import { ImportService } from '../services/importService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createError } from '../middleware/errorHandler.js';
import type { ImportOptions } from '@claude-config/shared';

const router = express.Router();

// Configure multer for file uploads (memory storage for archive processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for archive files
  },
  fileFilter: (req, file, cb) => {
    // Only allow ZIP files
    if (
      file.mimetype === 'application/zip' ||
      file.originalname.endsWith('.zip')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP archive files are allowed'));
    }
  },
});

/**
 * POST /api/import/preview
 * Preview import from archive without actually importing files
 */
router.post(
  '/preview',
  upload.single('archive'),
  asyncHandler(async (req, res) => {
    const { targetPath } = req.body;

    // Validate required parameters
    if (!targetPath || typeof targetPath !== 'string') {
      throw createError('Target path is required and must be a string', 400);
    }

    if (!req.file) {
      throw createError('Archive file is required', 400);
    }

    // Validate file is a ZIP archive
    if (
      !req.file.originalname.endsWith('.zip') &&
      req.file.mimetype !== 'application/zip'
    ) {
      throw createError('Only ZIP archive files are supported', 400);
    }

    // Preview the import
    const result = await ImportService.previewImport(
      req.file.buffer,
      targetPath
    );

    if (!result.success) {
      throw createError(result.error || 'Import preview failed', 500);
    }

    res.json(result);
  })
);

/**
 * POST /api/import
 * Import project files from archive
 */
router.post(
  '/',
  upload.single('archive'),
  asyncHandler(async (req, res) => {
    const { targetPath, options } = req.body;

    // Validate required parameters
    if (!targetPath || typeof targetPath !== 'string') {
      throw createError('Target path is required and must be a string', 400);
    }

    if (!req.file) {
      throw createError('Archive file is required', 400);
    }

    // Validate file is a ZIP archive
    if (
      !req.file.originalname.endsWith('.zip') &&
      req.file.mimetype !== 'application/zip'
    ) {
      throw createError('Only ZIP archive files are supported', 400);
    }

    // Parse and validate options
    let importOptions: ImportOptions;
    try {
      const parsedOptions = options ? JSON.parse(options) : {};
      importOptions = ImportService.validateOptions(parsedOptions);
    } catch (_error) {
      throw createError('Invalid import options format', 400);
    }

    // Perform import
    const result = await ImportService.importProject(
      req.file.buffer,
      targetPath,
      importOptions
    );

    if (!result.success) {
      throw createError(result.error || 'Import failed', 500);
    }

    res.json(result);
  })
);

/**
 * GET /api/import/defaults
 * Get default import options
 */
router.get(
  '/defaults',
  asyncHandler(async (req, res) => {
    const defaults = ImportService.getDefaultOptions();
    res.json(defaults);
  })
);

export default router;
