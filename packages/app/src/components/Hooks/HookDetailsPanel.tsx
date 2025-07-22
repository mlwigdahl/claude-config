import React from 'react';
import {
  Box,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { useHooks } from '../../contexts/HooksContext';

const HookDetailsPanel: React.FC = () => {
  const { selectedHook } = useHooks();
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const bgColor = useColorModeValue('white', 'gray.800');

  if (!selectedHook) {
    return null;
  }

  return (
    <Box
      border="1px"
      borderColor={borderColor}
      borderRadius="md"
      bg={bgColor}
      p={4}
      mt={4}
    >
      <Text fontSize="md" fontWeight="bold" mb={2}>
        Hook Details
      </Text>
      <Text fontSize="sm" color="gray.600">
        Hook management will be implemented in Phase 2.4
      </Text>
    </Box>
  );
};

export default HookDetailsPanel;