// Re-export core types from the business logic library
export * from '@core/types/memory.js';
export * from '@core/types/settings.js';
export * from '@core/types/commands.js';
export * from '@core/types/hooks.js';

// FileSystemService types are no longer needed in the UI layer
// as we've moved to server-side file operations

// App-specific types for the UI
export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  fileType?: 'memory' | 'settings' | 'command';
  isInactive?: boolean;
  isValid?: boolean;
  children?: FileTreeNode[];
  isExpanded?: boolean;
  isSelected?: boolean;
  depth: number;
  parentId?: string;
  // handle removed - now using server-side paths
  lastModified?: Date;
  size?: number;
  hasChildren?: boolean;
}

export interface FileInfo {
  id: string;
  name: string;
  path: string;
  type: 'memory' | 'settings' | 'command';
  isInactive?: boolean;
  content?: string;
  exists: boolean;
  lastModified?: Date;
  size?: number;
}

export interface HookInfo {
  id: string;
  eventType: string;
  pattern: string;
  command: string;
  timeout?: number;
  description?: string;
}

export interface ErrorInfo {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  type: 'error' | 'warning';
}

export interface InfoMessage {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  type: 'info' | 'success';
}

export interface Operation {
  id: string;
  type: 'create' | 'read' | 'update' | 'delete' | 'move';
  target: string;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

export interface TreeSearchOptions {
  query: string;
  includeFiles?: boolean;
  includeDirectories?: boolean;
  fileTypes?: ('memory' | 'settings' | 'command')[];
  caseSensitive?: boolean;
}

export interface TreeBuildOptions {
  maxDepth?: number;
  includeHidden?: boolean;
  autoExpand?: boolean;
  expandDepth?: number;
  forceRefresh?: boolean;
}

export interface FileDiscoveryResult {
  tree: FileTreeNode[];
  totalFiles: number;
  totalDirectories: number;
  configurationFiles: {
    memory: number;
    settings: number;
    command: number;
  };
  projectRootPath?: string;
}

export interface TreeOperationResult {
  success: boolean;
  message: string;
  node?: FileTreeNode;
  error?: string;
}
