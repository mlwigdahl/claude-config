import React from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Textarea,
  Badge,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from '@chakra-ui/react';
import { FileAnalysis } from '../../services/fileOperationsService';

interface MemoryFileDetailsProps {
  content: string;
  isEditing: boolean;
  onChange: (content: string) => void;
  analysis: FileAnalysis | null;
  isStandardFile?: boolean;
}

export const MemoryFileDetails: React.FC<MemoryFileDetailsProps> = ({
  content,
  isEditing,
  onChange,
  analysis,
  isStandardFile = true,
}) => {
  const renderMemoryHelp = () => (
    <Alert status="info" borderRadius="md" mb={4}>
      <AlertIcon />
      <Box>
        <Text fontSize="sm">
          <Text as="span" fontWeight="bold">
            {isStandardFile ? 'Memory File' : 'Memory File (nonstandard)'}
          </Text> - {isStandardFile 
            ? 'Contains project-specific instructions and context for Claude Code.'
            : 'Contains Markdown text. Only included as part of context if included by CLAUDE.md.'
          }
        </Text>
      </Box>
    </Alert>
  );

  const renderMemoryAnalysis = () => {
    if (!analysis) return null;

    return (
      <Accordion allowToggle mb={4}>
        <AccordionItem border="none">
          <AccordionButton px={0} py={2}>
            <Box flex="1" textAlign="left">
              <Text fontWeight="bold">Memory Analysis</Text>
            </Box>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel px={0} pb={4}>
            <VStack align="start" spacing={2}>
              {analysis.summary && (
                <Box>
                  <Text fontSize="sm" fontWeight="semibold">Summary:</Text>
                  <Text fontSize="sm" color="gray.600">{analysis.summary}</Text>
                </Box>
              )}
              {analysis.sections && analysis.sections.length > 0 && (
                <Box>
                  <Text fontSize="sm" fontWeight="semibold">Sections found:</Text>
                  <VStack align="start" spacing={1} mt={1}>
                    {analysis.sections.map((section, index) => (
                      <HStack key={index} spacing={2}>
                        <Badge size="sm" colorScheme="purple">{section.name}</Badge>
                        <Text fontSize="xs" color="gray.600">{section.content.substring(0, 50)}...</Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              )}
            </VStack>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    );
  };

  return (
    <VStack spacing={4} align="stretch" h="full">
      {renderMemoryHelp()}
      {renderMemoryAnalysis()}
      
      <Box flex="1">
        <HStack justify="space-between" align="center" mb={2}>
          <Text fontWeight="bold">Memory Content</Text>
          <Badge colorScheme="purple">Markdown</Badge>
        </HStack>
        
        {isEditing ? (
          <Textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter your project memory and instructions here..."
            resize="none"
            h="468px"
            rows={18}
            fontFamily="monospace"
            fontSize="sm"
            bg="gray.50"
            border="1px solid"
            borderColor="gray.300"
            _focus={{
              borderColor: 'purple.500',
              boxShadow: '0 0 0 1px rgba(128, 90, 213, 0.6)',
            }}
          />
        ) : (
          <Box
            h="468px"
            p={4}
            bg="gray.50"
            borderRadius="md"
            border="1px solid"
            borderColor="gray.200"
            overflowY="auto"
          >
            {content ? (
              <Box
                as="pre"
                fontSize="sm"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
                fontFamily="monospace"
                color="gray.800"
              >
                {content}
              </Box>
            ) : (
              <Text color="gray.500" fontStyle="italic">
                No memory content available. Click "Edit" to add project instructions.
              </Text>
            )}
          </Box>
        )}
      </Box>
    </VStack>
  );
};