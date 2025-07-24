import React from 'react';
import {
  Box,
  Flex,
  Icon,
  Text,
  Collapse,
  Badge,
  useColorModeValue
} from '@chakra-ui/react';
import { 
  ChevronRightIcon, 
  ChevronDownIcon
} from '@chakra-ui/icons';
import type { FileTreeNode } from '../../types/index.js';

interface TreeNodeProps {
  node: FileTreeNode;
  onToggleExpand: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  searchQuery?: string;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  onToggleExpand,
  onSelectNode,
  searchQuery = ''
}) => {
  const bgSelected = useColorModeValue('blue.50', 'blue.900');
  const bgHover = useColorModeValue('gray.50', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'gray.200');
  const textMuted = useColorModeValue('gray.600', 'gray.400');

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'directory') {
      onToggleExpand(node.id);
    }
  };

  const handleSelectNode = () => {
    onSelectNode(node.id);
  };

  const getFileTypeIcon = () => {
    // Special icons for root sections
    if (node.depth === 0 && node.name === 'Home Directory') {
      return '🏠';
    }
    if (node.depth === 0 && node.name === 'Project Directory') {
      return '💼';
    }
    
    // Use simple text-based icons for now
    if (node.type === 'directory') {
      return '📁';
    }

    // Return specific icons for different file types
    switch (node.fileType) {
      case 'memory':
        return '📝'; // Memory file icon
      case 'settings':
        return '⚙️'; // Settings file icon
      case 'command':
        return '⚡'; // Command file icon
      default:
        return '📄'; // Default file icon
    }
  };

  const getFileTypeColor = () => {
    if (node.type === 'directory') {
      return 'blue.500';
    }

    switch (node.fileType) {
      case 'memory':
        return 'green.500';
      case 'settings':
        return 'orange.500';
      case 'command':
        return 'purple.500';
      default:
        return 'gray.500';
    }
  };

  const getFileTypeBadgeColor = () => {
    switch (node.fileType) {
      case 'memory':
        // Check if this is a non-standard memory file (not CLAUDE.md)
        const actualFileName = node.isInactive ? node.name.replace('.inactive', '') : node.name;
        return actualFileName === 'CLAUDE.md' ? 'green' : 'orange';
      case 'settings':
        // Use validation state for settings files: green if valid, red if invalid
        return node.isValid ? 'green' : 'red';
      case 'command':
        return 'purple';
      default:
        return 'gray';
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query) {
      return <Text as="span">{text}</Text>;
    }

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <Text as="span">
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <Text as="mark" key={index} bg="yellow.200" color="black">
              {part}
            </Text>
          ) : (
            part
          )
        )}
      </Text>
    );
  };

  const fileIcon = getFileTypeIcon();
  const iconColor = getFileTypeColor();
  const paddingLeft = node.depth * 20 + 8;
  
  // Check if this is a root section node
  const isRootSection = node.depth === 0 && (
    node.name === 'Home Directory' || 
    node.name === 'Project Directory'
  );

  return (
    <Box mb={isRootSection ? 2 : 0}>
      {/* Node Row */}
      <Flex
        align="center"
        p={1}
        pl={`${paddingLeft}px`}
        cursor="pointer"
        bg={node.isSelected ? bgSelected : 'transparent'}
        _hover={{ bg: node.isSelected ? bgSelected : bgHover }}
        onClick={handleSelectNode}
        borderRadius="md"
        transition="background-color 0.2s"
        data-node-id={node.id}
      >
        {/* Expand/Collapse Icon */}
        <Box 
          w={4} 
          h={4} 
          mr={2}
          display="flex"
          alignItems="center"
          justifyContent="center"
          onClick={handleToggleExpand}
        >
          {node.type === 'directory' && node.hasChildren && (
            <Icon
              as={node.isExpanded ? ChevronDownIcon : ChevronRightIcon}
              w={3}
              h={3}
              color={textMuted}
              transition="transform 0.2s"
            />
          )}
        </Box>

        {/* File/Directory Icon */}
        <Text
          fontSize="md"
          mr={2}
          lineHeight="1"
          width="20px"
          textAlign="center"
          flexShrink={0}
        >
          {fileIcon}
        </Text>

        {/* File/Directory Name */}
        <Box flex={1} minWidth={0} position="relative">
          <Text 
            fontSize={isRootSection ? "md" : "sm"} 
            color={isRootSection ? "blue.600" : textColor}
            fontWeight={isRootSection ? 'bold' : (node.isSelected ? 'semibold' : 'normal')}
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
            pr={node.fileType ? "70px" : "8px"} // Reserve space for badge
            textTransform={isRootSection ? "uppercase" : "none"}
            letterSpacing={isRootSection ? "wide" : "normal"}
          >
            {highlightText(node.name, searchQuery)}
          </Text>

          {/* File Type Badge - Positioned absolutely at right edge */}
          {node.fileType && (
            <Badge
              position="absolute"
              right="0"
              top="50%"
              transform="translateY(-50%)"
              colorScheme={node.isInactive ? 'red' : getFileTypeBadgeColor()}
              variant="subtle"
              fontSize="xs"
              flexShrink={0}
              zIndex={1}
            >
              {node.fileType}
            </Badge>
          )}
        </Box>
      </Flex>

      {/* Children */}
      {node.type === 'directory' && node.children && (
        <Collapse in={node.isExpanded} animateOpacity>
          <Box>
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                onToggleExpand={onToggleExpand}
                onSelectNode={onSelectNode}
                searchQuery={searchQuery}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

export default TreeNode;