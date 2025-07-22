import { Router, Request, Response, NextFunction } from 'express';
import { createError } from '../middleware/errorHandler.js';
import { FileSystemService } from '../services/fileSystemService.js';
import { validatePath } from '../utils/pathValidator.js';

const router = Router();
const fileSystemService = new FileSystemService();

interface FileWriteRequest {
  path: string;
  content: string;
}

interface DirectoryCreateRequest {
  path: string;
}

interface SearchRequest {
  rootPath: string;
  pattern: string;
  includeHidden?: boolean;
}

interface RenameRequest {
  oldPath: string;
  newPath: string;
}

interface SwitchSettingsTypeRequest {
  filePath: string;
}

// List directory contents
router.get(
  '/directory',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { path, includeHidden = false } = req.query as {
        path: string;
        includeHidden?: string;
      };

      if (!path) {
        return next(createError('Path is required', 400));
      }

      // Validate and sanitize path
      const validatedPath = validatePath(path);

      const contents = await fileSystemService.listDirectory(validatedPath, {
        includeHidden: includeHidden === 'true',
      });

      res.json({
        success: true,
        data: contents,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Read file content
router.get('/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path } = req.query as { path: string };

    if (!path) {
      return next(createError('Path is required', 400));
    }

    // Validate and sanitize path
    const validatedPath = validatePath(path);

    const content = await fileSystemService.readFile(validatedPath);

    res.json({
      success: true,
      data: { content },
    });
  } catch (error) {
    next(error);
  }
});

// Create or update file
router.post(
  '/file',
  async (
    req: Request<Record<string, never>, unknown, FileWriteRequest>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { path, content } = req.body;

      if (!path) {
        return next(createError('Path is required', 400));
      }

      if (content === undefined) {
        return next(createError('Content is required', 400));
      }

      // Validate and sanitize path
      const validatedPath = validatePath(path);

      await fileSystemService.writeFile(validatedPath, content);

      res.json({
        success: true,
        message: 'File written successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete file
router.delete(
  '/file',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { path } = req.query as { path: string };

      if (!path) {
        return next(createError('Path is required', 400));
      }

      // Validate and sanitize path
      const validatedPath = validatePath(path);

      await fileSystemService.deleteFile(validatedPath);

      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Rename file
router.post(
  '/rename',
  async (
    req: Request<Record<string, never>, unknown, RenameRequest>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { oldPath, newPath } = req.body;

      if (!oldPath) {
        return next(createError('Old path is required', 400));
      }

      if (!newPath) {
        return next(createError('New path is required', 400));
      }

      // Validate and sanitize paths
      const validatedOldPath = validatePath(oldPath);
      const validatedNewPath = validatePath(newPath);

      await fileSystemService.renameFile(validatedOldPath, validatedNewPath);

      res.json({
        success: true,
        message: 'File renamed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Switch settings file type
router.post(
  '/switch-settings-type',
  async (
    req: Request<Record<string, never>, unknown, SwitchSettingsTypeRequest>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        return next(createError('File path is required', 400));
      }

      // Validate and sanitize path
      const validatedPath = validatePath(filePath);

      const result =
        await fileSystemService.switchSettingsFileType(validatedPath);

      res.json({
        success: true,
        message: 'Settings file type switched successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create directory
router.post(
  '/directory',
  async (
    req: Request<Record<string, never>, unknown, DirectoryCreateRequest>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { path } = req.body;

      if (!path) {
        return next(createError('Path is required', 400));
      }

      // Validate and sanitize path
      const validatedPath = validatePath(path);

      await fileSystemService.createDirectory(validatedPath);

      res.json({
        success: true,
        message: 'Directory created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Search files
router.post(
  '/search',
  async (
    req: Request<Record<string, never>, unknown, SearchRequest>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { rootPath, pattern, includeHidden = false } = req.body;

      if (!rootPath) {
        return next(createError('Root path is required', 400));
      }

      if (!pattern) {
        return next(createError('Search pattern is required', 400));
      }

      // Validate and sanitize path
      const validatedPath = validatePath(rootPath);

      const results = await fileSystemService.searchFiles(
        validatedPath,
        pattern,
        {
          includeHidden,
        }
      );

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get file tree
router.get('/tree', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      path,
      maxDepth = '10',
      includeHidden = 'false',
    } = req.query as {
      path: string;
      maxDepth?: string;
      includeHidden?: string;
    };

    if (!path) {
      return next(createError('Path is required', 400));
    }

    // Validate and sanitize path
    const validatedPath = validatePath(path);

    const tree = await fileSystemService.getFileTree(validatedPath, {
      maxDepth: parseInt(maxDepth, 10),
      includeHidden: includeHidden === 'true',
    });

    res.json({
      success: true,
      data: tree,
    });
  } catch (error) {
    next(error);
  }
});

// List project files with filtering
router.get(
  '/project-files',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectRoot, rootPath } = req.query as {
        projectRoot: string;
        rootPath: string;
      };

      if (!projectRoot) {
        return next(createError('Project root is required', 400));
      }

      if (!rootPath) {
        return next(createError('Root path is required', 400));
      }

      // Validate and sanitize paths
      const validatedProjectRoot = validatePath(projectRoot);
      const validatedRootPath = validatePath(rootPath);

      const result = await fileSystemService.listProjectFiles(
        validatedProjectRoot,
        validatedRootPath
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get filtered file tree
router.get(
  '/filtered-tree',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectRoot, rootPath } = req.query as {
        projectRoot: string;
        rootPath: string;
      };

      if (!projectRoot) {
        return next(createError('Project root is required', 400));
      }

      if (!rootPath) {
        return next(createError('Root path is required', 400));
      }

      // Validate and sanitize paths
      const validatedProjectRoot = validatePath(projectRoot);
      const validatedRootPath = validatePath(rootPath);

      const result = await fileSystemService.buildFilteredFileTree(
        validatedProjectRoot,
        validatedRootPath
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get default directory (cross-platform home directory)
router.get(
  '/default-directory',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const defaultDir = await fileSystemService.getDefaultDirectory();

      res.json({
        success: true,
        data: {
          defaultDirectory: defaultDir.defaultDirectory,
          homeDirectory: defaultDir.homeDirectory,
          platform: defaultDir.platform,
          drives: defaultDir.drives,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as filesystemRouter };
