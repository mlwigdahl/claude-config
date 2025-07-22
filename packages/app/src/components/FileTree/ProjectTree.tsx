import React, { useRef, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { useFileSystem } from '../../contexts/FileSystemContext';
import FileTree, { FileTreeRef } from './FileTree';
import DirectoryBrowser from '../DirectoryBrowser/DirectoryBrowser';
import CreateFilePanel from '../Creation/CreateFilePanel';

const ProjectTree: React.FC = () => {
  const fileTreeRef = useRef<FileTreeRef>(null);
  const [treeKey, setTreeKey] = useState(0);
  const { 
    projectRoot, 
    openDirectoryBrowser,
    closeDirectoryBrowser,
    selectProjectRoot, 
    fileTree, 
    isLoading, 
    error,
    showDirectoryBrowser,
    toggleNodeExpansion,
    selectNode,
    refreshFileTree,
    registerScrollToNode
  } = useFileSystem();

  // Force remount when tree structure changes
  useEffect(() => {
    setTreeKey(prev => prev + 1);
  }, [fileTree.length, JSON.stringify(fileTree.map(n => n.id))]);

  // Register the scroll callback with the context
  useEffect(() => {
    // Use a timeout to ensure the ref is set
    const timer = setTimeout(() => {
      if (fileTreeRef.current) {
        registerScrollToNode(fileTreeRef.current.scrollToNode);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [registerScrollToNode, fileTree]); // Re-register when tree changes
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box
      border="1px"
      borderColor={borderColor}
      borderRadius="md"
      p={4}
      h="full"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      <VStack spacing={4} align="stretch" h="full" overflow="hidden" minH={0}>
        <Heading as="h3" size="sm">
          Project Structure
        </Heading>
        
        {!projectRoot ? (
          <VStack spacing={4} flex={1} justify="center">
            <Text fontSize="sm" color="gray.600" textAlign="center">
              No project selected
            </Text>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={openDirectoryBrowser}
              isLoading={isLoading}
              loadingText="Selecting..."
            >
              Select Project
            </Button>
          </VStack>
        ) : (
          <VStack spacing={3} align="stretch" h="full" minH={0}>
            <VStack spacing={2} align="stretch" flexShrink={0}>
              <Text fontSize="xs" color="gray.600" wordBreak="break-all">
                {projectRoot}
              </Text>
              
              <Button
                size="xs"
                variant="outline"
                onClick={openDirectoryBrowser}
                isLoading={isLoading}
              >
                Change Project
              </Button>
            </VStack>

            {/* File Tree */}
            <Box flex={1} minH={0} overflow="auto">
              <FileTree
                key={`tree-${treeKey}`}
                ref={fileTreeRef}
                nodes={fileTree}
                isLoading={isLoading}
                error={error}
                onToggleExpand={toggleNodeExpansion}
                onSelectNode={selectNode}
                onRefresh={refreshFileTree}
              />
            </Box>

            {/* Create New File Section */}
            <VStack spacing={2} align="stretch" pt={2} flexShrink={0}>
              <Text fontSize="xs" fontWeight="semibold" color="gray.600">
                Create New File
              </Text>
              <CreateFilePanel />
            </VStack>
          </VStack>
        )}
      </VStack>

      {/* Directory Browser Modal */}
      {showDirectoryBrowser && (
        <DirectoryBrowser
          isOpen={showDirectoryBrowser}
          onClose={closeDirectoryBrowser}
          onSelect={selectProjectRoot}
          initialPath={projectRoot}
        />
      )}
    </Box>
  );
};

export default ProjectTree;