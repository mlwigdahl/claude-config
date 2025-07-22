import path from 'path';
import os from 'os';
import { MemoryFileInfo, MemoryFileType } from '../types/memory.js';
import { FileSystemUtils } from '../utils/file-system.js';
import { extractImports } from './validation.js';

export class MemoryFileDiscovery {
  /**
   * Discover all memory files in project hierarchy
   */
  static async discoverMemoryFiles(
    projectRoot: string
  ): Promise<MemoryFileInfo[]> {
    const memoryFiles: MemoryFileInfo[] = [];

    // Check project memory file
    const projectMemory = await this.checkProjectMemory(projectRoot);
    if (projectMemory) {
      memoryFiles.push(projectMemory);
    }

    // Check user memory file
    const userMemory = await this.checkUserMemory();
    if (userMemory) {
      memoryFiles.push(userMemory);
    }

    // Check parent directory memory files
    const parentMemories = await this.checkParentMemories(projectRoot);
    memoryFiles.push(...parentMemories);

    return memoryFiles;
  }

  /**
   * Check for project-level memory file
   */
  private static async checkProjectMemory(
    projectRoot: string
  ): Promise<MemoryFileInfo | null> {
    const memoryPath = path.join(projectRoot, 'CLAUDE.md');
    const exists = await FileSystemUtils.fileExists(memoryPath);

    if (!exists) {
      return {
        type: MemoryFileType.PROJECT,
        path: memoryPath,
        relativePath: 'CLAUDE.md',
        exists: false,
      };
    }

    const stats = await FileSystemUtils.getFileStats(memoryPath);
    let imports: string[] = [];
    let hasImports = false;

    try {
      const content = await FileSystemUtils.readFileContent(memoryPath);
      imports = extractImports(content);
      hasImports = imports.length > 0;
    } catch {
      // If we can't read the file, just mark it as existing
    }

    return {
      type: MemoryFileType.PROJECT,
      path: memoryPath,
      relativePath: 'CLAUDE.md',
      exists: true,
      size: stats?.size,
      lastModified: stats?.lastModified,
      hasImports,
      importPaths: imports,
    };
  }

  /**
   * Check for user-level memory file
   */
  private static async checkUserMemory(): Promise<MemoryFileInfo | null> {
    const memoryPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
    const exists = await FileSystemUtils.fileExists(memoryPath);

    if (!exists) {
      return {
        type: MemoryFileType.USER,
        path: memoryPath,
        relativePath: '~/.claude/CLAUDE.md',
        exists: false,
      };
    }

    const stats = await FileSystemUtils.getFileStats(memoryPath);
    let imports: string[] = [];
    let hasImports = false;

    try {
      const content = await FileSystemUtils.readFileContent(memoryPath);
      imports = extractImports(content);
      hasImports = imports.length > 0;
    } catch {
      // If we can't read the file, just mark it as existing
    }

    return {
      type: MemoryFileType.USER,
      path: memoryPath,
      relativePath: '~/.claude/CLAUDE.md',
      exists: true,
      size: stats?.size,
      lastModified: stats?.lastModified,
      hasImports,
      importPaths: imports,
    };
  }

  /**
   * Check for memory files in parent directories
   */
  private static async checkParentMemories(
    projectRoot: string
  ): Promise<MemoryFileInfo[]> {
    const memoryFiles: MemoryFileInfo[] = [];
    const projectPath = path.resolve(projectRoot);
    let currentPath = path.dirname(projectPath);
    const rootPath = path.parse(currentPath).root;

    // Traverse up the directory tree
    while (
      currentPath !== rootPath &&
      currentPath !== path.dirname(currentPath)
    ) {
      const memoryPath = path.join(currentPath, 'CLAUDE.md');
      const exists = await FileSystemUtils.fileExists(memoryPath);

      if (exists) {
        const stats = await FileSystemUtils.getFileStats(memoryPath);
        let imports: string[] = [];
        let hasImports = false;

        try {
          const content = await FileSystemUtils.readFileContent(memoryPath);
          imports = extractImports(content);
          hasImports = imports.length > 0;
        } catch {
          // If we can't read the file, just mark it as existing
        }

        const relativePath = path.relative(projectRoot, memoryPath);

        memoryFiles.push({
          type: MemoryFileType.PARENT,
          path: memoryPath,
          relativePath,
          exists: true,
          size: stats?.size,
          lastModified: stats?.lastModified,
          hasImports,
          importPaths: imports,
        });
      }

      // Move up one level
      currentPath = path.dirname(currentPath);
    }

    return memoryFiles;
  }

