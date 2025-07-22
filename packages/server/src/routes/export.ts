import express from 'express';
import { ExportService } from '../services/exportService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createError } from '../middleware/errorHandler.js';
import type { ExportOptions } from '@claude-config/shared';

const router = express.Router();

/**
 * POST /api/export
 * Export project files as archive
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { projectPath, options } = req.body;

    // Validate required parameters
    if (!projectPath || typeof projectPath !== 'string') {
      throw createError('Project path is required and must be a string', 400);
    }

    // Validate and normalize options
    const exportOptions: ExportOptions = ExportService.validateOptions(
      options || {}
    );

    // Perform export
    const result = await ExportService.exportProject(
      projectPath,
      exportOptions
    );

    if (!result.success) {
      throw createError(result.error || 'Export failed', 500);
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`
    );
    res.setHeader('Content-Length', result.data?.length || 0);

    // Send the archive data
    res.send(result.data);
  })
);

/**
 * GET /api/export/defaults
 * Get default export options
 */
router.get(
  '/defaults',
  asyncHandler(async (req, res) => {
    const defaults = ExportService.getDefaultOptions();
    res.json(defaults);
  })
);

export default router;
