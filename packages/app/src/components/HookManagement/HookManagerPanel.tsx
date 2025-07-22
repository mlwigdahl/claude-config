import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Badge,
  Alert,
  AlertIcon,
  AlertDescription,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Code,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { HookEditor } from './HookEditor';
import { HookEvent, SettingsHookMatcher, SettingsHookDefinition } from '@claude-config/core';

interface HookManagerPanelProps {
  hooks?: Partial<Record<HookEvent, SettingsHookMatcher[]>>;
  onHooksChange: (hooks: Partial<Record<HookEvent, SettingsHookMatcher[]>>) => void;
  isEditing: boolean;
}

export const HookManagerPanel: React.FC<HookManagerPanelProps> = ({
  hooks = {},
  onHooksChange,
  isEditing,
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingHook, setEditingHook] = useState<{
    event: HookEvent;
    matcherIndex: number;
    hookIndex: number;
  } | null>(null);
  const [newHookEvent, setNewHookEvent] = useState<HookEvent>('PreToolUse');

  const CLAUDE_CODE_EVENTS: { event: HookEvent; description: string }[] = [
    { event: 'PreToolUse', description: 'Before tool execution' },
    { event: 'PostToolUse', description: 'After tool completion' },
    { event: 'UserPromptSubmit', description: 'When user submits a prompt' },
    { event: 'Notification', description: 'On specific system notifications' },
    { event: 'Stop', description: 'When main agent finishes' },
    { event: 'SubagentStop', description: 'When subagent finishes' },
    { event: 'PreCompact', description: 'Before context compaction' },
  ];

  const addNewHook = () => {
    setEditingHook(null);
    setNewHookEvent('PreToolUse');
    onOpen();
  };

  const editHook = (event: HookEvent, matcherIndex: number, hookIndex: number) => {
    setEditingHook({ event, matcherIndex, hookIndex });
    onOpen();
  };

  const deleteHook = (event: HookEvent, matcherIndex: number, hookIndex: number) => {
    const updatedHooks = { ...hooks };
    
    if (updatedHooks[event] && updatedHooks[event][matcherIndex]) {
      updatedHooks[event][matcherIndex].hooks.splice(hookIndex, 1);
      
      // Remove empty matchers
      if (updatedHooks[event][matcherIndex].hooks.length === 0) {
        updatedHooks[event].splice(matcherIndex, 1);
      }
      
      // Remove empty events
      if (updatedHooks[event].length === 0) {
        delete updatedHooks[event];
      }
      
      onHooksChange(updatedHooks);
    }
  };

  const saveHook = (
    event: HookEvent,
    matcher: string,
    hookDef: SettingsHookDefinition
  ) => {
    const updatedHooks = { ...hooks };

    if (editingHook) {
      // Editing existing hook
      const { event: oldEvent, matcherIndex, hookIndex } = editingHook;
      
      if (oldEvent === event) {
        // Same event, update in place
        if (updatedHooks[event] && updatedHooks[event][matcherIndex]) {
          updatedHooks[event][matcherIndex].matcher = matcher;
          updatedHooks[event][matcherIndex].hooks[hookIndex] = hookDef;
        }
      } else {
        // Different event, move hook
        deleteHook(oldEvent, matcherIndex, hookIndex);
        // Fall through to add as new hook
      }
    }

    if (!editingHook || editingHook.event !== event) {
      // Adding new hook or moving to different event
      if (!updatedHooks[event]) {
        updatedHooks[event] = [];
      }

      // Find existing matcher or create new one
      let existingMatcher = updatedHooks[event].find(m => m.matcher === matcher);
      
      if (existingMatcher) {
        existingMatcher.hooks.push(hookDef);
      } else {
        updatedHooks[event].push({
          matcher,
          hooks: [hookDef]
        });
      }
    }

    onHooksChange(updatedHooks);
    onClose();
  };

  const renderHooksList = () => {
    if (Object.keys(hooks).length === 0) {
      return (
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <AlertDescription>
            {isEditing 
              ? 'No hooks configured. Click "Add Hook" to create your first hook.'
              : 'No hooks configured. Enable editing mode to add hooks.'
            }
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <VStack spacing={3} align="stretch">
        {CLAUDE_CODE_EVENTS.map(({ event, description }) => {
          const eventHooks = hooks[event];
          if (!eventHooks || eventHooks.length === 0) return null;

          return (
            <Box 
              key={event} 
              p={4}
              borderWidth={1}
              borderRadius="md"
              borderColor="gray.200"
            >
              <VStack spacing={3} align="stretch">
                <HStack justify="space-between">
                  <VStack align="start" spacing={1}>
                    <Badge colorScheme="blue" fontSize="sm">{event}</Badge>
                    <Text fontSize="xs" color="gray.600">{description}</Text>
                  </VStack>
                </HStack>
                  
                  {eventHooks.map((matcher, matcherIndex) => (
                    <Box key={matcherIndex} pl={4} borderLeft="2px solid" borderColor="gray.200">
                      <VStack spacing={2} align="stretch">
                        <HStack>
                          <Text fontSize="sm" fontWeight="semibold">Matcher:</Text>
                          <Code fontSize="sm">{matcher.matcher || '(all tools)'}</Code>
                        </HStack>
                        
                        {matcher.hooks.map((hook, hookIndex) => (
                          <HStack key={hookIndex} justify="space-between" p={2} bg="gray.50" borderRadius="md">
                            <VStack align="start" spacing={1} flex="1">
                              <Code fontSize="xs" noOfLines={1}>{hook.command}</Code>
                              {hook.timeout && (
                                <Text fontSize="xs" color="gray.600">
                                  Timeout: {hook.timeout}s
                                </Text>
                              )}
                            </VStack>
                            
                            {isEditing && (
                              <HStack>
                                <Tooltip label="Edit hook">
                                  <IconButton
                                    aria-label="Edit hook"
                                    icon={<EditIcon />}
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => editHook(event, matcherIndex, hookIndex)}
                                  />
                                </Tooltip>
                                <Tooltip label="Delete hook">
                                  <IconButton
                                    aria-label="Delete hook"
                                    icon={<DeleteIcon />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="red"
                                    onClick={() => deleteHook(event, matcherIndex, hookIndex)}
                                  />
                                </Tooltip>
                              </HStack>
                            )}
                          </HStack>
                        ))}
                      </VStack>
                    </Box>
                  ))}
                </VStack>
              </Box>
          );
        })}
      </VStack>
    );
  };

  return (
    <VStack spacing={4} align="stretch">
      <HStack justify="space-between" align="center">
        <VStack align="start" spacing={1}>
          <Text fontWeight="bold">Claude Code Hooks</Text>
          <Text fontSize="sm" color="gray.600">
            Configure event-based hooks for tool execution
          </Text>
        </VStack>
        
        {isEditing && (
          <Button 
            leftIcon={<AddIcon />} 
            size="sm" 
            colorScheme="blue" 
            onClick={addNewHook}
          >
            Add Hook
          </Button>
        )}
      </HStack>

      {renderHooksList()}

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingHook ? 'Edit Hook' : 'Add New Hook'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <HookEditor
              initialEvent={editingHook ? editingHook.event : newHookEvent}
              initialMatcher={
                editingHook && hooks[editingHook.event]?.[editingHook.matcherIndex]?.matcher || ''
              }
              initialHook={
                editingHook && hooks[editingHook.event]?.[editingHook.matcherIndex]?.hooks?.[editingHook.hookIndex] || {
                  type: 'command',
                  command: '',
                  timeout: 60
                }
              }
              onSave={saveHook}
              onCancel={onClose}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
};