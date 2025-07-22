import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  IconButton,
  Divider,
  useToast,
  Badge,
  Tooltip,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Input,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
} from '@chakra-ui/react';
import {
  EditIcon,
  DeleteIcon,
  CheckIcon,
  CloseIcon,
  RepeatIcon,
  InfoIcon,
  WarningIcon,
  ViewOffIcon,
  ViewIcon,
  ArrowUpDownIcon,
} from '@chakra-ui/icons';
import { FileTreeNode } from '../../types';
import { FileSystemService } from '../../services/fileSystemService';
import { FileOperationsService, FileValidationResult, FileAnalysis } from '../../services/fileOperationsService';
import { FileCRUDService } from '../../services/fileCRUDService';
import { useFileSystem } from '../../contexts/FileSystemContext';
import { MemoryFileDetails } from './MemoryFileDetails';
import { SettingsFileDetails } from './SettingsFileDetails';
import { CommandFileDetails } from './CommandFileDetails';
import { ConfirmationDialog } from '../Common/ConfirmationDialog';

export const FileDetailsPanel: React.FC = () => {
  const { selectedNode, fileTree, refreshFileTree, selectNodeByPath, clearSelection } = useFileSystem();
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isRenameSaving, setIsRenameSaving] = useState(false);
  const [isSwitchingType, setIsSwitchingType] = useState(false);
  const [validation, setValidation] = useState<FileValidationResult | null>(null);
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null);
  const [pendingSelection, setPendingSelection] = useState<FileTreeNode | null>(null);
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false);
  const toast = useToast();
  const cancelUnsavedRef = React.useRef<HTMLButtonElement>(null);

  // Load file content when selection changes
  useEffect(() => {
    // Don't load if we're in the middle of toggling active state
    if (isToggling) return;
    
    // Silently cancel rename operation when switching to a different file
    if (isRenaming) {
      setIsRenaming(false);
      setNewFileName('');
    }
    
    // If there are unsaved changes and we're switching to a different file
    if (isEditing && content !== originalContent && selectedNode !== pendingSelection) {
      // Store the pending selection and show confirmation dialog
      setPendingSelection(selectedNode);
      setShowUnsavedChangesDialog(true);
      return;
    }
    
    // Clear any pending selection since we're proceeding
    setPendingSelection(null);
    
    if (selectedNode && selectedNode.type === 'file') {
      loadFileContent();
    } else {
      setContent('');
      setOriginalContent('');
      setValidation(null);
      setAnalysis(null);
      setIsEditing(false);
    }
  }, [selectedNode, isToggling]);

  const loadFileContent = async () => {
    if (!selectedNode || selectedNode.type !== 'file') return;
    
    // Don't try to load if we're toggling
    if (isToggling) return;

    setIsLoading(true);
    try {
      // Use the CRUD service to read the file
      const result = await FileCRUDService.readFile(selectedNode.path);
      
      if (!result.success) {
        toast({
          title: 'Error loading file',
          description: result.error || result.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      // Update local state with the result
      const fileContent = result.data?.content || '';
      setContent(fileContent);
      setOriginalContent(fileContent);
      
      // Set validation and analysis from the result
      if (result.data?.validation) {
        setValidation(result.data.validation);
      }
      if (result.data?.analysis) {
        setAnalysis(result.data.analysis);
      }
    } catch (error) {
      toast({
        title: 'Error loading file',
        description: (error as Error).message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validateAndAnalyze = async (fileContent: string) => {
    if (!selectedNode || !selectedNode.fileType) return;

    try {
      // For validation purposes, use the active file path (without .inactive)
      // since we're validating content, not the file state
      const validationPath = selectedNode.isInactive 
        ? selectedNode.path.replace('.inactive', '')
        : selectedNode.path;

      // Validate file
      const validationResult = await FileOperationsService.validateFile(
        selectedNode.fileType,
        fileContent,
        validationPath
      );
      setValidation(validationResult);

      // Analyze file
      const analysisResult = await FileOperationsService.analyzeFile(
        selectedNode.fileType,
        fileContent,
        validationPath
      );
      setAnalysis(analysisResult);
    } catch (error) {
      console.error('Validation/analysis error:', error);
    }
  };

  const handleSave = async () => {
    if (!selectedNode || selectedNode.type !== 'file') return;

    setIsSaving(true);
    try {
      // Use the CRUD service to update the file
      const result = await FileCRUDService.updateFile(selectedNode.path, content);
      
      if (!result.success) {
        toast({
          title: 'Save Failed',
          description: result.error || result.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        
        // If there's validation data, show it
        if (result.data?.validation) {
          setValidation(result.data.validation);
        }
        setIsSaving(false);
        return;
      }

      // Update local state
      setOriginalContent(content);
      setIsEditing(false);
      
      // Update validation and analysis from the result
      if (result.data?.validation) {
        setValidation(result.data.validation);
      }
      if (result.data?.analysis) {
        setAnalysis(result.data.analysis);
      }
      
      toast({
        title: 'File saved',
        description: 'Your changes have been saved successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Notify parent of update
      refreshFileTree();
    } catch (error) {
      toast({
        title: 'Error saving file',
        description: (error as Error).message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setContent(originalContent);
    setIsEditing(false);
    validateAndAnalyze(originalContent);
  };

  // Handle saving changes and then switching to pending selection
  const handleSaveAndSwitch = async () => {
    if (!selectedNode || selectedNode.type !== 'file') return;

    setIsSaving(true);
    try {
      // Use the CRUD service to update the file
      const result = await FileCRUDService.updateFile(selectedNode.path, content);
      
      if (!result.success) {
        toast({
          title: 'Save Failed',
          description: result.error || result.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        
        // If there's validation data, show it
        if (result.data?.validation) {
          setValidation(result.data.validation);
        }
        setIsSaving(false);
        return;
      }

      // Update local state
      setOriginalContent(content);
      setIsEditing(false);
      
      // Update validation and analysis from the result
      if (result.data?.validation) {
        setValidation(result.data.validation);
      }
      if (result.data?.analysis) {
        setAnalysis(result.data.analysis);
      }
      
      toast({
        title: 'File saved',
        description: 'Your changes have been saved successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Notify parent of update
      refreshFileTree();

      // Close the dialog and proceed with the pending selection
      setShowUnsavedChangesDialog(false);
      
      // Force the selection to the pending node
      if (pendingSelection) {
        // Clear pending selection first to ensure the useEffect triggers properly
        setPendingSelection(null);
        // Use a small delay to ensure state updates
        setTimeout(() => {
          selectNodeByPath(pendingSelection.path);
        }, 100);
      }
    } catch (error) {
      toast({
        title: 'Error saving file',
        description: (error as Error).message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle discarding changes and switching to pending selection
  const handleDiscardAndSwitch = () => {
    setContent(originalContent);
    setIsEditing(false);
    setShowUnsavedChangesDialog(false);
    
    // Force the selection to the pending node
    if (pendingSelection) {
      // Clear pending selection first to ensure the useEffect triggers properly
      setPendingSelection(null);
      // Use a small delay to ensure state updates
      setTimeout(() => {
        selectNodeByPath(pendingSelection.path);
      }, 100);
    }
  };

  // Handle canceling the file switch (stay on current file)
  const handleCancelSwitch = () => {
    setShowUnsavedChangesDialog(false);
    setPendingSelection(null);
    // Stay on the current file - no action needed
  };

  const handleDelete = () => {
    if (!selectedNode || selectedNode.type !== 'file') return;
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedNode || selectedNode.type !== 'file') return;

    const parentDirectory = selectedNode.path.substring(0, selectedNode.path.lastIndexOf('/'));
    
    setIsDeleting(true);
    try {
      const result = await FileCRUDService.deleteFile(selectedNode.path);
      
      if (!result.success) {
        toast({
          title: 'Failed to delete file',
          description: result.error || result.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      toast({
        title: 'File deleted successfully',
        description: `Deleted ${selectedNode.name}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Close the confirmation dialog
      setShowDeleteConfirm(false);
      
      // Clear the current content and selection since file is deleted
      setContent('');
      setOriginalContent('');
      setIsEditing(false);
      setValidation(null);
      setAnalysis(null);
      
      // Clear the current selection to avoid stale references
      clearSelection();
      
      // Refresh the file tree to get the updated state from server
      await refreshFileTree();
      
      // Select the parent directory after tree refresh
      if (parentDirectory) {
        // Use timeout to ensure tree state has fully updated
        setTimeout(() => {
          selectNodeByPath(parentDirectory);
        }, 300);
      }
      
    } catch (error) {
      toast({
        title: 'Error deleting file',
        description: (error as Error).message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleRefresh = () => {
    loadFileContent();
  };

  const handleToggleActive = async () => {
    if (!selectedNode || selectedNode.type !== 'file') return;

    // Prevent any file operations while toggling
    setIsToggling(true);
    
    // Store the current node info before clearing
    const isCurrentlyInactive = selectedNode.isInactive;
    const currentPath = selectedNode.path;
    
    try {
      let newPath: string;
      let actionText: string;
      
      if (isCurrentlyInactive) {
        // Activate the file
        newPath = await FileSystemService.activateFile(currentPath);
        actionText = 'activated';
      } else {
        // Deactivate the file
        newPath = await FileSystemService.deactivateFile(currentPath);
        actionText = 'deactivated';
      }

      toast({
        title: `File ${actionText}`,
        description: `Successfully ${actionText} ${selectedNode.name}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Clear current state to prevent loading the old file
      setContent('');
      setOriginalContent('');
      setIsEditing(false);
      setValidation(null);
      setAnalysis(null);
      
      // Clear the current selection first to prevent stale reads
      clearSelection();
      
      // Add a small delay to ensure the UI updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Refresh the file tree to get the updated state from server
      await refreshFileTree();
      
      // Select the renamed file after tree refresh with increased delay
      setTimeout(() => {
        selectNodeByPath(newPath);
      }, 500);
      
    } catch (error) {
      toast({
        title: `Error ${selectedNode.isInactive ? 'activating' : 'deactivating'} file`,
        description: (error as Error).message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsToggling(false);
    }
  };

  // Helper function to calculate target filename when switching settings type
  const getTargetSettingsFileName = (currentFileName: string): string => {
    const isInactive = currentFileName.endsWith('.inactive');
    const baseFileName = isInactive ? currentFileName.replace('.inactive', '') : currentFileName;
    const isCurrentlyLocal = baseFileName === 'settings.local.json';
    
    let newFileName: string;
    if (isCurrentlyLocal) {
      // Switch from local to project
      newFileName = isInactive ? 'settings.json.inactive' : 'settings.json';
    } else {
      // Switch from project to local
      newFileName = isInactive ? 'settings.local.json.inactive' : 'settings.local.json';
    }
    
    return newFileName;
  };

  // Check if switching settings type would cause a conflict
  const wouldSettingsTypeSwitchConflict = (): boolean => {
    if (!selectedNode || selectedNode.fileType !== 'settings') return false;
    
    const targetFileName = getTargetSettingsFileName(selectedNode.name);
    const targetPath = selectedNode.path.replace(selectedNode.name, targetFileName);
    
    // Check if any node in the tree has this target path
    const findNodeByPath = (nodes: FileTreeNode[], searchPath: string): FileTreeNode | null => {
      for (const node of nodes) {
        if (node.path === searchPath) {
          return node;
        }
        if (node.children) {
          const found = findNodeByPath(node.children, searchPath);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findNodeByPath(fileTree, targetPath) !== null;
  };

  const handleSwitchSettingsType = async () => {
    if (!selectedNode || selectedNode.type !== 'file' || selectedNode.fileType !== 'settings') return;
    
    setIsSwitchingType(true);
    
    // Store the current node info before clearing
    const currentPath = selectedNode.path;
    
    try {
      const result = await FileSystemService.switchSettingsFileType(currentPath);
      
      toast({
        title: 'Settings type switched',
        description: `Successfully switched to ${result.newType} settings`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Clear selection and refresh tree
      clearSelection();
      
      // Small delay to ensure server has processed the change
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Refresh the file tree to get the updated state from server
      await refreshFileTree();
      
      // Select the switched file after tree refresh with increased delay
      setTimeout(() => {
        selectNodeByPath(result.newPath);
      }, 500);
      
    } catch (error) {
      toast({
        title: 'Error switching settings type',
        description: (error as Error).message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSwitchingType(false);
    }
  };

  const handleStartRename = () => {
    if (!selectedNode || selectedNode.type !== 'file' || (selectedNode.fileType !== 'memory' && selectedNode.fileType !== 'command')) return;
    
    // Initialize with current filename (without .inactive extension if present)
    const currentName = selectedNode.isInactive 
      ? selectedNode.name.replace('.inactive', '')
      : selectedNode.name;
    
    // Remove .md extension for editing
    const nameWithoutExtension = currentName.endsWith('.md') 
      ? currentName.slice(0, -3)
      : currentName;
    
    setNewFileName(nameWithoutExtension);
    setIsRenaming(true);
  };

  const handleRename = async () => {
    if (!selectedNode || selectedNode.type !== 'file' || !newFileName.trim()) return;

    // Validate and automatically add .md extension if missing
    let trimmedName = newFileName.trim();
    if (!trimmedName.endsWith('.md')) {
      trimmedName = `${trimmedName}.md`;
    }

    // Check if name changed
    const currentBaseName = selectedNode.isInactive 
      ? selectedNode.name.replace('.inactive', '')
      : selectedNode.name;
    if (trimmedName === currentBaseName) {
      setIsRenaming(false);
      return;
    }

    setIsRenameSaving(true);
    try {
      // Construct new path
      // Normalize path for cross-platform compatibility
      const normalizedPath = selectedNode.path.replace(/\\/g, '/');
      const directory = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
      const newBasePath = `${directory}/${trimmedName}`;
      const newPath = selectedNode.isInactive ? `${newBasePath}.inactive` : newBasePath;

      // Use FileSystemService to rename the file
      await FileSystemService.renameFile(selectedNode.path, newPath);

      toast({
        title: 'File renamed',
        description: `Successfully renamed to ${trimmedName}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Reset rename state
      setIsRenaming(false);
      setNewFileName('');
      
      // Clear selection and refresh tree
      clearSelection();
      await refreshFileTree();
      
      // Select the renamed file after a short delay
      setTimeout(() => {
        selectNodeByPath(newPath);
      }, 500);

    } catch (error) {
      toast({
        title: 'Rename failed',
        description: (error as Error).message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsRenameSaving(false);
    }
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
    setNewFileName('');
  };

  if (!selectedNode) {
    return (
      <Box p={6} bg="gray.50" borderRadius="md" h="full">
        <VStack spacing={4} align="center" justify="center" h="full">
          <InfoIcon boxSize={8} color="gray.400" />
          <Text color="gray.600">Select a file to view details</Text>
        </VStack>
      </Box>
    );
  }

  if (selectedNode.type === 'directory') {
    return (
      <Box p={6} bg="gray.50" borderRadius="md" h="full">
        <VStack spacing={4} align="start">
          <HStack>
            <InfoIcon color="blue.500" />
            <Heading size="md">{selectedNode.name}</Heading>
          </HStack>
          <Text color="gray.600">Directory</Text>
          <Divider />
          <Text fontSize="sm" color="gray.500">
            Path: {selectedNode.path}
          </Text>
        </VStack>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box p={6} bg="gray.50" borderRadius="md" h="full">
        <VStack spacing={4} align="center" justify="center" h="full">
          <Spinner size="xl" color="blue.500" />
          <Text color="gray.600">Loading file content...</Text>
        </VStack>
      </Box>
    );
  }

  const renderFileTypeContent = () => {
    if (!selectedNode) return null;
    
    switch (selectedNode.fileType) {
      case 'memory':
        // Determine if this is a standard memory file (CLAUDE.md)
        const actualFileName = selectedNode.isInactive 
          ? selectedNode.name.replace('.inactive', '')
          : selectedNode.name;
        const isStandardFile = actualFileName === 'CLAUDE.md';
        
        return (
          <MemoryFileDetails
            content={content}
            isEditing={isEditing}
            onChange={setContent}
            analysis={analysis}
            isStandardFile={isStandardFile}
          />
        );
      case 'settings':
        return (
          <SettingsFileDetails
            content={content}
            isEditing={isEditing}
            onChange={setContent}
            analysis={analysis}
            fileName={selectedNode.name}
          />
        );
      case 'command':
        return (
          <CommandFileDetails
            content={content}
            isEditing={isEditing}
            onChange={setContent}
            analysis={analysis}
          />
        );
      default:
        return (
          <Alert status="warning">
            <AlertIcon />
            <AlertTitle>Unknown file type</AlertTitle>
            <AlertDescription>
              This file type is not recognized as a configuration file.
            </AlertDescription>
          </Alert>
        );
    }
  };

  const hasChanges = content !== originalContent;

  return (
    <VStack spacing={4} align="stretch" h="full">
      {/* Header */}
      <Box>
        <HStack justify="space-between" align="center">
          <HStack spacing={3} flex={1}>
            {isRenaming ? (
              <HStack spacing={2}>
                <Input
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  size="md"
                  placeholder="Enter filename..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleRename();
                    } else if (e.key === 'Escape') {
                      handleCancelRename();
                    }
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  colorScheme="green"
                  onClick={handleRename}
                  isLoading={isRenameSaving}
                  isDisabled={!newFileName.trim()}
                >
                  <CheckIcon />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelRename}
                  isDisabled={isRenameSaving}
                >
                  <CloseIcon />
                </Button>
              </HStack>
            ) : (
              <>
                <Heading size="md">{selectedNode.name}</Heading>
                {(selectedNode.fileType === 'memory' || selectedNode.fileType === 'command') && (
                  <Tooltip label="Rename file">
                    <IconButton
                      aria-label="Rename"
                      icon={<EditIcon />}
                      size="xs"
                      variant="ghost"
                      onClick={handleStartRename}
                      isDisabled={isEditing || isToggling}
                    />
                  </Tooltip>
                )}
              </>
            )}
            <Badge colorScheme={selectedNode.isInactive ? 'red' : (selectedNode.fileType === 'memory' ? 'purple' : selectedNode.fileType === 'settings' ? 'blue' : 'green')}>
              {selectedNode.fileType}
            </Badge>
            {selectedNode.isInactive && (
              <Badge colorScheme="orange">
                Inactive
              </Badge>
            )}
            {validation && (
              <Badge colorScheme={validation.valid ? 'green' : 'red'}>
                {validation.valid ? 'Valid' : 'Invalid'}
              </Badge>
            )}
            <Text fontSize="sm" color="gray.600" ml="auto">
              {selectedNode.path}
            </Text>
          </HStack>
          <HStack>
            <Tooltip label="Refresh">
              <IconButton
                aria-label="Refresh"
                icon={<RepeatIcon />}
                size="sm"
                variant="ghost"
                onClick={handleRefresh}
                isDisabled={isEditing || isRenaming}
              />
            </Tooltip>
            <Tooltip label={selectedNode.isInactive ? "Activate file" : "Deactivate file"}>
              <IconButton
                aria-label={selectedNode.isInactive ? "Activate" : "Deactivate"}
                icon={selectedNode.isInactive ? <ViewIcon /> : <ViewOffIcon />}
                size="sm"
                colorScheme={selectedNode.isInactive ? "green" : "orange"}
                variant="ghost"
                onClick={handleToggleActive}
                isLoading={isToggling}
                isDisabled={isEditing || isRenaming}
              />
            </Tooltip>
            {selectedNode.fileType === 'settings' && (
              <Tooltip 
                label={wouldSettingsTypeSwitchConflict() 
                  ? `Cannot switch: target file exists`
                  : `Switch to ${selectedNode.name === 'settings.json' || selectedNode.name === 'settings.json.inactive' ? 'local' : 'project'} settings`}
                maxWidth="200px"
                textAlign="center"
              >
                <IconButton
                  aria-label="Switch settings type"
                  icon={<ArrowUpDownIcon />}
                  size="sm"
                  colorScheme="blue"
                  variant="ghost"
                  onClick={handleSwitchSettingsType}
                  isLoading={isSwitchingType}
                  isDisabled={isEditing || isRenaming || isToggling || wouldSettingsTypeSwitchConflict()}
                />
              </Tooltip>
            )}
            {!isEditing && !isRenaming ? (
              <Button
                leftIcon={<EditIcon />}
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            ) : (!isRenaming && (
              <>
                <Button
                  leftIcon={<CheckIcon />}
                  size="sm"
                  colorScheme="green"
                  onClick={handleSave}
                  isLoading={isSaving}
                  isDisabled={!hasChanges}
                >
                  Save
                </Button>
                <Button
                  leftIcon={<CloseIcon />}
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                  isDisabled={isSaving}
                >
                  Cancel
                </Button>
              </>
            ))}
            <Tooltip label="Delete file">
              <IconButton
                aria-label="Delete"
                icon={<DeleteIcon />}
                size="sm"
                colorScheme="red"
                variant="ghost"
                onClick={handleDelete}
                isDisabled={isEditing || isRenaming}
              />
            </Tooltip>
          </HStack>
        </HStack>
      </Box>

      <Divider />

      {/* Validation Errors/Warnings */}
      {validation && !validation.valid && validation.errors && validation.errors.length > 0 && (
        <Box
          bg="red.50"
          border="1px solid"
          borderColor="red.200"
          borderRadius="md"
          p={4}
          mb={1}
          display="flex"
          alignItems="flex-start"
          gap={3}
        >
          <Box color="red.500" fontSize="lg" mt={1}>
            ⚠️
          </Box>
          <Box flex="1">
            <Text fontWeight="bold" color="red.800" mb={2}>
              Validation Errors ({validation.errors.length})
            </Text>
            <Box>
              {validation.errors.map((error, index) => (
                <Text key={index} fontSize="sm" mb={1}>
                  {typeof error === 'object' && error.line ? `Line ${error.line}: ` : `Error ${index + 1}: `}
                  {typeof error === 'string' ? error : (error.message || JSON.stringify(error))}
                  {typeof error === 'object' && error.column && ` (col ${error.column})`}
                </Text>
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {validation && validation.warnings && validation.warnings.length > 0 && validation.warnings.some(w => w.message && w.message.trim()) && (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Warnings</AlertTitle>
            <VStack align="start" spacing={1} mt={2}>
              {validation.warnings.filter(w => w.message && w.message.trim()).map((warning, index) => (
                <Text key={index} fontSize="sm">
                  {warning.line && `Line ${warning.line}: `}{warning.message}
                </Text>
              ))}
            </VStack>
          </Box>
        </Alert>
      )}


      {/* File Content */}
      <Box flex="1" pt={4}>
        {renderFileTypeContent()}
      </Box>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete File"
        message={`Are you sure you want to delete "${selectedNode?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
        variant="danger"
      />

      {/* Unsaved Changes Dialog */}
      <AlertDialog
        isOpen={showUnsavedChangesDialog}
        leastDestructiveRef={cancelUnsavedRef}
        onClose={handleCancelSwitch}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Unsaved Changes
            </AlertDialogHeader>

            <AlertDialogBody>
              <Text>
                You have unsaved changes in "{selectedNode?.name}". 
                Do you want to save them before switching files?
              </Text>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button
                ref={cancelUnsavedRef}
                onClick={handleCancelSwitch}
                isDisabled={isSaving}
              >
                Stay Here
              </Button>
              <Button
                colorScheme="red"
                variant="ghost"
                onClick={handleDiscardAndSwitch}
                ml={3}
                isDisabled={isSaving}
              >
                Discard & Switch
              </Button>
              <Button
                colorScheme="orange"
                onClick={handleSaveAndSwitch}
                ml={3}
                isLoading={isSaving}
                loadingText="Saving..."
              >
                Save & Switch
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
};