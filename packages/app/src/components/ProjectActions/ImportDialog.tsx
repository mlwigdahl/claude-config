import React, { useState, useRef } from 'react';
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
  Text,
  Alert,
  AlertIcon,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useToast,
  Spinner,
  Box,
  Input,
  FormControl,
  FormLabel,
  Checkbox,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
} from '@chakra-ui/react';
import { ArrowUpIcon, WarningIcon } from '@chakra-ui/icons';
import type { ImportPreviewResult, ImportOptions, ImportConflict } from '@claude-config/shared';
import { useFileSystem } from '../../contexts/FileSystemContext';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  projectName: string;
}

interface ImportState {
  step: 'upload' | 'preview' | 'importing' | 'complete';
  selectedFile: File | null;
  previewResult: ImportPreviewResult | null;
  options: ImportOptions;
  error: string | null;
}

const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  onClose,
  projectPath,
  projectName
}) => {
  const [state, setState] = useState<ImportState>({
    step: 'upload',
    selectedFile: null,
    previewResult: null,
    options: {
      overwriteConflicts: false,
      preserveDirectoryStructure: true
    },
    error: null
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();
  const { refreshFileTree } = useFileSystem();

  const resetState = () => {
    setState({
      step: 'upload',
      selectedFile: null,
      previewResult: null,
      options: {
        overwriteConflicts: false,
        preserveDirectoryStructure: true
      },
      error: null
    });
    setIsProcessing(false);
    setShowConflictDialog(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        setState(prev => ({ ...prev, error: 'Please select a ZIP archive file.' }));
        return;
      }
      setState(prev => ({ 
        ...prev, 
        selectedFile: file, 
        error: null 
      }));
    }
  };

  const handlePreview = async () => {
    if (!state.selectedFile) return;

    setIsProcessing(true);
    setState(prev => ({ ...prev, error: null }));

    try {
      const formData = new FormData();
      formData.append('archive', state.selectedFile);
      formData.append('targetPath', projectPath);

      const response = await fetch('/api/import/preview', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Preview failed: ${response.statusText}`);
      }

      const previewResult: ImportPreviewResult = await response.json();
      
      if (!previewResult.success) {
        throw new Error(previewResult.error || 'Preview failed');
      }

      setState(prev => ({ 
        ...prev, 
        previewResult,
        step: 'preview'
      }));

      // Show conflict dialog if there are conflicts
      if (previewResult.conflicts.length > 0) {
        setShowConflictDialog(true);
      }

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!state.selectedFile || !state.previewResult) return;

    setIsProcessing(true);
    setState(prev => ({ ...prev, step: 'importing', error: null }));

    try {
      const formData = new FormData();
      formData.append('archive', state.selectedFile);
      formData.append('targetPath', projectPath);
      formData.append('options', JSON.stringify(state.options));

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Import failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Import failed');
      }

      toast({
        title: 'Import Successful',
        description: `Imported ${result.filesImported} files. ${result.filesSkipped} files skipped.`,
        status: 'success',
        duration: 5000,
        isClosable: true
      });

      // Refresh the file tree to show newly imported files
      refreshFileTree();

      setState(prev => ({ ...prev, step: 'complete' }));
      setTimeout(() => handleClose(), 2000);

    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        step: 'preview'
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const renderUploadStep = () => (
    <VStack spacing={6} align="stretch">
      <Alert status="info">
        <AlertIcon />
        <Text fontSize="sm">
          Select a ZIP archive exported from Claude Code to import configuration files into this project.
        </Text>
      </Alert>

      <FormControl>
        <FormLabel>Select Archive File</FormLabel>
        <Input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          variant="flushed"
          p={2}
        />
      </FormControl>

      {state.selectedFile && (
        <Box p={3} bg="gray.50" borderRadius="md">
          <Text fontSize="sm" fontWeight="medium">Selected file:</Text>
          <Text fontSize="sm">{state.selectedFile.name}</Text>
          <Text fontSize="xs" color="gray.600">
            {(state.selectedFile.size / 1024 / 1024).toFixed(2)} MB
          </Text>
        </Box>
      )}

      {state.error && (
        <Alert status="error">
          <AlertIcon />
          <Text fontSize="sm">{state.error}</Text>
        </Alert>
      )}
    </VStack>
  );

  const renderPreviewStep = () => {
    if (!state.previewResult) return null;

    return (
      <VStack spacing={6} align="stretch">
        <Alert status="success">
          <AlertIcon />
          <Text fontSize="sm">
            Found {state.previewResult.totalFiles} configuration files in the archive.
          </Text>
        </Alert>

        {state.previewResult.conflicts.length > 0 && (
          <Alert status="warning">
            <AlertIcon />
            <VStack align="stretch" spacing={2}>
              <Text fontSize="sm" fontWeight="medium">
                {state.previewResult.conflicts.length} file conflicts detected:
              </Text>
              <Box maxH="150px" overflowY="auto">
                {state.previewResult.conflicts.map((conflict, index) => (
                  <Text key={index} fontSize="xs" pl={4}>
                    • {conflict.targetPath.split('/').pop()}
                  </Text>
                ))}
              </Box>
            </VStack>
          </Alert>
        )}

        <FormControl>
          <Checkbox
            isChecked={state.options.overwriteConflicts}
            onChange={(e) => 
              setState(prev => ({ 
                ...prev, 
                options: { ...prev.options, overwriteConflicts: e.target.checked }
              }))
            }
          >
            Overwrite existing files
          </Checkbox>
        </FormControl>

        {state.error && (
          <Alert status="error">
            <AlertIcon />
            <Text fontSize="sm">{state.error}</Text>
          </Alert>
        )}
      </VStack>
    );
  };

  const renderConflictDialog = () => {
    if (!state.previewResult?.conflicts) return null;

    return (
      <AlertDialog
        isOpen={showConflictDialog}
        leastDestructiveRef={cancelRef}
        onClose={() => setShowConflictDialog(false)}
        size="xl"
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              <HStack>
                <WarningIcon color="orange.500" />
                <Text>File Conflicts Detected</Text>
              </HStack>
            </AlertDialogHeader>

            <AlertDialogBody>
              <VStack spacing={4} align="stretch">
                <Text>
                  The following files already exist in your project and will be overwritten if you proceed:
                </Text>

                <TableContainer maxH="300px" overflowY="auto">
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>File</Th>
                        <Th>Type</Th>
                        <Th>Existing Size</Th>
                        <Th>New Size</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {state.previewResult.conflicts.map((conflict, index) => (
                        <Tr key={index}>
                          <Td fontSize="xs">{conflict.targetPath.split('/').pop()}</Td>
                          <Td>
                            <Badge colorScheme={
                              conflict.type === 'memory' ? 'blue' :
                              conflict.type === 'settings' ? 'green' : 'purple'
                            }>
                              {conflict.type}
                            </Badge>
                          </Td>
                          <Td fontSize="xs">{conflict.existingSize} bytes</Td>
                          <Td fontSize="xs">{conflict.newSize} bytes</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>

                <Alert status="warning">
                  <AlertIcon />
                  <Text fontSize="sm">
                    Choose "Overwrite" to replace existing files, or "Skip Conflicts" to import only new files.
                  </Text>
                </Alert>
              </VStack>
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setShowConflictDialog(false)}>
                Cancel
              </Button>
              <Button 
                colorScheme="orange" 
                onClick={() => {
                  setState(prev => ({ 
                    ...prev, 
                    options: { ...prev.options, overwriteConflicts: true }
                  }));
                  setShowConflictDialog(false);
                }}
                ml={3}
              >
                Overwrite
              </Button>
              <Button 
                colorScheme="blue" 
                onClick={() => {
                  setState(prev => ({ 
                    ...prev, 
                    options: { ...prev.options, overwriteConflicts: false }
                  }));
                  setShowConflictDialog(false);
                }}
                ml={3}
              >
                Skip Conflicts
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    );
  };

  const getModalTitle = () => {
    switch (state.step) {
      case 'upload': return `Import to Project: ${projectName}`;
      case 'preview': return 'Import Preview';
      case 'importing': return 'Importing Files...';
      case 'complete': return 'Import Complete';
      default: return 'Import Project';
    }
  };

  const getFooterButtons = () => {
    switch (state.step) {
      case 'upload':
        return (
          <HStack spacing={3}>
            <Button variant="ghost" onClick={handleClose} isDisabled={isProcessing}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handlePreview}
              isDisabled={!state.selectedFile || isProcessing}
              leftIcon={isProcessing ? <Spinner size="sm" /> : undefined}
            >
              {isProcessing ? 'Analyzing...' : 'Preview Import'}
            </Button>
          </HStack>
        );
      
      case 'preview':
        return (
          <HStack spacing={3}>
            <Button variant="ghost" onClick={() => setState(prev => ({ ...prev, step: 'upload' }))}>
              Back
            </Button>
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handleImport}
              isDisabled={isProcessing}
              leftIcon={<ArrowUpIcon />}
            >
              Import Files
            </Button>
          </HStack>
        );
      
      case 'importing':
        return (
          <HStack spacing={3}>
            <Button variant="ghost" isDisabled>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              isDisabled
              leftIcon={<Spinner size="sm" />}
            >
              Importing...
            </Button>
          </HStack>
        );
      
      case 'complete':
        return (
          <Button colorScheme="green" onClick={handleClose}>
            Close
          </Button>
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} size="lg" closeOnOverlayClick={state.step !== 'importing'}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{getModalTitle()}</ModalHeader>
          {state.step !== 'importing' && <ModalCloseButton />}
          
          <ModalBody>
            {state.step === 'upload' && renderUploadStep()}
            {state.step === 'preview' && renderPreviewStep()}
            {state.step === 'importing' && (
              <VStack spacing={4}>
                <Spinner size="xl" color="green.500" />
                <Text>Importing configuration files...</Text>
              </VStack>
            )}
            {state.step === 'complete' && (
              <VStack spacing={4}>
                <Alert status="success">
                  <AlertIcon />
                  <Text>Import completed successfully!</Text>
                </Alert>
              </VStack>
            )}
          </ModalBody>

          <ModalFooter>
            {getFooterButtons()}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {renderConflictDialog()}
    </>
  );
};

export default ImportDialog;