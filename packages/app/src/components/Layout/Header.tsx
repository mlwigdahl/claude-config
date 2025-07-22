import React from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  HStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { useFileSystem } from '../../contexts/FileSystemContext';

const Header: React.FC = () => {
  const bg = useColorModeValue('blue.500', 'blue.700');
  const color = useColorModeValue('white', 'gray.100');
  const { projectRoot } = useFileSystem();

  const getProjectName = () => {
    if (!projectRoot) return 'No Project';
    return projectRoot.split('/').pop() || 'Unknown Project';
  };

  return (
    <Box bg={bg} color={color} px={6} py={4}>
      <Flex align="center" justify="space-between">
        <Heading as="h1" size="lg">
          Claude Code Configuration Manager
        </Heading>
        
        <HStack spacing={4} align="center">
          <Text fontSize="sm" opacity={0.8}>
            Manage your Claude Code settings, commands, and memory files
          </Text>
          
          {projectRoot && (
            <Text fontSize="sm" fontWeight="medium">
              Project: {getProjectName()}
            </Text>
          )}
        </HStack>
      </Flex>
    </Box>
  );
};

export default Header;