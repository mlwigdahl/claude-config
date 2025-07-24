import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Skeleton,
  SkeletonText,
  Progress,
  useColorModeValue,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

const pulse = keyframes`
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
`;

const slideIn = keyframes`
  0% { transform: translateX(-10px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
`;

interface TreeLoadingAnimationProps {
  rootName?: string;
}

const TreeLoadingAnimation: React.FC<TreeLoadingAnimationProps> = ({ rootName }) => {
  const [loadingMessage, setLoadingMessage] = useState('Discovering files...');
  const skeletonStartColor = useColorModeValue('gray.100', 'gray.700');
  const skeletonEndColor = useColorModeValue('gray.300', 'gray.600');
  
  // Cycle through loading messages
  useEffect(() => {
    const messages = [
      'Discovering files...',
      'Building directory structure...',
      'Scanning for configuration files...',
      'Organizing file tree...',
      'Almost ready...'
    ];
    
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setLoadingMessage(messages[index]);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Generate skeleton items with different depths and more realistic structure
  const skeletonItems = [
    { depth: 0, width: '120px', isFolder: true, hasChevron: true },
    { depth: 1, width: '100px', isFolder: true, hasChevron: true },
    { depth: 2, width: '140px', isFolder: false, hasChevron: false },
    { depth: 2, width: '110px', isFolder: false, hasChevron: false },
    { depth: 2, width: '95px', isFolder: false, hasChevron: false },
    { depth: 1, width: '90px', isFolder: true, hasChevron: true },
    { depth: 2, width: '130px', isFolder: false, hasChevron: false },
    { depth: 1, width: '115px', isFolder: true, hasChevron: false },
    { depth: 0, width: '110px', isFolder: true, hasChevron: true },
    { depth: 1, width: '120px', isFolder: false, hasChevron: false },
    { depth: 1, width: '105px', isFolder: false, hasChevron: false },
  ];

  return (
    <VStack spacing={4} align="stretch" p={4}>
      {/* Indeterminate progress bar */}
      <Box px={4}>
        <Progress 
          size="xs" 
          isIndeterminate 
          colorScheme="blue"
          borderRadius="full"
        />
      </Box>
      
      {/* Animated loading message */}
      <Text
        fontSize="sm"
        color="gray.600"
        textAlign="center"
        animation={`${pulse} 2s ease-in-out infinite`}
      >
        {loadingMessage}
      </Text>

      {/* Root node if provided */}
      {rootName && (
        <HStack spacing={2} opacity={0.7}>
          <Text fontSize="sm">📁</Text>
          <Text fontSize="sm" fontWeight="medium">{rootName}</Text>
        </HStack>
      )}

      {/* Skeleton tree structure */}
      <VStack spacing={1} align="stretch">
        {skeletonItems.map((item, index) => (
          <Box
            key={index}
            pl={`${item.depth * 20 + 8}px`}
            animation={`${slideIn} 0.3s ease-out ${index * 0.1}s both`}
          >
            <HStack spacing={2} align="center">
              {/* Chevron skeleton for folders */}
              <Box w={4} h={4} display="flex" alignItems="center" justifyContent="center">
                {item.hasChevron && (
                  <Skeleton
                    startColor={skeletonStartColor}
                    endColor={skeletonEndColor}
                    width="12px"
                    height="12px"
                    borderRadius="sm"
                  />
                )}
              </Box>
              
              {/* Folder/file icon skeleton */}
              <Skeleton
                startColor={skeletonStartColor}
                endColor={skeletonEndColor}
                width="20px"
                height="16px"
                borderRadius="sm"
              />
              
              {/* Name skeleton */}
              <SkeletonText
                startColor={skeletonStartColor}
                endColor={skeletonEndColor}
                noOfLines={1}
                width={item.width}
                skeletonHeight={2}
              />
              
              {/* File type badge skeleton (occasionally) */}
              {!item.isFolder && index % 3 === 0 && (
                <Skeleton
                  startColor={skeletonStartColor}
                  endColor={skeletonEndColor}
                  width="50px"
                  height="16px"
                  borderRadius="full"
                />
              )}
            </HStack>
          </Box>
        ))}
      </VStack>

      {/* Loading dots animation */}
      <HStack justify="center" spacing={1} mt={4}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            w={2}
            h={2}
            bg="blue.500"
            borderRadius="full"
            animation={`${pulse} 1.4s ease-in-out ${i * 0.2}s infinite`}
          />
        ))}
      </HStack>
    </VStack>
  );
};

export default TreeLoadingAnimation;