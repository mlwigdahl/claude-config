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
  Code,
} from '@chakra-ui/react';
import { FileAnalysis } from '../../services/fileOperationsService';

interface CommandFileDetailsProps {
  content: string;
  isEditing: boolean;
  onChange: (content: string) => void;
  analysis: FileAnalysis | null;
}

export const CommandFileDetails: React.FC<CommandFileDetailsProps> = ({
  content,
  isEditing,
  onChange,
  analysis,
}) => {
  const renderCommandHelp = () => (
    <Alert status="info" borderRadius="md" mb={4}>
      <AlertIcon />
      <Box>
        <Text fontSize="sm">
          <Text as="span" fontWeight="bold">Command File</Text> - Contains custom commands and templates for Claude Code in Markdown format.
        </Text>
      </Box>
    </Alert>
  );

  const renderCommandAnalysis = () => {
    if (!analysis) return null;

    return (
      <Accordion allowToggle mb={4}>
        <AccordionItem border="none">
          <AccordionButton px={0} py={2}>
            <Box flex="1" textAlign="left">
              <Text fontWeight="bold">Command Analysis</Text>
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
              {analysis.commands && analysis.commands.length > 0 && (
                <Box>
                  <Text fontSize="sm" fontWeight="semibold">Commands defined:</Text>
                  <VStack align="start" spacing={1} mt={1}>
                    {analysis.commands.map((command, index) => (
                      <HStack key={index} spacing={2}>
                        <Badge size="sm" colorScheme="green">{command.name}</Badge>
                        {command.namespace && (
                          <Text fontSize="xs" color="gray.600">in {command.namespace}</Text>
                        )}
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              )}
              {analysis.sections && analysis.sections.length > 0 && (
                <Box>
                  <Text fontSize="sm" fontWeight="semibold">Sections found:</Text>
                  <VStack align="start" spacing={1} mt={1}>
                    {analysis.sections.map((section, index) => (
                      <HStack key={index} spacing={2}>
                        <Badge size="sm" colorScheme="gray">{section.name}</Badge>
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

  const renderCommandDocumentation = () => (
    <Box mt={4}>
      <Accordion allowMultiple>
        <AccordionItem>
          <AccordionButton>
            <Box flex="1" textAlign="left">
              <Text fontWeight="semibold">Command Documentation</Text>
            </Box>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel pb={4}>
            <VStack align="start" spacing={3}>
              <Box>
                <Text fontWeight="semibold" mb={1}>Command Structure:</Text>
                <VStack align="start" spacing={1} fontSize="sm">
                  <Text><Code># Command Title</Code> - The main command heading</Text>
                  <Text><Code>## Description</Code> - What the command does</Text>
                  <Text><Code>## Usage</Code> - How to use the command</Text>
                  <Text><Code>## Examples</Code> - Example usage and outputs</Text>
                  <Text><Code>## Notes</Code> - Additional information</Text>
                </VStack>
              </Box>
              <Box>
                <Text fontWeight="semibold" mb={1}>Best Practices:</Text>
                <VStack align="start" spacing={1} fontSize="sm">
                  <Text>• Use clear, descriptive command names</Text>
                  <Text>• Include practical examples</Text>
                  <Text>• Document expected inputs and outputs</Text>
                  <Text>• Add context about when to use the command</Text>
                  <Text>• Keep instructions concise but complete</Text>
                </VStack>
              </Box>
              <Box>
                <Text fontWeight="semibold" mb={1}>Command Variables:</Text>
                <VStack align="start" spacing={1} fontSize="sm">
                  <Text><Code>{'{{project_name}}'}</Code> - Current project name</Text>
                  <Text><Code>{'{{file_path}}'}</Code> - Current file path</Text>
                  <Text><Code>{'{{selection}}'}</Code> - Selected text</Text>
                  <Text><Code>{'{{clipboard}}'}</Code> - Clipboard content</Text>
                </VStack>
              </Box>
            </VStack>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Box>
  );

  return (
    <VStack spacing={4} align="stretch" h="full">
      {renderCommandHelp()}
      {renderCommandAnalysis()}
      
      <Box flex="1">
        <HStack justify="space-between" align="center" mb={2}>
          <Text fontWeight="bold">Command Content</Text>
          <Badge colorScheme="green">Markdown</Badge>
        </HStack>
        
        {isEditing ? (
          <Textarea
            value={content}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`# My Command

## Description
Describe what this command does...

## Usage
/my-command [options]

## Examples
Example usage here...

## Notes
Additional notes...`}
            resize="none"
            h="468px"
            rows={18}
            fontFamily="monospace"
            fontSize="sm"
            bg="gray.50"
            border="1px solid"
            borderColor="gray.300"
            _focus={{
              borderColor: 'green.500',
              boxShadow: '0 0 0 1px rgba(72, 187, 120, 0.6)',
            }}
          />
        ) : (
          <Box
            h="468px"
            overflow="hidden"
          >
            {content ? (
              <Box
                as="pre"
                p={4}
                bg="gray.50"
                borderRadius="md"
                border="1px solid"
                borderColor="gray.200"
                fontSize="sm"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
                fontFamily="monospace"
                color="gray.800"
                overflowY="auto"
                h="450px"
              >
                {content}
              </Box>
            ) : (
              <Box
                p={4}
                bg="gray.50"
                borderRadius="md"
                border="1px solid"
                borderColor="gray.200"
                h="450px"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text color="gray.500" fontStyle="italic">
                  No command content available. Click "Edit" to add command documentation.
                </Text>
              </Box>
            )}
          </Box>
        )}
        
        {/* Command Documentation */}
        {renderCommandDocumentation()}
      </Box>
    </VStack>
  );
};