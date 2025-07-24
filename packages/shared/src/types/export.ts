export interface ExportOptions {
  // Memory file options
  memoryFiles: 'all' | 'claude-only' | 'none';

  // Settings file options
  settingsFiles: 'both' | 'project-only' | 'none';

  // Command files - always included when found
  commandFiles: boolean;

  // Include inactive files (.inactive suffix)
  includeInactive: boolean;

  // Recurse into subdirectories
  recursive: boolean;

  // Archive format (for future extensibility)
  format: 'zip';

  // Include user path files from ~/.claude
  includeUserPath: boolean;

  // Selected files to export (optional - if not provided, all matching files are exported)
  selectedFiles?: string[]; // Array of file paths
}

export interface ExportResult {
  success: boolean;
  filename?: string;
  data?: Buffer;
  error?: string;
  fileCount?: number;
}

export interface ExportFileEntry {
  sourcePath: string; // Absolute path in filesystem
  archivePath: string; // Path within archive
  type: 'memory' | 'settings' | 'command';
  isInactive: boolean;
  source: 'project' | 'user'; // Whether from project path or user path
}

export interface ImportFileEntry {
  archivePath: string; // Path within archive
  targetPath: string; // Target path in filesystem
  content: string; // File content from archive
  type: 'memory' | 'settings' | 'command';
  isInactive: boolean;
  size: number; // Size in bytes
  source: 'project' | 'user'; // Whether from project path or user path
}

export interface ImportConflict {
  archivePath: string; // Path within archive
  targetPath: string; // Target path in filesystem
  existingSize: number; // Size of existing file
  newSize: number; // Size of file in archive
  existingModified: Date; // Last modified date of existing file
  type: 'memory' | 'settings' | 'command';
  isInactive: boolean;
  source: 'project' | 'user'; // Whether from project path or user path
}

export interface ImportPreviewResult {
  success: boolean;
  totalFiles: number;
  conflicts: ImportConflict[];
  filesToImport: ImportFileEntry[];
  error?: string;
}

export interface ImportOptions {
  overwriteConflicts: boolean;
  preserveDirectoryStructure: boolean;
  includeUserPath: boolean; // Whether to import user path files
  selectedFiles?: string[]; // Array of archive paths to import (optional - if not provided, all files are imported)
}

export interface ImportResult {
  success: boolean;
  filesImported: number;
  filesSkipped: number;
  conflicts: ImportConflict[];
  error?: string;
}
