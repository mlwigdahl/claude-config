import React from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { useFileSystem } from '../../contexts/FileSystemContext';

const UserFilesTree: React.FC = () => {
  const { userFiles } = useFileSystem();
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  return (
    <Box
      border="1px"
      borderColor={borderColor}
      borderRadius="md"
      p={4}
      h="35%"
      overflow="auto"
    >
      <VStack spacing={4} align="stretch">
        <Heading as="h3" size="sm">
          User Files
        </Heading>
        
        {/* User files tree will be implemented in Phase 2.2 */}
        <Box fontSize="sm" color="gray.500">
          {userFiles.length === 0 ? (
            <Text>No user configuration files found</Text>
          ) : (
            <Text>{userFiles.length} user files detected</Text>
          )}
        </Box>
      </VStack>
    </Box>
  );
};

export default UserFilesTree;