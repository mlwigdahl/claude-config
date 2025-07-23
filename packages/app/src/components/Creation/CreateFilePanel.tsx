import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Text,
  VStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
  Input,
  Select,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  FormErrorMessage,
  FormHelperText,
} from '@chakra-ui/react';
import { FileCRUDService } from '../../services/fileCRUDService';
import { useFileSystem } from '../../contexts/FileSystemContext';
import { validateDirectoryPath, getPreferredDirectoryPath } from '../../utils/pathValidation';
import { FileSystemService } from '../../services/fileSystemService';

// Helper functions for .claude directory validation
const isClaudeDirectory = (path: string): boolean => {
  return path.endsWith('/.claude') || path === '.claude';
};

const isInClaudeSubdirectory = (path: string): boolean => {
  const claudeIndex = path.lastIndexOf('/.claude/');
  return claudeIndex !== -1 && claudeIndex < path.length - 8; // Has content after /.claude/
};

const autoFixClaudePath = (path: string): string => {
  if (!isClaudeDirectory(path) && !isInClaudeSubdirectory(path)) {
    return `${path}/.claude`.replace(/\/+/g, '/');
  }
  return path;
};

// Helper functions for command file directory validation
const hasClaudeInAncestorPath = (path: string): boolean => {
  return path.includes('/.claude/') || path.includes('/.claude');
};

const includesClaudeCommands = (path: string): boolean => {
  return path.includes('/.claude/commands');
};

const autoFixCommandPath = (path: string): string => {
  // If it's a .claude directory, add /commands
  if (isClaudeDirectory(path)) {
    return `${path}/commands`.replace(/\/+/g, '/');
  }
  
  // If it doesn't have .claude in ancestor path, add .claude/commands
  if (!hasClaudeInAncestorPath(path)) {
    return `${path}/.claude/commands`.replace(/\/+/g, '/');
  }
  
  return path;
};

// Helper functions for command directory validation and namespace logic
const isImmediateChildOfCommands = (path: string): boolean => {
  const commandsIndex = path.lastIndexOf('/.claude/commands');
  if (commandsIndex === -1) return false;
  
  const afterCommands = path.substring(commandsIndex + 17); // Length of '/.claude/commands'
  // Should have exactly one more directory level (no slashes except at start)
  return afterCommands.startsWith('/') && !afterCommands.substring(1).includes('/') && afterCommands.length > 1;
};

const getNamespaceFromPath = (path: string): string => {
  if (!isImmediateChildOfCommands(path)) return '';
  
  const commandsIndex = path.lastIndexOf('/.claude/commands');
  const afterCommands = path.substring(commandsIndex + 17); // Length of '/.claude/commands'
  return afterCommands.substring(1); // Remove leading slash
};

const hasInvalidCommandsHierarchy = (path: string): boolean => {
  // Return true if path contains .claude/commands but is not immediate child or commands itself
  if (!includesClaudeCommands(path)) return false;
  
  // If it ends with exactly /.claude/commands, it's valid
  if (path.endsWith('/.claude/commands')) return false;
  
  // If it's an immediate child of commands, it's valid
  if (isImmediateChildOfCommands(path)) return false;
  
  // Otherwise it's deeper than allowed
  return true;
};

