/**
 * File System service that uses server-side HTTP API
 * Replaces browser File System Access API with server calls
 */

import type {
  FileTreeNode,
  TreeBuildOptions,
  FileDiscoveryResult,
  TreeSearchOptions,
} from '../types/index';
import { FileOperationsService } from './fileOperationsService';

// API base URL - hardcoded for now to avoid build issues
// TODO: Make this configurable via environment variables when needed
const API_BASE_URL = 'http://localhost:5001';

export interface DirectoryEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: Date;
  fileType?: 'memory' | 'settings' | 'command';
  isInactive?: boolean;
  isValid?: boolean;
}

export interface DefaultDirectoryInfo {
  defaultDirectory: string;
  homeDirectory: string;
  platform: string;
  drives?: string[];
}

export interface FileTreeNodeServer {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNodeServer[];
  size?: number;
  lastModified?: Date;
  fileType?: 'memory' | 'settings' | 'command';
  isInactive?: boolean;
  isValid?: boolean;
}

export class FileSystemService {
  /**
   * Check if server-side file system is available
   */
  static async isSupported(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get default directory for the current platform
   */
  static async getDefaultDirectory(): Promise<DefaultDirectoryInfo> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filesystem/default-directory`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get default directory');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      throw new Error(`Failed to get default directory: ${(error as Error).message}`);
    }
  }

  /**
   * Select a directory by providing a path
   */
  static async selectDirectory(defaultPath?: string): Promise<string> {
    // Since we can't use browser directory picker, we'll use a simple prompt
    // In a real implementation, you'd want a better UI for this
    const path = prompt('Enter directory path:', defaultPath || '/');

    if (!path) {
      throw new Error('Directory selection was cancelled');
    }

    // Verify the directory exists
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/filesystem/directory?${new URLSearchParams({ path })}`
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Invalid directory');
      }
      return path;
    } catch (error) {
      throw new Error(
        `Failed to select directory: ${(error as Error).message}`
      );
    }
  }

  /**
   * Read file content as text
   */
  static async readFileAsText(filePath: string): Promise<string> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/filesystem/file?${new URLSearchParams({ path: filePath })}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to read file');
      }

      const data = await response.json();
      return data.data.content;
    } catch (error) {
      throw new Error(`Failed to read file: ${(error as Error).message}`);
    }
  }

  /**
   * Write text content to file
   */
  static async writeTextToFile(
    filePath: string,
    content: string
  ): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filesystem/file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath, content }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to write file');
      }
    } catch (error) {
      throw new Error(`Failed to write file: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new file in directory
   */
  static async createFile(
    directoryPath: string,
    fileName: string,
    content: string = ''
  ): Promise<string> {
    // Normalize path separators to forward slashes for cross-platform compatibility
    const normalizedDir = directoryPath.replace(/\\/g, '/');
    const filePath = `${normalizedDir}/${fileName}`.replace(/\/+/g, '/');
    await this.writeTextToFile(filePath, content);
    return filePath;
  }

  /**
   * Check if file exists
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/filesystem/file?${new URLSearchParams({ path: filePath })}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if directory exists
   */
  static async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/filesystem/directory?${new URLSearchParams({ path: dirPath })}`
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List all files and directories in a directory
   */
  static async listDirectory(directoryPath: string): Promise<DirectoryEntry[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/filesystem/directory?${new URLSearchParams({ path: directoryPath })}`
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to list directory');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      throw new Error(`Failed to list directory: ${(error as Error).message}`);
    }
  }

  /**
   * Create directory
   */
  static async createDirectory(dirPath: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filesystem/directory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: dirPath }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create directory');
      }
    } catch (error) {
      throw new Error(
        `Failed to create directory: ${(error as Error).message}`
      );
    }
  }

  /**
   * Delete a file
   */
  static async deleteFile(filePath: string): Promise<void> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/filesystem/file?${new URLSearchParams({ path: filePath })}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete file');
      }
    } catch (error) {
      throw new Error(`Failed to delete file: ${(error as Error).message}`);
    }
  }

  /**
   * Rename a file
   */
  static async renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/filesystem/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ oldPath, newPath }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to rename file');
      }
    } catch (error) {
      throw new Error(`Failed to rename file: ${(error as Error).message}`);
    }
  }

  /**
   * Switch settings file type between project and local
   */
  static async switchSettingsFileType(
    filePath: string
  ): Promise<{ newPath: string; newType: 'project' | 'local' }> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/filesystem/switch-settings-type`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filePath }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to switch settings file type');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      throw new Error(
        `Failed to switch settings file type: ${(error as Error).message}`
      );
    }
  }

  /**
   * Deactivate a configuration file by adding .inactive extension
   */
  static async deactivateFile(filePath: string): Promise<string> {
    if (filePath.endsWith('.inactive')) {
      throw new Error('File is already inactive');
    }

    const newPath = `${filePath}.inactive`;

    // Check if inactive version already exists
    const inactiveExists = await this.fileExists(newPath);
    if (inactiveExists) {
      throw new Error('Cannot deactivate: inactive version already exists');
    }

    await this.renameFile(filePath, newPath);
    return newPath;
  }

  /**
   * Activate a configuration file by removing .inactive extension
   */
  static async activateFile(filePath: string): Promise<string> {
    if (!filePath.endsWith('.inactive')) {
      throw new Error('File is already active');
    }

    const newPath = filePath.slice(0, -9); // Remove '.inactive'

    // Check if active version already exists
    const activeExists = await this.fileExists(newPath);
    if (activeExists) {
      throw new Error('Cannot activate: active version already exists');
    }

    await this.renameFile(filePath, newPath);
    return newPath;
  }

  /**
   * Get full path representation
   */
  static getDisplayPath(path: string): string {
    return path;
  }

  /**
   * Validate file name for safety
   */
  static isValidFileName(fileName: string): boolean {
    // Check for invalid characters and patterns
    const invalidChars = /[<>:"|?*]/;
    const hasControlChars = fileName
      .split('')
      .some(char => char.charCodeAt(0) < 32);
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

    return (
      fileName.length > 0 &&
      fileName.length <= 255 &&
      !invalidChars.test(fileName) &&
      !hasControlChars &&
      !reservedNames.test(fileName) &&
      !fileName.startsWith('.') &&
      !fileName.endsWith('.')
    );
  }

  /**
   * Get file extension
   */
  static getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.substring(lastDot + 1).toLowerCase() : '';
  }

  /**
   * Check if file is a configuration file we support
   */
  static isConfigurationFile(
    fileName: string,
    filePath?: string
  ): {
    type: 'memory' | 'settings' | 'command' | null;
    valid: boolean;
    isInactive: boolean;
    validationError?: string;
  } {
    // Check for common invalid patterns - .inactive should only be at the end
    const inactiveIndex = fileName.indexOf('.inactive');
    if (inactiveIndex !== -1 && inactiveIndex !== fileName.length - 9) {
      return {
        type: null,
        valid: false,
        isInactive: false,
        validationError:
          'Invalid file name: ".inactive" should only appear at the end of the filename',
      };
    }

    // Check if file has .inactive extension
    const isInactive = fileName.endsWith('.inactive');

    // If we have a file path, use FileOperationsService for accurate type detection
    if (filePath) {
      const fileType = FileOperationsService.getFileType(filePath);

      if (fileType) {
        // Check for invalid manual renames - files ending with .inactive that aren't proper config files
        if (isInactive) {
          const activeFilePath = filePath.slice(0, -9); // Remove '.inactive'
          const activeFileType =
            FileOperationsService.getFileType(activeFilePath);
          if (!activeFileType) {
            return {
              type: null,
              valid: false,
              isInactive: false,
              validationError: `Invalid inactive file: "${fileName.slice(0, -9)}" is not a valid configuration file`,
            };
          }
        }

        return { type: fileType, valid: true, isInactive };
      }

      return { type: null, valid: false, isInactive: false };
    }

    // Fallback to original logic if no path provided
    const actualFileName = isInactive ? fileName.slice(0, -9) : fileName; // Remove '.inactive'
    const extension = this.getFileExtension(actualFileName);

    // Check for invalid manual renames - files ending with .inactive that aren't proper config files
    if (isInactive) {
      const baseCheck = this.isConfigurationFile(actualFileName);
      if (!baseCheck.valid) {
        return {
          type: null,
          valid: false,
          isInactive: false,
          validationError: `Invalid inactive file: "${actualFileName}" is not a valid configuration file`,
        };
      }
    }

    // Memory files: CLAUDE.md
    if (actualFileName === 'CLAUDE.md') {
      return { type: 'memory', valid: true, isInactive };
    }

    // Settings files: settings.json, settings.local.json
    if (
      extension === 'json' &&
      (actualFileName === 'settings.json' ||
        actualFileName === 'settings.local.json')
    ) {
      return { type: 'settings', valid: true, isInactive };
    }

    // Without path context, we can't reliably determine if .md files are command or memory files
    // So we'll default to memory files for .md files that aren't CLAUDE.md
    if (extension === 'md' && actualFileName !== 'CLAUDE.md') {
      return { type: 'memory', valid: true, isInactive };
    }

    return { type: null, valid: false, isInactive: false };
  }

  /**
   * Discover and build file tree from directory path
   */
  static async discoverFileTree(
    directoryPath: string,
    options: TreeBuildOptions = {}
  ): Promise<FileDiscoveryResult> {
    const {
      maxDepth: _maxDepth = 10,
      includeHidden: _includeHidden = false,
      forceRefresh = false,
    } = options;

    try {
      // Use filtered tree endpoint for better performance and filtering
      // Calculate a reasonable root path (go up a few levels from project root)
      const pathParts = directoryPath.split('/').filter(Boolean);
      // Go up to show at least 2-3 levels of ancestors
      const rootPath =
        pathParts.length > 3 ? `/${pathParts.slice(0, -3).join('/')}` : '/';

      // Build cache busting parameters
      const params = new URLSearchParams({
        projectRoot: directoryPath,
        rootPath: rootPath,
        _t: Date.now().toString(), // Cache buster to ensure fresh data
        _force: Math.random().toString(), // Additional cache buster
      });

      // Add extra cache busting for force refresh
      if (forceRefresh) {
        params.set('_refresh', Date.now().toString());
        params.set('_bust', Math.random().toString());
      }

      const response = await fetch(
        `${API_BASE_URL}/api/filesystem/filtered-tree?${params}`,
        {
          cache: 'no-cache', // Disable all caching
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get file tree');
      }

      const data = await response.json();
      const serverResult = data.data;

      console.log('discoverFileTree: Raw server response:', serverResult);

      // Convert server tree to our FileTreeNode format
      const convertTree = (
        node: FileTreeNodeServer,
        depth: number = 0,
        parentId?: string
      ): FileTreeNode => {
        const nodeId = `${parentId || 'root'}_${node.name}_${depth}`;

        if (node.type === 'directory') {
          const children =
            node.children?.map(child =>
              convertTree(child, depth + 1, nodeId)
            ) || [];

          // Check if this is the project root directory
          const isProjectRoot = node.path === serverResult.projectRootPath;

          // Debug logging for tree conversion
          if (depth === 0) {
            console.log('Tree conversion debug:');
            console.log('  Node path:', node.path);
            console.log('  Project root path:', serverResult.projectRootPath);
            console.log('  Is project root:', isProjectRoot);
            console.log('  Node name:', node.name);
            console.log('  Children count:', children.length);
          }

          return {
            id: nodeId,
            name: node.name,
            path: node.path,
            type: 'directory',
            depth,
            parentId,
            isExpanded: depth < 2 || isProjectRoot, // Auto-expand first 2 levels + project root
            hasChildren: children.length > 0,
            children,
          };
        } else {
          return {
            id: nodeId,
            name: node.name,
            path: node.path,
            type: 'file',
            fileType: node.fileType,
            isInactive: node.isInactive,
            isValid: node.isValid,
            depth,
            parentId,
            lastModified: node.lastModified
              ? new Date(node.lastModified)
              : undefined,
            size: node.size,
            hasChildren: false,
          };
        }
      };

      const tree = [convertTree(serverResult.tree)];

      console.log('discoverFileTree: Final converted tree:', tree);
      console.log(
        'discoverFileTree: Tree structure:',
        tree.map(n => ({
          name: n.name,
          type: n.type,
          childCount: n.children?.length || 0,
        }))
      );

      return {
        tree,
        totalFiles: serverResult.totalFiles,
        totalDirectories: serverResult.totalDirectories,
        configurationFiles: serverResult.configurationFiles,
        projectRootPath: serverResult.projectRootPath,
      };
    } catch (error) {
      throw new Error(
        `Failed to discover file tree: ${(error as Error).message}`
      );
    }
  }

  /**
   * Search file tree nodes
   */
  static searchTree(
    nodes: FileTreeNode[],
    options: TreeSearchOptions
  ): FileTreeNode[] {
    const {
      query,
      includeFiles = true,
      includeDirectories = true,
      fileTypes = [],
      caseSensitive = false,
    } = options;

    if (!query.trim() && fileTypes.length === 0) {
      return nodes;
    }

    const searchQuery = caseSensitive ? query : query.toLowerCase();
    const results: FileTreeNode[] = [];

    const collectMatches = (node: FileTreeNode): void => {
      const nodeName = caseSensitive ? node.name : node.name.toLowerCase();
      const nameMatches = !query.trim() || nodeName.includes(searchQuery);

      // Check if node type should be included
      const typeMatch =
        (node.type === 'file' && includeFiles) ||
        (node.type === 'directory' && includeDirectories);

      // Check file type filter
      const fileTypeMatch =
        fileTypes.length === 0 ||
        (node.fileType && fileTypes.includes(node.fileType));

      // If this node matches all criteria, add it to results
      if (nameMatches && typeMatch && fileTypeMatch) {
        results.push({
          ...node,
          isExpanded: true,
        });
      }

      // Recursively search children
      if (node.children) {
        node.children.forEach(child => collectMatches(child));
      }
    };

    nodes.forEach(node => collectMatches(node));
    return results;
  }

  /**
   * Expand or collapse a node in the tree
   */
  static async toggleNodeExpansion(
    nodes: FileTreeNode[],
    nodeId: string
  ): Promise<FileTreeNode[]> {
    const updateNode = async (node: FileTreeNode): Promise<FileTreeNode> => {
      if (node.id === nodeId) {
        const newExpanded = !node.isExpanded;

        // If expanding and no children loaded yet, load them
        if (
          newExpanded &&
          node.type === 'directory' &&
          (!node.children || node.children.length === 0)
        ) {
          // Load children from server
          const entries = await this.listDirectory(node.path);

          const children: FileTreeNode[] = entries.map((entry, _index) => {
            const childId = `${nodeId}_${entry.name}_${node.depth + 1}`;

            return {
              id: childId,
              name: entry.name,
              path: entry.path,
              type: entry.type,
              fileType: entry.fileType,
              isInactive: entry.isInactive,
              isValid: entry.isValid,
              depth: node.depth + 1,
              parentId: nodeId,
              lastModified: entry.lastModified,
              size: entry.size,
              hasChildren: entry.type === 'directory',
              children: [],
              isExpanded: false,
            };
          });

          return {
            ...node,
            isExpanded: newExpanded,
            children,
          };
        }

        return {
          ...node,
          isExpanded: newExpanded,
        };
      }

      // Recursively update children
      if (node.children) {
        return {
          ...node,
          children: await Promise.all(
            node.children.map(child => updateNode(child))
          ),
        };
      }

      return node;
    };

    return Promise.all(nodes.map(node => updateNode(node)));
  }

  /**
   * Select a node in the tree
   */
  static selectNode(nodes: FileTreeNode[], nodeId: string): FileTreeNode[] {
    // First, find the path to the selected node to expand parent nodes
    const findNodePath = (
      node: FileTreeNode,
      targetId: string,
      path: string[] = []
    ): string[] | null => {
      if (node.id === targetId) {
        return [...path, node.id];
      }

      if (node.children) {
        for (const child of node.children) {
          const childPath = findNodePath(child, targetId, [...path, node.id]);
          if (childPath) {
            return childPath;
          }
        }
      }

      return null;
    };

    // Find all parent node IDs that need to be expanded
    const parentIds = new Set<string>();
    for (const node of nodes) {
      const path = findNodePath(node, nodeId);
      if (path) {
        // Add all nodes in the path except the last one (which is the selected node)
        path.slice(0, -1).forEach(id => parentIds.add(id));
        break;
      }
    }

    // Update nodes with selection and expansion
    const updateNode = (node: FileTreeNode): FileTreeNode => {
      const isSelected = node.id === nodeId;
      const shouldExpand = parentIds.has(node.id) || (node.isExpanded ?? false);

      const updatedNode = {
        ...node,
        isSelected,
        isExpanded: node.type === 'directory' ? shouldExpand : node.isExpanded,
      };

      // Recursively update children
      if (node.children) {
        updatedNode.children = node.children.map(child => updateNode(child));
      }

      return updatedNode;
    };

    return nodes.map(node => updateNode(node));
  }

  /**
   * Find a node by ID in the tree
   */
  static findNodeById(
    nodes: FileTreeNode[],
    nodeId: string
  ): FileTreeNode | null {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node;
      }

      if (node.children) {
        const found = this.findNodeById(node.children, nodeId);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  /**
   * Get all parent nodes for a given node (breadcrumb path)
   */
  static getNodePath(nodes: FileTreeNode[], nodeId: string): FileTreeNode[] {
    const path: FileTreeNode[] = [];

    const findPath = (
      currentNodes: FileTreeNode[],
      targetId: string
    ): boolean => {
      for (const node of currentNodes) {
        if (node.id === targetId) {
          path.unshift(node);
          return true;
        }

        if (node.children && findPath(node.children, targetId)) {
          path.unshift(node);
          return true;
        }
      }
      return false;
    };

    findPath(nodes, nodeId);
    return path;
  }
}
