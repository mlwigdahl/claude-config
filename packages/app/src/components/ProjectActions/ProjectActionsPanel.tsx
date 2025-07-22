import React, { useState } from 'react';
import {
  Box,
  Button,
  Heading,
  VStack,
  HStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { DownloadIcon, ArrowUpIcon } from '@chakra-ui/icons';
import { useFileSystem } from '../../contexts/FileSystemContext';
import ExportDialog from '../Export/ExportDialog';
import ImportDialog from './ImportDialog';

const ProjectActionsPanel: React.FC = () => {
  const { projectRoot } = useFileSystem();
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const handleExportClick = () => {
    if (projectRoot) {
      setIsExportDialogOpen(true);
    }
  };

  const handleImportClick = () => {
    if (projectRoot) {
      setIsImportDialogOpen(true);
    }
  };

  const getProjectName = () => {
    if (!projectRoot) return 'No Project';
    return projectRoot.split('/').pop() || 'Unknown Project';
  };

  if (!projectRoot) {
    return null;
  }

  return (
    <>
      <Box
        border="1px"
        borderColor={borderColor}
        borderRadius="md"
        p={4}
        h="auto"
        minH="120px"
      >
        <VStack spacing={4} align="stretch">
          <Heading as="h3" size="sm">
            Project Actions
          </Heading>
          
          <VStack spacing={3} align="stretch">
            <Button
              size="sm"
              leftIcon={<DownloadIcon />}
              onClick={handleExportClick}
              colorScheme="blue"
              variant="outline"
            >
              Export Project
            </Button>
            
            <Button
              size="sm"
              leftIcon={<ArrowUpIcon />}
              onClick={handleImportClick}
              colorScheme="green"
              variant="outline"
            >
              Import Project
            </Button>
          </VStack>
        </VStack>
      </Box>

      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        projectPath={projectRoot}
        projectName={getProjectName()}
      />

      <ImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        projectPath={projectRoot}
        projectName={getProjectName()}
      />
    </>
  );
};

export default ProjectActionsPanel;