import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Box,
  Icon,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  Spinner,
  Alert,
  AlertIcon,
  useColorModeValue,
  Input,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import { ChevronRightIcon, ChevronUpIcon } from '@chakra-ui/icons';
import { FileSystemService, DirectoryEntry, DefaultDirectoryInfo } from '../../services/fileSystemService';

interface DirectoryBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

const DirectoryBrowser: React.FC<DirectoryBrowserProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath
}) => {
  const [defaultDirInfo, setDefaultDirInfo] = useState<DefaultDirectoryInfo | null>(null);
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualPath, setManualPath] = useState(initialPath || '');
  
  const bgSelected = useColorModeValue('blue.50', 'blue.900');
  const bgHover = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Load directory contents
  const loadDirectory = async (path: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await FileSystemService.listDirectory(path);
      // Filter to only show directories
      const directories = result.filter(entry => entry.type === 'directory');
      setEntries(directories);
      setCurrentPath(path);
      setManualPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate to parent directory (cross-platform)
  const navigateUp = () => {
    let parentPath: string;
    
    if (defaultDirInfo?.platform === 'win32') {
      // Windows path handling
      const pathParts = currentPath.split(/[\\/]/).filter(Boolean);
      if (pathParts.length === 0) {
        // Already at drives root
        return;
      } else if (pathParts.length === 1) {
        // At drive root, go to drives view
        setCurrentPath('');
        setManualPath('');
        setEntries([]);
        return;
      }
      // Go up one directory
      parentPath = pathParts.slice(0, -1).join('\\');
    } else {
      // Unix-like path handling (macOS, Linux)
      const pathParts = currentPath.split('/');
      if (pathParts.length <= 2) {
        parentPath = '/';
      } else {
        parentPath = pathParts.slice(0, -1).join('/') || '/';
      }
      loadDirectory(parentPath);
    }
    
    if (parentPath) {
      loadDirectory(parentPath);
    }
  };

  // Navigate to subdirectory
  const navigateToDirectory = (entry: DirectoryEntry) => {
    loadDirectory(entry.path);
  };

  // Handle manual path input
  const handleManualNavigation = () => {
    if (manualPath !== currentPath) {
      loadDirectory(manualPath);
    }
  };

  // Get breadcrumb items (cross-platform)
  const getBreadcrumbItems = () => {
    if (!currentPath || !defaultDirInfo) {
      return [{ name: 'Loading...', path: '' }];
    }

    if (defaultDirInfo.platform === 'win32') {
      // Windows path handling
      const parts = currentPath.split(/[\\/]/).filter(Boolean);
      if (parts.length === 0) return [{ name: 'Drives', path: '' }];
      
      const items = [];
      
      // Add drives root if we're deep enough
      if (parts.length > 1) {
        items.push({ name: 'Drives', path: '' });
      }
      
      // Add drive root
      if (parts.length > 0) {
        const drive = parts[0];
        items.push({ name: drive, path: drive + '\\' });
        
        // Add subsequent path parts
        let buildPath = drive;
        for (let i = 1; i < parts.length; i++) {
          buildPath += '\\' + parts[i];
          items.push({ name: parts[i], path: buildPath });
        }
      }
      
      return items;
    } else {
      // Unix-like path handling
      if (currentPath === '/') return [{ name: 'Root', path: '/' }];
      
      const parts = currentPath.split('/').filter(Boolean);
      const items = [{ name: 'Root', path: '/' }];
      
      let buildPath = '';
      for (const part of parts) {
        buildPath += '/' + part;
        items.push({ name: part, path: buildPath });
      }
      
      return items;
    }
  };

  // Load default directory info and initial directory when modal opens
  useEffect(() => {
    if (isOpen) {
      const initializeDirectory = async () => {
        try {
          // Get default directory info if we don't have it
          if (!defaultDirInfo) {
            const dirInfo = await FileSystemService.getDefaultDirectory();
            setDefaultDirInfo(dirInfo);
            
            // If no initial path was provided, use the default directory
            if (!initialPath) {
              setCurrentPath(dirInfo.defaultDirectory);
              setManualPath(dirInfo.defaultDirectory);
              await loadDirectory(dirInfo.defaultDirectory);
              return;
            }
          }
          
          // Load the current path (either initial or already set)
          const pathToLoad = currentPath || initialPath || defaultDirInfo?.defaultDirectory || '/';
          await loadDirectory(pathToLoad);
        } catch (error) {
          console.error('Failed to initialize directory browser:', error);
          setError(error instanceof Error ? error.message : 'Failed to initialize');
        }
      };
      
      initializeDirectory();
    }
  }, [isOpen, initialPath, defaultDirInfo]);

  const handleSelect = () => {
    onSelect(currentPath);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent maxH="80vh">
        <ModalHeader>Select Project Directory</ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Manual path input */}
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <Text color="gray.400">📁</Text>
              </InputLeftElement>
              <Input
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualNavigation()}
                placeholder="Enter directory path..."
              />
            </InputGroup>

            {/* Breadcrumb navigation */}
            <Breadcrumb separator={<ChevronRightIcon />} fontSize="sm">
              {getBreadcrumbItems().map((item, index) => (
                <BreadcrumbItem key={item.path || 'drives'}>
                  <BreadcrumbLink
                    onClick={() => {
                      if (item.path === '' && defaultDirInfo?.platform === 'win32') {
                        // Navigate to drives view
                        setCurrentPath('');
                        setManualPath('');
                        setEntries([]);
                      } else if (item.path) {
                        loadDirectory(item.path);
                      }
                    }}
                    cursor="pointer"
                    _hover={{ textDecoration: 'underline' }}
                  >
                    {item.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              ))}
            </Breadcrumb>

            {/* Directory listing */}
            <Box
              border="1px"
              borderColor={borderColor}
              borderRadius="md"
              minH="300px"
              maxH="400px"
              overflow="auto"
              p={2}
            >
              {isLoading ? (
                <VStack spacing={4} justify="center" h="200px">
                  <Spinner />
                  <Text fontSize="sm" color="gray.600">Loading directories...</Text>
                </VStack>
              ) : error ? (
                <Alert status="error">
                  <AlertIcon />
                  {error}
                </Alert>
              ) : (
                <VStack spacing={1} align="stretch">
                  {/* Parent directory option */}
                  {((defaultDirInfo?.platform === 'win32' && currentPath.split(/[\\/]/).filter(Boolean).length > 1) ||
                    (defaultDirInfo?.platform !== 'win32' && currentPath !== '/')) && (
                    <Box
                      p={2}
                      borderRadius="md"
                      cursor="pointer"
                      _hover={{ bg: bgHover }}
                      onClick={navigateUp}
                    >
                      <HStack spacing={2}>
                        <Icon as={ChevronUpIcon} color="gray.500" />
                        <Text fontSize="sm" color="gray.600">.. (Parent Directory)</Text>
                      </HStack>
                    </Box>
                  )}
                  
                  {/* Windows drives list when at root */}
                  {defaultDirInfo?.platform === 'win32' && 
                   currentPath === '' && 
                   defaultDirInfo.drives && 
                   defaultDirInfo.drives.map((drive) => (
                    <Box
                      key={drive}
                      p={2}
                      borderRadius="md"
                      cursor="pointer"
                      _hover={{ bg: bgHover }}
                      onDoubleClick={() => loadDirectory(drive + '\\')}
                    >
                      <HStack spacing={2}>
                        <Text color="blue.500">💾</Text>
                        <Text fontSize="sm">{drive} Drive</Text>
                      </HStack>
                    </Box>
                  ))}
                  
                  {/* Directory entries */}
                  {entries.length === 0 ? (
                    <Text fontSize="sm" color="gray.500" textAlign="center" py={8}>
                      No subdirectories found
                    </Text>
                  ) : (
                    entries.map((entry) => (
                      <Box
                        key={entry.path}
                        p={2}
                        borderRadius="md"
                        cursor="pointer"
                        _hover={{ bg: bgHover }}
                        onDoubleClick={() => navigateToDirectory(entry)}
                      >
                        <HStack spacing={2}>
                          <Text color="blue.500">📁</Text>
                          <Text fontSize="sm">{entry.name}</Text>
                        </HStack>
                      </Box>
                    ))
                  )}
                </VStack>
              )}
            </Box>

            {/* Current selection */}
            <Box p={3} bg={bgSelected} borderRadius="md">
              <Text fontSize="sm" color="gray.600">
                Selected Directory:
              </Text>
              <Text fontSize="sm" fontWeight="medium" wordBreak="break-all">
                {currentPath.replace(/\\/g, '/')}
              </Text>
            </Box>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSelect}>
            Select Directory
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default DirectoryBrowser;