import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Flex,
  useColorModeValue,
} from '@chakra-ui/react';

interface ResizablePanelsProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  storageKey?: string;
}

export const ResizablePanels: React.FC<ResizablePanelsProps> = ({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 375,
  minLeftWidth = 200,
  maxLeftWidth = 600,
  storageKey = 'resizable-panels-width',
}) => {
  // Load saved width from localStorage or use default
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    if (typeof window !== 'undefined' && storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        return Math.max(minLeftWidth, Math.min(maxLeftWidth, parsed));
      }
    }
    return defaultLeftWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartWidth, setDragStartWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Color values for theming
  const dividerBg = useColorModeValue('gray.200', 'gray.700');
  const dividerHoverBg = useColorModeValue('gray.300', 'gray.600');
  const dividerActiveBg = useColorModeValue('blue.400', 'blue.500');

  // Save width to localStorage
  const saveWidth = useCallback((width: number) => {
    if (typeof window !== 'undefined' && storageKey) {
      localStorage.setItem(storageKey, width.toString());
    }
  }, [storageKey]);

  // Handle mouse down on divider
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragStartWidth(leftWidth);
  }, [leftWidth]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartX;
    const newWidth = Math.max(
      minLeftWidth,
      Math.min(maxLeftWidth, dragStartWidth + deltaX)
    );

    setLeftWidth(newWidth);
  }, [isDragging, dragStartX, dragStartWidth, minLeftWidth, maxLeftWidth]);

  // Handle mouse up - end drag
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      saveWidth(leftWidth);
    }
  }, [isDragging, leftWidth, saveWidth]);

  // Add global mouse event listeners during drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <Flex ref={containerRef} h="full" overflow="hidden">
      {/* Left Panel */}
      <Box
        width={`${leftWidth}px`}
        flexShrink={0}
        overflow="hidden"
        position="relative"
        data-testid="resizable-left-panel"
      >
        {leftPanel}
      </Box>

      {/* Divider */}
      <Box
        width="6px"
        bg={isDragging ? dividerActiveBg : dividerBg}
        cursor="col-resize"
        position="relative"
        flexShrink={0}
        _hover={{ bg: dividerHoverBg }}
        onMouseDown={handleMouseDown}
        transition="background-color 0.2s"
        data-testid="resizable-divider"
      >
        {/* Visual handle in center of divider */}
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          width="2px"
          height="30px"
          bg={useColorModeValue('gray.400', 'gray.500')}
          borderRadius="1px"
          opacity={isDragging ? 1 : 0.6}
          transition="opacity 0.2s"
          data-testid="resizable-handle"
        />
      </Box>

      {/* Right Panel */}
      <Box flex="1" overflow="hidden" minWidth="0">
        {rightPanel}
      </Box>
    </Flex>
  );
};

export default ResizablePanels;