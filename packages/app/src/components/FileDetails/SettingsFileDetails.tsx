import React, { useState, useEffect } from 'react';
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
  Button,
  IconButton,
  Tooltip,
  Tab,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';
import { FileAnalysis } from '../../services/fileOperationsService';
import { HookManagerPanel } from '../HookManagement';
import { HookEvent, SettingsHookMatcher } from '@claude-config/core';

interface SettingsFileDetailsProps {
  content: string;
  isEditing: boolean;
  onChange: (content: string) => void;
  analysis: FileAnalysis | null;
  fileName: string;
}

export const SettingsFileDetails: React.FC<SettingsFileDetailsProps> = ({
  content,
  isEditing,
  onChange,
  analysis,
  fileName,
}) => {
  const [parsedSettings, setParsedSettings] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Parse JSON content
  useEffect(() => {
    if (!content.trim()) {
      setParsedSettings(null);
      setParseError(null);
      return;
    }

    try {
      const parsed = JSON.parse(content);
      setParsedSettings(parsed);
      setParseError(null);
    } catch (error) {
      setParsedSettings(null);
      setParseError((error as Error).message);
    }
  }, [content]);

  const formatJSON = () => {
    if (!parsedSettings) return;
    
    try {
      const formatted = JSON.stringify(parsedSettings, null, 2);
      onChange(formatted);
    } catch (error) {
      console.error('Error formatting JSON:', error);
    }
  };

  // Helper function to normalize hooks to Claude Code format
  const normalizeHooks = (rawHooks: any): { hooks: Partial<Record<HookEvent, SettingsHookMatcher[]>>, wasMigrated: boolean } => {
    if (!rawHooks || typeof rawHooks !== 'object') {
      return { hooks: {}, wasMigrated: false };
    }

    // If already in Claude Code format, return as-is
    if (rawHooks.PreToolUse || rawHooks.PostToolUse || rawHooks.UserPromptSubmit) {
      return { hooks: rawHooks, wasMigrated: false };
    }

    // Convert from old format to Claude Code format
    const normalized: Partial<Record<HookEvent, SettingsHookMatcher[]>> = {};
    
    for (const [toolPattern, eventHooks] of Object.entries(rawHooks)) {
      if (typeof eventHooks === 'object' && eventHooks !== null) {
        for (const [eventKey, hookDef] of Object.entries(eventHooks as any)) {
          let claudeEvent: HookEvent | null = null;
          
          // Map old event names to Claude Code events
          if (eventKey === 'pre' || eventKey === 'before') {
            claudeEvent = 'PreToolUse';
          } else if (eventKey === 'post' || eventKey === 'after') {
            claudeEvent = 'PostToolUse';
          }
          
          if (claudeEvent && hookDef && typeof hookDef === 'object') {
            if (!normalized[claudeEvent]) {
              normalized[claudeEvent] = [];
            }
            
            normalized[claudeEvent]!.push({
              matcher: toolPattern,
              hooks: [{
                type: 'command',
                command: (hookDef as any).command || '',
                timeout: (hookDef as any).timeout
              }]
            });
          }
        }
      }
    }
    
    return { hooks: normalized, wasMigrated: Object.keys(normalized).length > 0 };
  };

  const handleHooksChange = (hooks: Partial<Record<HookEvent, SettingsHookMatcher[]>>) => {
    if (!parsedSettings) return;
    
    const updatedSettings = {
      ...parsedSettings,
      hooks: Object.keys(hooks).length > 0 ? hooks : undefined
    };
    
    // Remove hooks property if empty
    if (!updatedSettings.hooks) {
      delete updatedSettings.hooks;
    }
    
    const formatted = JSON.stringify(updatedSettings, null, 2);
    onChange(formatted);
  };

  const renderSettingsHelp = () => {
    // Determine if this is a project or local settings file
    const baseFileName = fileName.replace('.inactive', '');
    const isLocal = baseFileName === 'settings.local.json';
    const typeIndicator = isLocal ? '(local)' : '(project)';
    
    return (
      <Alert status="info" borderRadius="md" mb={4}>
        <AlertIcon />
        <Box>
          <Text fontSize="sm">
            <Text as="span" fontWeight="bold">Settings File {typeIndicator}</Text> - Contains configuration settings, hooks, and preferences for Claude Code in JSON format.
          </Text>
        </Box>
      </Alert>
    );
  };


  return (
    <VStack spacing={4} align="stretch" h="full">
      {renderSettingsHelp()}
      
      <Box flex="1">
        <Tabs index={activeTab} onChange={setActiveTab} variant="enclosed" isLazy>
          <TabList>
            <Tab>Content</Tab>
            <Tab>Hooks</Tab>
          </TabList>
          
          <TabPanels>
            <TabPanel p={0} pt={4}>
              <HStack justify="space-between" align="center" mb={2}>
                <Text fontWeight="bold">Settings Content</Text>
                <HStack>
                  <Badge colorScheme="blue">JSON</Badge>
                  {isEditing && parsedSettings && (
                    <Tooltip label="Format JSON">
                      <Button size="sm" variant="ghost" onClick={formatJSON}>
                        Format
                      </Button>
                    </Tooltip>
                  )}
                </HStack>
              </HStack>
              
              {parseError && (
                <Alert status="error" borderRadius="md" mb={4}>
                  <AlertIcon />
                  <Box>
                    <AlertTitle>JSON Parse Error</AlertTitle>
                    <AlertDescription fontSize="sm">
                      {parseError}
                    </AlertDescription>
                  </Box>
                </Alert>
              )}
              
              {isEditing ? (
                <Textarea
                  value={content}
                  onChange={(e) => onChange(e.target.value)}
                  placeholder='{"name": "project-settings", "version": "1.0.0"}'
                  resize="none"
                  h="468px"
                  rows={18}
                  fontFamily="monospace"
                  fontSize="sm"
                  bg="gray.50"
                  border="1px solid"
                  borderColor={parseError ? "red.300" : "gray.300"}
                  _focus={{
                    borderColor: parseError ? 'red.500' : 'blue.500',
                    boxShadow: `0 0 0 1px ${parseError ? 'rgba(245, 101, 101, 0.6)' : 'rgba(66, 153, 225, 0.6)'}`,
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
                        No settings content available. Click "Edit" to add configuration.
                      </Text>
                    </Box>
                  )}
                </Box>
              )}
              
              {/* Settings Documentation */}
              {parsedSettings && activeTab === 0 && (
                <Box mt={4}>
                  <Accordion allowMultiple>
                    <AccordionItem>
                      <AccordionButton>
                        <Box flex="1" textAlign="left">
                          <Text fontWeight="semibold">Settings Documentation</Text>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel pb={4}>
                        <VStack align="start" spacing={3}>
                          <Box>
                            <Text fontWeight="semibold" mb={1}>Common Settings:</Text>
                            <VStack align="start" spacing={1} fontSize="sm">
                              <Text><Code>apiKeyHelper</Code> - Custom authentication script</Text>
                              <Text><Code>cleanupPeriodDays</Code> - Transcript retention period</Text>
                              <Text><Code>env</Code> - Environment variables</Text>
                              <Text><Code>permissions</Code> - Tool usage rules</Text>
                              <Text><Code>model</Code> - Override default model</Text>
                              <Text><Code>hooks</Code> - Event hooks configuration</Text>
                            </VStack>
                          </Box>
                          <Box>
                            <Text fontWeight="semibold" mb={1}>Claude Code Hook Events:</Text>
                            <VStack align="start" spacing={1} fontSize="sm">
                              <Text><Code>PreToolUse</Code> - Before tool execution</Text>
                              <Text><Code>PostToolUse</Code> - After tool completion</Text>
                              <Text><Code>UserPromptSubmit</Code> - When user submits a prompt</Text>
                              <Text><Code>Notification</Code> - On system notifications</Text>
                              <Text><Code>Stop</Code> - When main agent finishes</Text>
                              <Text><Code>SubagentStop</Code> - When subagent finishes</Text>
                              <Text><Code>PreCompact</Code> - Before context compaction</Text>
                            </VStack>
                          </Box>
                        </VStack>
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                </Box>
              )}
            </TabPanel>
            
            <TabPanel p={0} pt={4}>
              <Box h="500px" overflowY="auto">
                {(() => {
                  const { hooks, wasMigrated } = normalizeHooks(parsedSettings?.hooks);
                  return (
                    <VStack spacing={4} align="stretch">
                      {wasMigrated && (
                        <Alert status="info" borderRadius="md">
                          <AlertIcon />
                          <AlertDescription fontSize="sm">
                            Detected legacy hook format. The hooks below have been converted to Claude Code format for display. 
                            Save your changes to update the file with the new format.
                          </AlertDescription>
                        </Alert>
                      )}
                      <Box flex="1">
                        <HookManagerPanel
                          hooks={hooks}
                          onHooksChange={handleHooksChange}
                          isEditing={isEditing}
                        />
                      </Box>
                    </VStack>
                  );
                })()}
              </Box>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </VStack>
  );
};