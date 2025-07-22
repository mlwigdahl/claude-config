import React from 'react';
import {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Box,
  CloseButton,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { useOperations } from '../../contexts/OperationsContext';

const ErrorInfoPanel: React.FC = () => {
  const { errors, infos, clearError, clearInfo } = useOperations();
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  if (errors.length === 0 && infos.length === 0) {
    return null;
  }

  return (
    <Box
      border="1px"
      borderColor={borderColor}
      borderRadius="md"
      p={4}
      maxH="200px"
      overflow="auto"
    >
      <VStack spacing={2} align="stretch">
        {errors.map((error, index) => (
          <Alert key={`error-${index}`} status="error" borderRadius="md">
            <AlertIcon />
            <Box flex="1">
              <AlertTitle fontSize="sm">{error.title}</AlertTitle>
              <AlertDescription fontSize="xs">
                {error.message}
              </AlertDescription>
            </Box>
            <CloseButton
              size="sm"
              onClick={() => clearError(index)}
            />
          </Alert>
        ))}
        
        {infos.map((info, index) => (
          <Alert key={`info-${index}`} status="info" borderRadius="md">
            <AlertIcon />
            <Box flex="1">
              <AlertTitle fontSize="sm">{info.title}</AlertTitle>
              <AlertDescription fontSize="xs">
                {info.message}
              </AlertDescription>
            </Box>
            <CloseButton
              size="sm"
              onClick={() => clearInfo(index)}
            />
          </Alert>
        ))}
      </VStack>
    </Box>
  );
};

export default ErrorInfoPanel;