const CreateFilePanel: React.FC = () => {
  const { isOpen, onOpen, onClose: originalOnClose } = useDisclosure();
  const { projectRoot, selectedNode, refreshFileTree, selectNodeByPath } = useFileSystem();
  const toast = useToast();
  
  const [fileType, setFileType] = useState<'memory' | 'settings' | 'command'>('memory');
  const [fileName, setFileName] = useState('');
  const [directoryPath, setDirectoryPath] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [commandName, setCommandName] = useState('');
  const [commandNamespace, setCommandNamespace] = useState('');
  const [settingsType, setSettingsType] = useState<'project' | 'user'>('project');
  const [pathValidation, setPathValidation] = useState<{isValid: boolean; errorMessage?: string; suggestedPath?: string}>({isValid: true});
  const [fileNameWarning, setFileNameWarning] = useState<string>('');
  const [fileExistsWarning, setFileExistsWarning] = useState<string>('');
  const [fileExists, setFileExists] = useState<boolean>(false);
  const [settingsPathWarning, setSettingsPathWarning] = useState<string>('');
  const [isSettingsPathValid, setIsSettingsPathValid] = useState<boolean>(true);
  const [commandPathWarning, setCommandPathWarning] = useState<string>('');
  const [isCommandPathValid, setIsCommandPathValid] = useState<boolean>(true);
  const [directoryCreationInfo, setDirectoryCreationInfo] = useState<string>('');

  // Update directory path when file type or selected node changes
  useEffect(() => {
    const selectedPath = selectedNode?.type === 'directory' 
      ? selectedNode.path 
      : selectedNode?.path ? selectedNode.path.substring(0, selectedNode.path.lastIndexOf('/')) : undefined;
    
    let preferredPath = getPreferredDirectoryPath(fileType, selectedPath, projectRoot);
    
    // Auto-fix path for settings files
    if (fileType === 'settings') {
      preferredPath = autoFixClaudePath(preferredPath);
    }
    
    // Auto-fix path for command files
    if (fileType === 'command') {
      preferredPath = autoFixCommandPath(preferredPath);
    }
    
    setDirectoryPath(preferredPath);
  }, [fileType, selectedNode, projectRoot]);

  // Validate directory path whenever it changes
  useEffect(() => {
    if (directoryPath) {
      const validation = validateDirectoryPath(directoryPath, fileType, projectRoot);
      setPathValidation(validation);
      
      // Additional validation for settings files
      if (fileType === 'settings') {
        if (isInClaudeSubdirectory(directoryPath)) {
          setSettingsPathWarning('Settings files may only be created in top-level .claude directories.');
          setIsSettingsPathValid(false);
        } else if (!isClaudeDirectory(directoryPath)) {
          setSettingsPathWarning('Settings files may only be created in top-level .claude directories.');
          setIsSettingsPathValid(false);
        } else {
          setSettingsPathWarning('');
          setIsSettingsPathValid(true);
        }
      } else {
        setSettingsPathWarning('');
        setIsSettingsPathValid(true);
      }

      // Additional validation for command files
      if (fileType === 'command') {
        if (!includesClaudeCommands(directoryPath)) {
          setCommandPathWarning('Commands must be placed in the .claude/commands hierarchy.');
          setIsCommandPathValid(false);
        } else if (hasInvalidCommandsHierarchy(directoryPath)) {
          setCommandPathWarning('Commands can only be placed in .claude/commands or immediate subdirectories of .claude/commands.');
          setIsCommandPathValid(false);
        } else {
          setCommandPathWarning('');
          setIsCommandPathValid(true);
        }
        
        // Simple directory existence check - just check if the final augmented path exists
        const checkDirectoryAndSetInfo = async () => {
          try {
            const directoryExists = await FileSystemService.directoryExists(directoryPath);
            
            if (directoryExists) {
              setDirectoryCreationInfo('');
            } else {
              setDirectoryCreationInfo('Directory does not exist but will be created.');
            }
          } catch (error) {
            // If we can't check existence, don't show creation messages
            setDirectoryCreationInfo('');
          }
        };
        
        checkDirectoryAndSetInfo();
      } else {
        setCommandPathWarning('');
        setIsCommandPathValid(true);
        setDirectoryCreationInfo('');
      }
    } else {
      setPathValidation({isValid: true});
      setSettingsPathWarning('');
      setIsSettingsPathValid(true);
      setCommandPathWarning('');
      setIsCommandPathValid(true);
      setDirectoryCreationInfo('');
    }
  }, [directoryPath, fileType, projectRoot]);

  // Auto-populate namespace for command files based on directory path (only on initial load)
  useEffect(() => {
    if (fileType === 'command' && directoryPath && !commandNamespace) {
      const suggestedNamespace = getNamespaceFromPath(directoryPath);
      if (suggestedNamespace) {
        setCommandNamespace(suggestedNamespace);
      }
    }
  }, [directoryPath, fileType]);

  // Update directory path when namespace changes for command files
  useEffect(() => {
    if (fileType === 'command' && directoryPath) {
      if (commandNamespace) {
        // Only update if the current path doesn't already end with the namespace
        if (!directoryPath.endsWith(`/${commandNamespace}`)) {
          let newPath;
          
          // Normalize Windows paths
          const normalizedDirPath = directoryPath.replace(/\\/g, '/');
          
          // If current path ends with .claude/commands, append namespace
          if (normalizedDirPath.endsWith('/.claude/commands')) {
            newPath = `${normalizedDirPath}/${commandNamespace}`.replace(/\/+/g, '/');
          }
          // If current path already has a namespace, replace it
          else if (normalizedDirPath.includes('/.claude/commands/')) {
            const commandsIndex = normalizedDirPath.lastIndexOf('/.claude/commands');
            const basePath = normalizedDirPath.substring(0, commandsIndex + 17); // Include '/.claude/commands'
            newPath = `${basePath}/${commandNamespace}`.replace(/\/+/g, '/');
          }
          
          if (newPath && newPath !== directoryPath) {
            setDirectoryPath(newPath);
          }
        }
      } else {
        // Namespace is empty, reset to base .claude/commands path
        if (directoryPath.includes('/.claude/commands/')) {
          const commandsIndex = directoryPath.lastIndexOf('/.claude/commands');
          const basePath = directoryPath.substring(0, commandsIndex + 17); // Include '/.claude/commands'
          if (basePath !== directoryPath) {
            setDirectoryPath(basePath);
          }
        }
      }
    }
  }, [commandNamespace, fileType, directoryPath]);

  // Update file name when settings type changes
  useEffect(() => {
    if (fileType === 'settings') {
      const newFileName = settingsType === 'project' ? 'settings.json' : 'settings.local.json';
      setFileName(newFileName);
    }
  }, [fileType, settingsType]);

  // Validate file name for memory files and check for non-standard names
  useEffect(() => {
    if (fileType === 'memory' && fileName) {
      const nameWithoutExt = fileName.replace(/\.md$/, '');
      if (nameWithoutExt !== 'CLAUDE') {
        setFileNameWarning('This is a non-standard memory file name. It must be included from a standard CLAUDE.md file to be used.');
      } else {
        setFileNameWarning('');
      }
    } else {
      setFileNameWarning('');
    }
  }, [fileName, fileType]);

  // Check if file already exists
  useEffect(() => {
    const checkFileExists = async () => {
      if (!directoryPath) {
        setFileExists(false);
        setFileExistsWarning('');
        return;
      }

      let finalFileName = '';
      
      if (fileType === 'memory') {
        if (!fileName) return;
        finalFileName = fileName.includes('.') ? fileName : `${fileName}.md`;
      } else if (fileType === 'command') {
        if (!commandName) return;
        finalFileName = `${commandName}.md`;
      } else if (fileType === 'settings') {
        if (!fileName) return;
        finalFileName = fileName;
      }

      if (!finalFileName) {
        setFileExists(false);
        setFileExistsWarning('');
        return;
      }

      // Normalize Windows paths
      const normalizedDir = directoryPath.replace(/\\/g, '/');
      const filePath = `${normalizedDir}/${finalFileName}`.replace(/\/+/g, '/');
      
      try {
        const exists = await FileSystemService.fileExists(filePath);
        setFileExists(exists);
        if (exists) {
          setFileExistsWarning(`A file named "${finalFileName}" already exists in this directory.`);
        } else {
          setFileExistsWarning('');
        }
      } catch (error) {
        // If we can't check file existence, assume it doesn't exist
        setFileExists(false);
        setFileExistsWarning('');
      }
    };

    checkFileExists();
  }, [fileName, commandName, directoryPath, fileType]);

  // Custom close handler to clear all error states
  const onClose = () => {
    setFileNameWarning('');
    setFileExistsWarning('');
    setFileExists(false);
    setSettingsPathWarning('');
    setIsSettingsPathValid(true);
    setPathValidation({isValid: true});
    originalOnClose();
  };

  const handleCreateFile = async () => {
    if (!projectRoot) {
      toast({
        title: 'No project selected',
        description: 'Please select a project directory first',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      return;
    }

    const targetPath = directoryPath || projectRoot;
    
    setIsCreating(true);
    try {
      const templateOptions: {
        name?: string;
        namespace?: string;
        type?: 'project' | 'user';
      } = {};
      
      // Handle file name with extension for memory files and command files
      let finalFileName = fileName;
      if (fileType === 'memory' && !fileName.includes('.')) {
        finalFileName = `${fileName}.md`;
      } else if (fileType === 'command') {
        // For command files, use commandName + .md extension
        finalFileName = commandName ? `${commandName}.md` : '';
      }
      
      if (fileType === 'command') {
        templateOptions.name = commandName;
        templateOptions.namespace = commandNamespace;
      } else if (fileType === 'settings') {
        templateOptions.type = settingsType;
      }

      const result = await FileCRUDService.createFile({
        fileType,
        fileName: finalFileName,
        directoryPath: targetPath,
        templateOptions,
      });

      if (!result.success) {
        toast({
          title: 'Failed to create file',
          description: result.error || result.message,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      // Check path validation before creating
      if (!pathValidation.isValid) {
        toast({
          title: 'Invalid directory path',
          description: pathValidation.errorMessage,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
        return;
      }

      toast({
        title: 'File created successfully',
        description: `Created ${result.data?.name} in ${targetPath}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Reset form
      setFileName('');
      setDirectoryPath('');
      setCommandName('');
      setCommandNamespace('');
      setFileType('memory');
      setSettingsType('project');
      setFileNameWarning('');
      setFileExistsWarning('');
      setFileExists(false);
      setSettingsPathWarning('');
      setIsSettingsPathValid(true);
      setCommandPathWarning('');
      setIsCommandPathValid(true);
      setDirectoryCreationInfo('');
      onClose();

      // Refresh the file tree and select the newly created file
      await refreshFileTree();
      
      // Select the newly created file by path
      if (result.data?.path) {
        // Need a longer delay to ensure the tree DOM is updated after refresh
        setTimeout(() => {
          selectNodeByPath(result.data.path);
        }, 300);
      }
    } catch (error) {
      toast({
        title: 'Error creating file',
        description: (error as Error).message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateMemory = () => {
    setFileType('memory');
    setFileName('CLAUDE');
    // Clear all error states when opening a new modal
    setFileNameWarning('');
    setFileExistsWarning('');
    setFileExists(false);
    setSettingsPathWarning('');
    setIsSettingsPathValid(true);
    setPathValidation({isValid: true});
    // Directory path will be set by useEffect when fileType changes
    onOpen();
  };

  const handleCreateSettings = () => {
    setFileType('settings');
    // Clear all error states when opening a new modal
    setFileNameWarning('');
    setFileExistsWarning('');
    setFileExists(false);
    setSettingsPathWarning('');
    setIsSettingsPathValid(true);
    setPathValidation({isValid: true});
    // File name will be set by useEffect when fileType and settingsType changes
    // Directory path will be set by useEffect when fileType changes
    onOpen();
  };

  const handleCreateCommand = () => {
    setFileType('command');
    setCommandName('');
    setCommandNamespace('');
    // Clear all error states when opening a new modal
    setFileNameWarning('');
    setFileExistsWarning('');
    setFileExists(false);
    setSettingsPathWarning('');
    setIsSettingsPathValid(true);
    setPathValidation({isValid: true});
    // Directory path will be set by useEffect when fileType changes
    onOpen();
  };

  return (
    <>
      <VStack spacing={2} align="stretch">
        <ButtonGroup size="xs" spacing={1} variant="outline">
          <Button
            colorScheme="purple"
            onClick={handleCreateMemory}
            isDisabled={!projectRoot}
            flex={1}
          >
            Memory
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleCreateSettings}
            isDisabled={!projectRoot}
            flex={1}
          >
            Settings
          </Button>
          <Button
            colorScheme="green"
            onClick={handleCreateCommand}
            isDisabled={!projectRoot}
            flex={1}
          >
            Command
          </Button>
        </ButtonGroup>
        
        {!projectRoot && (
          <Text fontSize="xs" color="gray.500" textAlign="center">
            Select a project first
          </Text>
        )}
      </VStack>

      {/* Create File Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New {fileType.charAt(0).toUpperCase() + fileType.slice(1)} File</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              {/* File Type Information */}
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <Box>
                  <AlertTitle>
                    {fileType === 'memory' && 'Memory File (CLAUDE.md)'}
                    {fileType === 'settings' && 'Settings File (settings.json)'}
                    {fileType === 'command' && 'Command File (*.md)'}
                  </AlertTitle>
                  <AlertDescription fontSize="sm">
                    {fileType === 'memory' && 'Contains project-specific instructions and context for Claude Code.'}
                    {fileType === 'settings' && 'Contains configuration settings, hooks, and preferences.'}
                    {fileType === 'command' && 'Contains custom commands and templates for Claude Code.'}
                  </AlertDescription>
                </Box>
              </Alert>

              {/* Command Name for command files, File Name for others */}
              {fileType === 'command' ? (
                <FormControl>
                  <FormLabel>Command Name</FormLabel>
                  <Input
                    value={commandName}
                    onChange={(e) => setCommandName(e.target.value)}
                    placeholder="my-command"
                  />
                  {fileExistsWarning && (
                    <Alert status="error" mt={2} borderRadius="md">
                      <AlertIcon />
                      <Text fontSize="sm">{fileExistsWarning}</Text>
                    </Alert>
                  )}
                  {commandName && (
                    <FormHelperText>
                      <Text fontSize="xs" color="blue.500">
                        File will be created as "{commandName}.md"
                      </Text>
                    </FormHelperText>
                  )}
                </FormControl>
              ) : (
                <FormControl>
                  <FormLabel>File Name</FormLabel>
                  <Input
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder={
                      fileType === 'memory' ? 'CLAUDE' :
                      fileType === 'settings' ? 'settings.json' :
                      'my-command.md'
                    }
                    isReadOnly={fileType === 'settings'}
                    bg={fileType === 'settings' ? 'gray.50' : 'white'}
                  />
                  {fileNameWarning && (
                    <Alert status="warning" mt={2} borderRadius="md">
                      <AlertIcon />
                      <Text fontSize="sm">{fileNameWarning}</Text>
                    </Alert>
                  )}
                  {fileExistsWarning && (
                    <Alert status="error" mt={2} borderRadius="md">
                      <AlertIcon />
                      <Text fontSize="sm">{fileExistsWarning}</Text>
                    </Alert>
                  )}
                  {fileType === 'memory' && !fileName.includes('.') && fileName && (
                    <FormHelperText>
                      <Text fontSize="xs" color="blue.500">
                        File will be created as "{fileName}.md"
                      </Text>
                    </FormHelperText>
                  )}
                </FormControl>
              )}

              {/* Directory Path */}
              <FormControl isInvalid={!pathValidation.isValid}>
                <FormLabel>Directory Path</FormLabel>
                <Input
                  value={directoryPath}
                  onChange={(e) => setDirectoryPath(e.target.value)}
                  placeholder={projectRoot || '/path/to/directory'}
                  borderColor={!pathValidation.isValid ? 'red.500' : undefined}
                  _focus={{
                    borderColor: !pathValidation.isValid ? 'red.500' : 'blue.500',
                    boxShadow: !pathValidation.isValid ? '0 0 0 1px red.500' : undefined
                  }}
                  isReadOnly={true}
                  bg="gray.50"
                />
                {!pathValidation.isValid && (
                  <FormErrorMessage>
                    {pathValidation.errorMessage}
                  </FormErrorMessage>
                )}
                {!pathValidation.isValid && pathValidation.suggestedPath && (
                  <FormHelperText>
                    <Text fontSize="xs" color="blue.500" cursor="pointer" 
                          onClick={() => setDirectoryPath(pathValidation.suggestedPath!)}>
                      Click to use suggested path: {pathValidation.suggestedPath}
                    </Text>
                  </FormHelperText>
                )}
                {pathValidation.isValid && fileType === 'command' && (
                  <FormHelperText>
                    Command files should be placed in .claude/commands directory
                  </FormHelperText>
                )}
                {settingsPathWarning && (
                  <FormErrorMessage>
                    {settingsPathWarning}
                  </FormErrorMessage>
                )}
                {commandPathWarning && (
                  <FormErrorMessage>
                    {commandPathWarning}
                  </FormErrorMessage>
                )}
                {directoryCreationInfo && (
                  <FormHelperText>
                    <Text fontSize="xs" color="blue.500">
                      {directoryCreationInfo}
                    </Text>
                  </FormHelperText>
                )}
              </FormControl>

              {/* Command-specific options */}
              {fileType === 'command' && (
                <FormControl>
                  <FormLabel>Namespace</FormLabel>
                  <Input
                    value={commandNamespace}
                    onChange={(e) => setCommandNamespace(e.target.value)}
                    placeholder="project"
                  />
                </FormControl>
              )}

              {/* Settings-specific options */}
              {fileType === 'settings' && (
                <FormControl>
                  <FormLabel>Settings Type</FormLabel>
                  <Select
                    value={settingsType}
                    onChange={(e) => setSettingsType(e.target.value as 'project' | 'user')}
                  >
                    <option value="project">Project Settings</option>
                    <option value="user">User Settings</option>
                  </Select>
                </FormControl>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isCreating}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleCreateFile}
              isLoading={isCreating}
              loadingText="Creating..."
              isDisabled={
                isCreating || 
                !pathValidation.isValid || 
                !directoryPath.trim() || 
                fileExists || 
                !isSettingsPathValid || 
                !isCommandPathValid ||
                (fileType === 'command' && !commandName.trim()) ||
                (fileType !== 'command' && !fileName.trim())
              }
            >
              Create File
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default CreateFilePanel;