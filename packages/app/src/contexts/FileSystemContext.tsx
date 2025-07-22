import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useState,
  useRef,
} from 'react';
import { FileTreeNode, FileInfo } from '../types';
import { FileSystemService } from '../services/fileSystemService.js';

interface FileSystemState {
  projectRoot: string | null;
  fileTree: FileTreeNode[];
  userFiles: FileTreeNode[];
  selectedFile: FileInfo | null;
  selectedNode: FileTreeNode | null;
  isLoading: boolean;
  error: string | null;
  showDirectoryBrowser: boolean;
}

type FileSystemAction =
  | {
      type: 'SET_PROJECT_ROOT';
      payload: string | null;
    }
  | { type: 'SET_FILE_TREE'; payload: FileTreeNode[] }
  | { type: 'SET_USER_FILES'; payload: FileTreeNode[] }
  | { type: 'SET_SELECTED_FILE'; payload: FileInfo | null }
  | { type: 'SET_SELECTED_NODE'; payload: FileTreeNode | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_NODE'; payload: FileTreeNode }
  | { type: 'REFRESH_FILES' }
  | { type: 'SHOW_DIRECTORY_BROWSER'; payload: boolean };

const initialState: FileSystemState = {
  projectRoot: null,
  fileTree: [],
  userFiles: [],
  selectedFile: null,
  selectedNode: null,
  isLoading: false,
  error: null,
  showDirectoryBrowser: false,
};

function fileSystemReducer(
  state: FileSystemState,
  action: FileSystemAction
): FileSystemState {
  switch (action.type) {
    case 'SET_PROJECT_ROOT':
      return {
        ...state,
        projectRoot: action.payload,
        error: null, // Clear any previous errors
      };
    case 'SET_FILE_TREE':
      return { ...state, fileTree: action.payload, error: null };
    case 'SET_USER_FILES':
      return { ...state, userFiles: action.payload };
    case 'SET_SELECTED_FILE':
      return { ...state, selectedFile: action.payload };
    case 'SET_SELECTED_NODE':
      return { ...state, selectedNode: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'UPDATE_NODE':
      // Update a specific node in the tree (for expand/collapse)
      return {
        ...state,
        fileTree: updateNodeInTree(state.fileTree, action.payload),
      };
    case 'REFRESH_FILES':
      return { ...state, isLoading: true, error: null };
    case 'SHOW_DIRECTORY_BROWSER':
      return { ...state, showDirectoryBrowser: action.payload };
    default:
      return state;
  }
}

// Helper function to update a node in the tree
function updateNodeInTree(
  nodes: FileTreeNode[],
  updatedNode: FileTreeNode
): FileTreeNode[] {
  return nodes.map(node => {
    if (node.id === updatedNode.id) {
      return updatedNode;
    }
    if (node.children) {
      return {
        ...node,
        children: updateNodeInTree(node.children, updatedNode),
      };
    }
    return node;
  });
}

// Helper function to find a node by path
function findNodeByPath(
  nodes: FileTreeNode[],
  path: string
): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      const found = findNodeByPath(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

interface FileSystemContextValue {
  // State
  projectRoot: string | null;
  fileTree: FileTreeNode[];
  userFiles: FileTreeNode[];
  selectedFile: FileInfo | null;
  selectedNode: FileTreeNode | null;
  isLoading: boolean;
  error: string | null;
  showDirectoryBrowser: boolean;

  // Actions
  openDirectoryBrowser: () => void;
  closeDirectoryBrowser: () => void;
  selectProjectRoot: (path: string) => Promise<void>;
  selectFile: (file: FileInfo) => void;
  selectNode: (nodeId: string) => void;
  selectNodeByPath: (path: string) => void;
  toggleNodeExpansion: (nodeId: string) => Promise<void>;
  refreshFiles: () => Promise<void>;
  refreshFileTree: () => Promise<void>;
  clearSelection: () => void;
  registerScrollToNode: (callback: (nodeId: string) => void) => void;
}

const FileSystemContext = createContext<FileSystemContextValue | undefined>(
  undefined
);

export const useFileSystem = (): FileSystemContextValue => {
  const context = useContext(FileSystemContext);
  if (!context) {
    throw new Error('useFileSystem must be used within a FileSystemProvider');
  }
  return context;
};

interface FileSystemProviderProps {
  children: React.ReactNode;
}

export const FileSystemProvider: React.FC<FileSystemProviderProps> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(fileSystemReducer, initialState);
  const [scrollToNodeCallback, setScrollToNodeCallback] = useState<
    ((nodeId: string) => void) | null
  >(null);
  const stateRef = useRef(state);

  // Keep state ref updated
  stateRef.current = state;

  const discoverFiles = useCallback(
    async (directoryPath: string, forceRefresh = false) => {
      try {
        const result = await FileSystemService.discoverFileTree(directoryPath, {
          maxDepth: 10,
          includeHidden: false,
          autoExpand: true,
          expandDepth: 2,
          forceRefresh, // Pass force refresh to service
        });

        dispatch({ type: 'SET_FILE_TREE', payload: result.tree });

        // Separate user files (could be enhanced later)
        const userFiles = result.tree.filter(
          node =>
            node.fileType === 'memory' ||
            node.fileType === 'settings' ||
            node.fileType === 'command'
        );
        dispatch({ type: 'SET_USER_FILES', payload: userFiles });

        // Update project root with the resolved path from server
        if (result.projectRootPath) {
          dispatch({
            type: 'SET_PROJECT_ROOT',
            payload: result.projectRootPath,
          });
        }

        // Scroll to project root node after tree is loaded
        if (result.projectRootPath && scrollToNodeCallback) {
          // Find the project root node in the tree
          const projectRootNode = findNodeByPath(
            result.tree,
            result.projectRootPath
          );
          if (projectRootNode) {
            // Use setTimeout to ensure DOM is updated before scrolling
            setTimeout(() => {
              scrollToNodeCallback(projectRootNode.id);
            }, 300);
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to discover files';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
      }
    },
    [scrollToNodeCallback]
  );

  const openDirectoryBrowser = useCallback(() => {
    dispatch({ type: 'SHOW_DIRECTORY_BROWSER', payload: true });
  }, []);

  const closeDirectoryBrowser = useCallback(() => {
    dispatch({ type: 'SHOW_DIRECTORY_BROWSER', payload: false });
  }, []);

  const selectProjectRoot = useCallback(
    async (path: string) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        dispatch({ type: 'SHOW_DIRECTORY_BROWSER', payload: false });

        const isSupported = await FileSystemService.isSupported();
        if (!isSupported) {
          throw new Error('Server file system is not available');
        }

        dispatch({
          type: 'SET_PROJECT_ROOT',
          payload: path,
        });

        // Discover files in the selected directory
        await discoverFiles(path);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to select project root';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [discoverFiles]
  );

  const selectFile = useCallback((file: FileInfo) => {
    dispatch({ type: 'SET_SELECTED_FILE', payload: file });
  }, []);

  const selectNode = useCallback(
    (nodeId: string) => {
      const node = FileSystemService.findNodeById(state.fileTree, nodeId);
      if (node) {
        // Update tree to show selection
        const updatedTree = FileSystemService.selectNode(
          state.fileTree,
          nodeId
        );
        dispatch({ type: 'SET_FILE_TREE', payload: updatedTree });
        dispatch({ type: 'SET_SELECTED_NODE', payload: node });

        // If it's a file, also set it as selected file
        if (node.type === 'file' && node.fileType) {
          const fileInfo: FileInfo = {
            id: node.id,
            name: node.name,
            path: node.path,
            type: node.fileType,
            isInactive: node.isInactive,
            exists: true,
            lastModified: node.lastModified,
            size: node.size,
          };
          dispatch({ type: 'SET_SELECTED_FILE', payload: fileInfo });
        }
      }
    },
    [state.fileTree]
  );

  const toggleNodeExpansion = useCallback(
    async (nodeId: string) => {
      try {
        const updatedTree = await FileSystemService.toggleNodeExpansion(
          state.fileTree,
          nodeId
        );
        dispatch({ type: 'SET_FILE_TREE', payload: updatedTree });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to toggle node expansion';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
      }
    },
    [state.fileTree]
  );

  const refreshFiles = useCallback(
    async (forceRefresh = false) => {
      if (!state.projectRoot) return;

      try {
        dispatch({ type: 'REFRESH_FILES' });
        await discoverFiles(state.projectRoot, forceRefresh);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to refresh files';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    },
    [state.projectRoot, discoverFiles]
  );

  const refreshFileTree = useCallback(async () => {
    await refreshFiles(true); // Force refresh after file operations
  }, [refreshFiles]);

  const selectNodeByPath = useCallback(
    (path: string) => {
      // Use timeout to ensure we get the latest state after tree refresh
      setTimeout(() => {
        // Get the most current state from ref to avoid stale closures
        const currentTree = stateRef.current.fileTree;
        const node = findNodeByPath(currentTree, path);

        if (node) {
          // Update tree to show selection and expand parents
          const updatedTree = FileSystemService.selectNode(
            currentTree,
            node.id
          );
          dispatch({ type: 'SET_FILE_TREE', payload: updatedTree });
          dispatch({ type: 'SET_SELECTED_NODE', payload: node });

          // If it's a file, also set it as selected file
          if (node.type === 'file' && node.fileType) {
            const fileInfo: FileInfo = {
              id: node.id,
              name: node.name,
              path: node.path,
              type: node.fileType,
              isInactive: node.isInactive,
              exists: true,
              lastModified: node.lastModified,
              size: node.size,
            };
            dispatch({ type: 'SET_SELECTED_FILE', payload: fileInfo });
          }

          // Scroll to the selected node if callback is available
          if (scrollToNodeCallback) {
            setTimeout(() => {
              scrollToNodeCallback(node.id);
            }, 200);
          }
        }
      }, 100);
    },
    [scrollToNodeCallback]
  );

  const registerScrollToNode = useCallback(
    (callback: (nodeId: string) => void) => {
      setScrollToNodeCallback(() => callback);
    },
    []
  );

  const clearSelection = useCallback(() => {
    dispatch({ type: 'SET_SELECTED_FILE', payload: null });
    dispatch({ type: 'SET_SELECTED_NODE', payload: null });

    // Clear selection in tree
    const clearedTree = FileSystemService.selectNode(state.fileTree, '');
    dispatch({ type: 'SET_FILE_TREE', payload: clearedTree });
  }, [state.fileTree]);

  const value: FileSystemContextValue = {
    // State
    projectRoot: state.projectRoot,
    fileTree: state.fileTree,
    userFiles: state.userFiles,
    selectedFile: state.selectedFile,
    selectedNode: state.selectedNode,
    isLoading: state.isLoading,
    error: state.error,
    showDirectoryBrowser: state.showDirectoryBrowser,

    // Actions
    openDirectoryBrowser,
    closeDirectoryBrowser,
    selectProjectRoot,
    selectFile,
    selectNode,
    selectNodeByPath,
    toggleNodeExpansion,
    refreshFiles,
    refreshFileTree,
    clearSelection,
    registerScrollToNode,
  };

  return (
    <FileSystemContext.Provider value={value}>
      {children}
    </FileSystemContext.Provider>
  );
};
