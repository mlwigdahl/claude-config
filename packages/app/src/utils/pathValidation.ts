/**
 * Path validation utilities for file creation
 */

export interface PathValidationResult {
  isValid: boolean;
  errorMessage?: string;
  suggestedPath?: string;
}

/**
 * Validate directory path based on file type requirements
 */
export function validateDirectoryPath(
  directoryPath: string,
  fileType: 'memory' | 'settings' | 'command',
  projectRoot?: string
): PathValidationResult {
  if (!directoryPath) {
    return {
      isValid: false,
      errorMessage: 'Directory path is required',
    };
  }

  const normalizedPath = directoryPath.replace(/\\/g, '/');

  switch (fileType) {
    case 'memory':
      // Memory files (CLAUDE.md) can be placed anywhere, but typically in project root
      return {
        isValid: true,
        suggestedPath: projectRoot || normalizedPath,
      };

    case 'settings':
      // Settings files can be placed anywhere - project level or user level
      return {
        isValid: true,
        suggestedPath: projectRoot || normalizedPath,
      };

    case 'command': {
      // Command files must be in .claude/commands directory or subdirectories
      const hasClaudeCommands = normalizedPath.includes('.claude/commands');
      const endsWithClaudeCommands =
        normalizedPath.endsWith('/.claude/commands') ||
        normalizedPath.endsWith('.claude/commands');

      if (!hasClaudeCommands && !endsWithClaudeCommands) {
        const suggestedPath = `${normalizedPath}/.claude/commands`;

        return {
          isValid: false,
          errorMessage:
            'Command files must be placed in a .claude/commands directory',
          suggestedPath,
        };
      }

      return {
        isValid: true,
      };
    }

    default:
      return {
        isValid: false,
        errorMessage: 'Unknown file type',
      };
  }
}

/**
 * Get the appropriate directory path for a file type based on current selection
 */
export function getPreferredDirectoryPath(
  fileType: 'memory' | 'settings' | 'command',
  selectedNodePath?: string,
  projectRoot?: string,
  selectedNodeId?: string,
  homeDirectory?: string
): string {
  // Check if we're in the home directory context based on node ID
  const isHomeContext = selectedNodeId?.includes('Home Directory_root') || false;
  
  // If no selection, use appropriate default
  if (!selectedNodePath) {
    if (isHomeContext && homeDirectory) {
      return getDefaultDirectoryForFileType(fileType, homeDirectory);
    }
    return getDefaultDirectoryForFileType(fileType, projectRoot);
  }

  // If selected node is a file, use its directory
  // Check if it's a file by looking for extension at the end (not just any dot)
  const hasFileExtension = /\.[^/.]+$/.test(selectedNodePath);
  const directoryPath = hasFileExtension
    ? selectedNodePath.substring(0, selectedNodePath.lastIndexOf('/'))
    : selectedNodePath;

  // For home directory context, ensure we use home paths
  if (isHomeContext && homeDirectory) {
    const baseDir = directoryPath || homeDirectory;
    
    switch (fileType) {
      case 'memory':
        // In home context, memory files should go in .claude
        return baseDir.includes('.claude') ? baseDir : `${homeDirectory}/.claude`;
        
      case 'settings':
        // Settings files should go in .claude
        return baseDir.includes('.claude') ? baseDir : `${homeDirectory}/.claude`;
        
      case 'command':
        // Commands should go in .claude/commands
        if (baseDir.includes('.claude/commands')) {
          return baseDir;
        }
        return baseDir.includes('.claude') ? `${baseDir}/commands` : `${homeDirectory}/.claude/commands`;
        
      default:
        return baseDir;
    }
  }

  // Project context - existing logic
  switch (fileType) {
    case 'memory':
    case 'settings':
      // Memory and settings files can go anywhere, use selected directory
      return directoryPath || projectRoot || '';

    case 'command': {
      // For commands, if we're already in .claude/commands, use that
      // Otherwise, suggest .claude/commands in the selected directory or project root
      if (directoryPath.includes('.claude/commands')) {
        return directoryPath;
      }

      const baseDir = directoryPath || projectRoot || '';
      return `${baseDir}/.claude/commands`;
    }

    default:
      return directoryPath || projectRoot || '';
  }
}

/**
 * Get default directory for a file type
 */
export function getDefaultDirectoryForFileType(
  fileType: 'memory' | 'settings' | 'command',
  projectRoot?: string
): string {
  const baseDir = projectRoot || '';

  switch (fileType) {
    case 'memory':
    case 'settings':
      return baseDir;
    case 'command':
      return `${baseDir}/.claude/commands`;
    default:
      return '';
  }
}
