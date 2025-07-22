import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  HStack,
  Text,
  useColorModeValue,
  useToast,
  Alert,
  AlertIcon,
  AlertDescription,
} from '@chakra-ui/react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs';
import 'prismjs/components/prism-json';
import 'prismjs/themes/prism.css';

interface FileEditorProps {
  content: string;
  fileName: string;
  language?: 'json' | 'markdown' | 'text';
  onSave: (content: string) => Promise<void>;
  onValidate?: (content: string) => Promise<{ isValid: boolean; errors: string[] }> | { isValid: boolean; errors: string[] };
  isReadOnly?: boolean;
}

const FileEditor: React.FC<FileEditorProps> = ({
  content,
  fileName,
  language = 'json',
  onSave,
  onValidate,
  isReadOnly = false,
}) => {
  const [editorContent, setEditorContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const toast = useToast();
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const bgColor = useColorModeValue('white', 'gray.900');

  // Syntax highlighting function
  const highlightCode = useCallback(
    (code: string) => {
      try {
        switch (language) {
          case 'json':
            return highlight(code, languages.json, 'json');
          case 'markdown':
            return highlight(code, languages.markdown || languages.text, 'markdown');
          default:
            return highlight(code, languages.text, 'text');
        }
      } catch (error) {
        // Fallback to plain text if highlighting fails
        return code;
      }
    },
    [language]
  );

  // Handle content changes
  const handleContentChange = useCallback(
    async (newContent: string) => {
      setEditorContent(newContent);
      setHasChanges(newContent !== content);

      // Run validation if provided
      if (onValidate) {
        try {
          const validation = await Promise.resolve(onValidate(newContent));
          setValidationErrors(validation.isValid ? [] : validation.errors);
        } catch (error) {
          setValidationErrors(['Validation error occurred']);
        }
      }
    },
    [content, onValidate]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (!hasChanges || isReadOnly) return;

    // Check validation before saving
    if (onValidate) {
      try {
        const validation = await Promise.resolve(onValidate(editorContent));
        if (!validation.isValid) {
          toast({
            title: 'Validation Error',
            description: 'Please fix validation errors before saving',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          return;
        }
      } catch (error) {
        toast({
          title: 'Validation Error',
          description: 'Validation failed to complete',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSave(editorContent);
      setHasChanges(false);
      toast({
        title: 'File Saved',
        description: `${fileName} has been saved successfully`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save file';
      toast({
        title: 'Save Error',
        description: errorMessage,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  }, [editorContent, hasChanges, isReadOnly, onSave, onValidate, fileName, toast]);

  // Handle discard changes
  const handleDiscard = useCallback(() => {
    setEditorContent(content);
    setHasChanges(false);
    setValidationErrors([]);
    toast({
      title: 'Changes Discarded',
      description: 'All unsaved changes have been discarded',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  }, [content, toast]);

  return (
    <Box>
      {/* Editor Header */}
      <HStack justify="space-between" mb={4}>
        <Text fontSize="sm" fontWeight="medium">
          {fileName}
          {hasChanges && !isReadOnly && (
            <Text as="span" color="orange.500" ml={2}>
              (unsaved changes)
            </Text>
          )}
          {isReadOnly && (
            <Text as="span" color="gray.500" ml={2}>
              (read-only)
            </Text>
          )}
        </Text>

        {!isReadOnly && (
          <HStack spacing={2}>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDiscard}
              isDisabled={!hasChanges || isSaving}
            >
              Discard
            </Button>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={handleSave}
              isLoading={isSaving}
              loadingText="Saving..."
              isDisabled={!hasChanges || validationErrors.length > 0}
            >
              Save
            </Button>
          </HStack>
        )}
      </HStack>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          <Box>
            <AlertDescription>
              <Text fontWeight="medium" mb={1}>
                Validation Errors:
              </Text>
              {validationErrors.map((error, index) => (
                <Text key={index} fontSize="sm">
                  • {error}
                </Text>
              ))}
            </AlertDescription>
          </Box>
        </Alert>
      )}

      {/* Code Editor */}
      <Box
        border="1px"
        borderColor={borderColor}
        borderRadius="md"
        bg={bgColor}
        overflow="hidden"
      >
        <Editor
          value={editorContent}
          onValueChange={handleContentChange}
          highlight={highlightCode}
          padding={16}
          style={{
            fontFamily: '"Fira Code", "Fira Mono", Consolas, "Courier New", monospace',
            fontSize: 14,
            lineHeight: 1.5,
            minHeight: '400px',
            backgroundColor: 'transparent',
          }}
          readOnly={isReadOnly}
          placeholder={language === 'json' ? 'Enter JSON content...' : 'Enter content...'}
        />
      </Box>

      {/* Editor Footer */}
      <HStack justify="space-between" mt={2}>
        <Text fontSize="xs" color="gray.500">
          Language: {language.toUpperCase()}
        </Text>
        <Text fontSize="xs" color="gray.500">
          Lines: {editorContent.split('\n').length} | Characters: {editorContent.length}
        </Text>
      </HStack>
    </Box>
  );
};

export default FileEditor;