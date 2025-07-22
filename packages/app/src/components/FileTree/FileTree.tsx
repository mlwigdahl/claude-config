import React, { useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  Box,
  VStack,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  Flex,
  Badge,
  HStack,
  IconButton,
  Tooltip,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription
} from '@chakra-ui/react';
import { SearchIcon, RepeatIcon } from '@chakra-ui/icons';
import TreeNode from './TreeNode';
import type { FileTreeNode, TreeSearchOptions } from '../../types/index.js';
import { FileSystemService } from '../../services/fileSystemService.js';

interface FileTreeProps {
  nodes: FileTreeNode[];
  isLoading?: boolean;
  error?: string | null;
  onToggleExpand: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onRefresh?: () => void;
}

export interface FileTreeRef {
  scrollToNode: (nodeId: string) => void;
}

const FileTree = forwardRef<FileTreeRef, FileTreeProps>(({
  nodes,
  isLoading = false,
  error,
  onToggleExpand,
  onSelectNode,
  onRefresh
}, ref) => {
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  

  // Expose scroll method through ref
  useImperativeHandle(ref, () => ({
    scrollToNode: (nodeId: string) => {
      // Retry logic to handle DOM updates after tree refresh
      const attemptScroll = (attempt: number = 1, maxAttempts: number = 5) => {
        const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
        const scrollContainer = scrollContainerRef.current;
        
        if (nodeElement && scrollContainer) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const nodeRect = nodeElement.getBoundingClientRect();
          
          // Calculate the scroll position to put the node on the third visible line
          const nodeHeight = nodeRect.height;
          const targetOffset = nodeHeight * 2; // Position on third line (0-indexed)
          
          const scrollTop = scrollContainer.scrollTop + nodeRect.top - containerRect.top - targetOffset;
          
          scrollContainer.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          });
        } else if (attempt < maxAttempts) {
          // Retry with exponential backoff
          const delay = Math.min(100 * Math.pow(1.5, attempt - 1), 500);
          setTimeout(() => attemptScroll(attempt + 1, maxAttempts), delay);
        }
      };
      
      // Start with a small initial delay
      setTimeout(() => attemptScroll(), 100);
    }
  }), []);

  const searchOptions: TreeSearchOptions = {
    query: '',
    includeFiles: true,
    includeDirectories: true,
    fileTypes: [],
    caseSensitive: false
  };

  // Debounced search functionality
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) {
      return nodes;
    }

    const options: TreeSearchOptions = {
      ...searchOptions,
      query: searchQuery
    };

    return FileSystemService.searchTree(nodes, options);
  }, [nodes, searchQuery, searchOptions]);

  // Calculate statistics
  const stats = useMemo(() => {
    const calculateStats = (nodeList: FileTreeNode[]) => {
      let files = 0;
      let directories = 0;
      let configFiles = { memory: 0, settings: 0, command: 0 };

      const countNodes = (currentNodes: FileTreeNode[]) => {
        currentNodes.forEach(node => {
          if (node.type === 'file') {
            files++;
            if (node.fileType) {
              configFiles[node.fileType]++;
            }
          } else {
            directories++;
          }

          if (node.children) {
            countNodes(node.children);
          }
        });
      };

      countNodes(nodeList);
      return { files, directories, configFiles };
    };

    return calculateStats(searchQuery ? filteredNodes : nodes);
  }, [nodes, filteredNodes, searchQuery]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleRefresh = () => {
    setSearchQuery('');
    onRefresh?.();
  };

  if (error) {
    return (
      <Alert status="error">
        <Box>
          <Flex align="center" mb={2}>
            <AlertIcon />
            <AlertTitle>File Tree Error</AlertTitle>
          </Flex>
          <AlertDescription>{error}</AlertDescription>
        </Box>
      </Alert>
    );
  }

  return (
    <VStack spacing={4} align="stretch" h="full">
      {/* Search and Controls */}
      <VStack spacing={3} align="stretch">
        <HStack>
          <InputGroup size="sm" flex={1}>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={handleSearchChange}
              bg="white"
              _dark={{ bg: 'gray.700' }}
            />
          </InputGroup>
          
          {onRefresh && (
            <Tooltip label="Refresh file tree">
              <IconButton
                aria-label="Refresh"
                icon={<RepeatIcon />}
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                isLoading={isLoading}
              />
            </Tooltip>
          )}
        </HStack>

        {/* Quick Actions */}
        {searchQuery && (
          <HStack>
            <Text fontSize="xs" color="gray.600">
              Search results: {filteredNodes.length} items
            </Text>
            <Box flex={1} />
            <Text
              fontSize="xs"
              color="blue.500"
              cursor="pointer"
              onClick={handleClearSearch}
              _hover={{ textDecoration: 'underline' }}
            >
              Clear
            </Text>
          </HStack>
        )}

        {/* Statistics */}
        <HStack wrap="wrap" spacing={2}>
          {stats.configFiles.memory > 0 && (
            <Badge colorScheme="green" variant="subtle">
              {stats.configFiles.memory} memory
            </Badge>
          )}
          {stats.configFiles.settings > 0 && (
            <Badge colorScheme="orange" variant="subtle">
              {stats.configFiles.settings} settings
            </Badge>
          )}
          {stats.configFiles.command > 0 && (
            <Badge colorScheme="purple" variant="subtle">
              {stats.configFiles.command} command
            </Badge>
          )}
        </HStack>
      </VStack>

      {/* Tree Content */}
      <Box flex={1} overflowY="auto" ref={scrollContainerRef}>
        {isLoading ? (
          <Flex justify="center" align="center" h="200px">
            <VStack>
              <Spinner size="lg" />
              <Text fontSize="sm" color="gray.600">
                Loading file tree...
              </Text>
            </VStack>
          </Flex>
        ) : filteredNodes.length === 0 ? (
          <Flex justify="center" align="center" h="200px">
            <VStack>
              <Text fontSize="sm" color="gray.600">
                {searchQuery 
                  ? `No files found matching "${searchQuery}"`
                  : 'No files found'
                }
              </Text>
              {searchQuery && (
                <Text
                  fontSize="xs"
                  color="blue.500"
                  cursor="pointer"
                  onClick={handleClearSearch}
                  _hover={{ textDecoration: 'underline' }}
                >
                  Clear search to see all files
                </Text>
              )}
            </VStack>
          </Flex>
        ) : (
          <VStack spacing={0} align="stretch">
            {filteredNodes.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                onToggleExpand={onToggleExpand}
                onSelectNode={onSelectNode}
                searchQuery={searchQuery}
              />
            ))}
          </VStack>
        )}
      </Box>
    </VStack>
  );
});

FileTree.displayName = 'FileTree';

export default FileTree;