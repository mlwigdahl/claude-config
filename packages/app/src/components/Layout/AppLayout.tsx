import React from 'react';
import {
  Box,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import Header from './Header';
import ResizablePanels from './ResizablePanels';
import ProjectTree from '../FileTree/ProjectTree';
import ProjectActionsPanel from '../ProjectActions/ProjectActionsPanel';
import { FileDetailsPanel } from '../FileDetails/FileDetailsPanel';
import HookDetailsPanel from '../Hooks/HookDetailsPanel';
import ErrorInfoPanel from '../Common/ErrorInfoPanel';

const AppLayout: React.FC = () => {
  const bgColor = useColorModeValue('gray.50', 'gray.900');

  return (
    <Box minH="100vh" bg={bgColor}>
      <Header />
      
      <Box h="calc(100vh - 80px)" p={4}>
        <ResizablePanels
          storageKey="claude-config-panel-width"
          defaultLeftWidth={375}
          minLeftWidth={250}
          maxLeftWidth={800}
          leftPanel={
            <VStack spacing={4} align="stretch" h="full" pr={4}>
              <Box flex={1} minH={0} overflow="hidden">
                <ProjectTree />
              </Box>
              <Box flexShrink={0}>
                <ProjectActionsPanel />
              </Box>
            </VStack>
          }
          rightPanel={
            <VStack spacing={4} align="stretch" h="full" pl={4}>
              <FileDetailsPanel />
              <HookDetailsPanel />
              <ErrorInfoPanel />
            </VStack>
          }
        />
      </Box>
    </Box>
  );
};

export default AppLayout;