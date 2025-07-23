import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Checkbox,
  Text,
  Alert,
  AlertIcon,
  useToast,
  Spinner
} from '@chakra-ui/react';
import type { ExportOptions } from '@claude-config/shared';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  projectName: string;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  isOpen,
  onClose,
  projectPath,
  projectName
}) => {
  const [options, setOptions] = useState<ExportOptions>({
    memoryFiles: 'all',
    settingsFiles: 'both',
    commandFiles: true,
    includeInactive: false,
    recursive: true,
    format: 'zip'
  });
  
  const [isExporting, setIsExporting] = useState(false);
  const toast = useToast();

  // Load default options when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadDefaultOptions();
    }
  }, [isOpen]);

  const loadDefaultOptions = async () => {
    try {
      const response = await fetch('/api/export/defaults');
      if (response.ok) {
        const defaults = await response.json();
        setOptions(defaults);
      }
    } catch (error) {
      console.warn('Failed to load default export options:', error);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectPath,
          options
        })
      });

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 404) {
          // No files found to export
          toast({
            title: 'No Files to Export',
            description: 'No configuration files were found matching your export criteria. Please adjust your selection and try again.',
            status: 'warning',
            duration: 5000,
            isClosable: true
          });
          setIsExporting(false);
          return;
        }
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('content-disposition');
      const filenameMatch = contentDisposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] || `${projectName}-export.zip`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Export Successful',
        description: `Project exported as ${filename}`,
        status: 'success',
        duration: 5000,
        isClosable: true
      });

      onClose();
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    } finally {
      setIsExporting(false);
    }
  };

  const hasValidSelection = () => {
    return options.memoryFiles !== 'none' || 
           options.settingsFiles !== 'none' || 
           options.commandFiles;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          Export Project: {projectName}
        </ModalHeader>
        <ModalCloseButton />
        
        <ModalBody>
          <VStack spacing={6} align="stretch">
            <Alert status="info">
              <AlertIcon />
              <Text fontSize="sm">
                This will create a ZIP archive containing the selected configuration files from your project.
              </Text>
            </Alert>

            {/* Memory Files */}
            <FormControl>
              <FormLabel fontWeight="bold">Memory Files</FormLabel>
              <RadioGroup 
                value={options.memoryFiles} 
                onChange={(value: 'all' | 'claude-only' | 'none') => 
                  setOptions(prev => ({ ...prev, memoryFiles: value }))
                }
              >
                <Stack spacing={2}>
                  <Radio value="all">All memory files (*.md)</Radio>
                  <Radio value="claude-only">Only CLAUDE.md</Radio>
                  <Radio value="none">No memory files</Radio>
                </Stack>
              </RadioGroup>
            </FormControl>

            {/* Settings Files */}
            <FormControl>
              <FormLabel fontWeight="bold">Settings Files</FormLabel>
              <RadioGroup 
                value={options.settingsFiles} 
                onChange={(value: 'both' | 'project-only' | 'none') => 
                  setOptions(prev => ({ ...prev, settingsFiles: value }))
                }
              >
                <Stack spacing={2}>
                  <Radio value="both">Both project and local settings</Radio>
                  <Radio value="project-only">Only project settings</Radio>
                  <Radio value="none">No settings files</Radio>
                </Stack>
              </RadioGroup>
            </FormControl>

            {/* Additional Options */}
            <FormControl>
              <FormLabel fontWeight="bold">Additional Options</FormLabel>
              <VStack align="stretch" spacing={3}>
                <Checkbox
                  isChecked={options.commandFiles}
                  onChange={(e) => 
                    setOptions(prev => ({ ...prev, commandFiles: e.target.checked }))
                  }
                >
                  Include command files
                </Checkbox>
                
                <Checkbox
                  isChecked={options.includeInactive}
                  onChange={(e) => 
                    setOptions(prev => ({ ...prev, includeInactive: e.target.checked }))
                  }
                >
                  Include inactive files (.inactive suffix)
                </Checkbox>
                
                <Checkbox
                  isChecked={options.recursive}
                  onChange={(e) => 
                    setOptions(prev => ({ ...prev, recursive: e.target.checked }))
                  }
                >
                  Recurse into subdirectories
                </Checkbox>
              </VStack>
            </FormControl>

            {!hasValidSelection() && (
              <Alert status="warning">
                <AlertIcon />
                <Text fontSize="sm">
                  Please select at least one type of file to export.
                </Text>
              </Alert>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={onClose} isDisabled={isExporting}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleExport}
              isDisabled={!hasValidSelection() || isExporting}
              leftIcon={isExporting ? <Spinner size="sm" /> : undefined}
            >
              {isExporting ? 'Exporting...' : 'Export Project'}
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ExportDialog;