  /**
   * Find memory files with specific patterns
   */
  static async findMemoryFilesWithContent(
    projectRoot: string,
    searchPattern: string | RegExp
  ): Promise<MemoryFileInfo[]> {
    const allMemoryFiles = await this.discoverMemoryFiles(projectRoot);
    const matchingFiles: MemoryFileInfo[] = [];

    for (const memoryFile of allMemoryFiles) {
      if (!memoryFile.exists) continue;

      try {
        const content = await FileSystemUtils.readFileContent(memoryFile.path);
        const pattern =
          typeof searchPattern === 'string'
            ? new RegExp(searchPattern, 'i')
            : searchPattern;

        if (pattern.test(content)) {
          matchingFiles.push(memoryFile);
        }
      } catch {
        // Skip files we can't read
      }
    }

    return matchingFiles;
  }

  /**
   * Get memory file loading order (Claude Code's hierarchy)
   */
  static async getMemoryFileLoadOrder(
    projectRoot: string
  ): Promise<MemoryFileInfo[]> {
    const allFiles = await this.discoverMemoryFiles(projectRoot);
    const existingFiles = allFiles.filter(f => f.exists);

    // Sort by Claude Code's loading order:
    // 1. User memory
    // 2. Parent directories (furthest to closest)
    // 3. Project memory
    return existingFiles.sort((a, b) => {
      if (a.type === MemoryFileType.USER && b.type !== MemoryFileType.USER)
        return -1;
      if (b.type === MemoryFileType.USER && a.type !== MemoryFileType.USER)
        return 1;

      if (
        a.type === MemoryFileType.PARENT &&
        b.type === MemoryFileType.PARENT
      ) {
        // Sort parent files by distance from project root (furthest first)
        const aDepth = a.relativePath.split(path.sep).length;
        const bDepth = b.relativePath.split(path.sep).length;
        return bDepth - aDepth;
      }

      if (a.type === MemoryFileType.PARENT && b.type === MemoryFileType.PROJECT)
        return -1;
      if (b.type === MemoryFileType.PARENT && a.type === MemoryFileType.PROJECT)
        return 1;

      return 0;
    });
  }

  /**
   * Analyze import dependencies between memory files
   */
  static async analyzeImportDependencies(projectRoot: string): Promise<{
    files: MemoryFileInfo[];
    dependencies: Map<string, string[]>;
    circularDependencies: string[][];
  }> {
    const memoryFiles = await this.discoverMemoryFiles(projectRoot);
    const dependencies = new Map<string, string[]>();
    const circularDependencies: string[][] = [];

    // Build dependency map
    for (const file of memoryFiles) {
      if (!file.exists || !file.importPaths) continue;

      const resolvedImports: string[] = [];
      for (const importPath of file.importPaths) {
        const resolved = this.resolveImportPath(
          projectRoot,
          file.path,
          importPath
        );
        if (resolved) {
          resolvedImports.push(resolved);
        }
      }

      dependencies.set(file.path, resolvedImports);
    }

    // Check for circular dependencies
    for (const [filePath] of dependencies) {
      const visited = new Set<string>();
      const pathArray: string[] = [];

      if (
        this.hasCircularDependency(filePath, dependencies, visited, pathArray)
      ) {
        circularDependencies.push([...pathArray]);
      }
    }

    return {
      files: memoryFiles,
      dependencies,
      circularDependencies,
    };
  }

  /**
   * Resolve import path to absolute file path
   */
  private static resolveImportPath(
    projectRoot: string,
    fromFile: string,
    importPath: string
  ): string | null {
    if (importPath.startsWith('~/')) {
      // User directory import
      return path.join(os.homedir(), importPath.substring(2));
    }

    if (path.isAbsolute(importPath)) {
      return importPath;
    }

    // Relative to the importing file's directory
    const fromDir = path.dirname(fromFile);
    return path.resolve(fromDir, importPath);
  }

  /**
   * Check for circular dependencies
   */
  private static hasCircularDependency(
    filePath: string,
    dependencies: Map<string, string[]>,
    visited: Set<string>,
    currentPath: string[]
  ): boolean {
    if (currentPath.includes(filePath)) {
      // Found a cycle
      return true;
    }

    if (visited.has(filePath)) {
      return false;
    }

    visited.add(filePath);
    currentPath.push(filePath);

    const imports = dependencies.get(filePath) || [];
    for (const importPath of imports) {
      if (
        this.hasCircularDependency(
          importPath,
          dependencies,
          visited,
          currentPath
        )
      ) {
        return true;
      }
    }

    currentPath.pop();
    return false;
  }
}
