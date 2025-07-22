import React, { useState, useEffect } from 'react';
import {
  VStack,
  HStack,
  Text,
  Input,
  Textarea,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Button,
  FormControl,
  FormLabel,
  FormHelperText,
  FormErrorMessage,
  Alert,
  AlertIcon,
  AlertDescription,
  Badge,
  Code,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
} from '@chakra-ui/react';
import { HookEvent, SettingsHookDefinition } from '@claude-config/core';

interface HookEditorProps {
  initialEvent: HookEvent;
  initialMatcher: string;
  initialHook: SettingsHookDefinition;
  onSave: (event: HookEvent, matcher: string, hook: SettingsHookDefinition) => void;
  onCancel: () => void;
}

export const HookEditor: React.FC<HookEditorProps> = ({
  initialEvent,
  initialMatcher,
  initialHook,
  onSave,
  onCancel,
}) => {
  const [event, setEvent] = useState<HookEvent>(initialEvent);
  const [matcher, setMatcher] = useState(initialMatcher);
  const [command, setCommand] = useState(initialHook.command);
  const [timeout, setTimeout] = useState(initialHook.timeout || 60);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);

  const CLAUDE_CODE_EVENTS: { event: HookEvent; description: string; examples: string[] }[] = [
    { 
      event: 'PreToolUse', 
      description: 'Before tool execution',
      examples: ['echo "About to execute tool: $TOOL_NAME"', 'git status'] 
    },
    { 
      event: 'PostToolUse', 
      description: 'After tool completion',
      examples: ['echo "Tool completed with exit code: $EXIT_CODE"', 'git add .'] 
    },
    { 
      event: 'UserPromptSubmit', 
      description: 'When user submits a prompt',
      examples: ['echo "User submitted prompt"', 'timestamp >> activity.log'] 
    },
    { 
      event: 'Notification', 
      description: 'On specific system notifications',
      examples: ['notify-send "Claude notification"', 'echo "Notification received"'] 
    },
    { 
      event: 'Stop', 
      description: 'When main agent finishes',
      examples: ['echo "Agent finished"', 'cleanup.sh'] 
    },
    { 
      event: 'SubagentStop', 
      description: 'When subagent finishes',
      examples: ['echo "Subagent finished"', 'subagent-cleanup.sh'] 
    },
    { 
      event: 'PreCompact', 
      description: 'Before context compaction',
      examples: ['echo "Compacting context"', 'backup-context.sh'] 
    },
  ];

  const COMMON_MATCHERS = [
    { pattern: '', description: 'All tools (empty matcher)' },
    { pattern: 'Bash', description: 'Bash commands only' },
    { pattern: 'Read', description: 'File read operations only' },
    { pattern: 'Write', description: 'File write operations only' },
    { pattern: 'Edit', description: 'File edit operations only' },
    { pattern: 'Write|Edit', description: 'File write and edit operations' },
    { pattern: 'Bash|Write|Edit', description: 'Bash commands and file operations' },
  ];

  useEffect(() => {
    validateForm();
  }, [event, matcher, command, timeout]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const newWarnings: string[] = [];

    // Validate command
    if (!command.trim()) {
      newErrors.command = 'Command is required';
    } else {
      // Security warnings
      if (command.includes('sudo')) {
        newWarnings.push('Command contains "sudo" - potential privilege escalation risk');
      }
      if (command.includes('rm -rf')) {
        newWarnings.push('Command contains "rm -rf" - potential data loss risk');
      }
      if (command.includes('curl') && command.includes('|')) {
        newWarnings.push('Command pipes curl output - potential remote execution risk');
      }
      if (command.includes('wget') && command.includes('|')) {
        newWarnings.push('Command pipes wget output - potential remote execution risk');
      }
    }

    // Validate timeout
    if (timeout < 1 || timeout > 300) {
      newErrors.timeout = 'Timeout must be between 1 and 300 seconds';
    }

    setErrors(newErrors);
    setWarnings(newWarnings);
  };

  const handleSave = () => {
    if (Object.keys(errors).length > 0) {
      return;
    }

    const hookDef: SettingsHookDefinition = {
      type: 'command',
      command: command.trim(),
      timeout: timeout === 60 ? undefined : timeout, // Omit default timeout
    };

    onSave(event, matcher, hookDef);
  };

  const isValid = Object.keys(errors).length === 0;
  const selectedEvent = CLAUDE_CODE_EVENTS.find(e => e.event === event);

  return (
    <VStack spacing={4} align="stretch">
      {/* Event Selection */}
      <FormControl isRequired>
        <FormLabel>Hook Event</FormLabel>
        <Select value={event} onChange={(e) => setEvent(e.target.value as HookEvent)}>
          {CLAUDE_CODE_EVENTS.map(({ event, description }) => (
            <option key={event} value={event}>
              {event} - {description}
            </option>
          ))}
        </Select>
        <FormHelperText>
          When this event occurs, the hook will be triggered
        </FormHelperText>
      </FormControl>

      {/* Matcher Pattern */}
      <FormControl>
        <FormLabel>Tool Matcher Pattern</FormLabel>
        <Input
          value={matcher}
          onChange={(e) => setMatcher(e.target.value)}
          placeholder="Leave empty to match all tools"
        />
        <FormHelperText>
          Pattern to match tool names (e.g., "Write|Edit" or "Bash"). Leave empty to match all tools.
        </FormHelperText>
        
        <Accordion allowToggle mt={2} size="sm">
          <AccordionItem border="none">
            <AccordionButton px={0} py={1}>
              <Box flex="1" textAlign="left">
                <Text fontSize="sm" color="blue.600">Common Patterns</Text>
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel px={0}>
              <VStack spacing={2} align="stretch">
                {COMMON_MATCHERS.map(({ pattern, description }) => (
                  <HStack 
                    key={pattern || 'empty'} 
                    spacing={2} 
                    cursor="pointer" 
                    onClick={() => setMatcher(pattern)}
                    p={2}
                    borderRadius="md"
                    _hover={{ bg: 'gray.50' }}
                  >
                    <Code fontSize="xs" minW="120px">
                      {pattern || '(empty)'}
                    </Code>
                    <Text fontSize="sm" color="gray.600">{description}</Text>
                  </HStack>
                ))}
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </FormControl>

      {/* Command */}
      <FormControl isRequired isInvalid={!!errors.command}>
        <FormLabel>Command</FormLabel>
        <Textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="echo 'Hook executed'"
          rows={3}
          fontFamily="monospace"
          fontSize="sm"
        />
        <FormHelperText>
          Shell command to execute when the hook is triggered
        </FormHelperText>
        <FormErrorMessage>{errors.command}</FormErrorMessage>
        
        {selectedEvent && selectedEvent.examples.length > 0 && (
          <Accordion allowToggle mt={2} size="sm">
            <AccordionItem border="none">
              <AccordionButton px={0} py={1}>
                <Box flex="1" textAlign="left">
                  <Text fontSize="sm" color="blue.600">Example Commands</Text>
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel px={0}>
                <VStack spacing={2} align="stretch">
                  {selectedEvent.examples.map((example, index) => (
                    <Code 
                      key={index}
                      fontSize="xs" 
                      cursor="pointer" 
                      onClick={() => setCommand(example)}
                      p={2}
                      borderRadius="md"
                      _hover={{ bg: 'gray.100' }}
                    >
                      {example}
                    </Code>
                  ))}
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        )}
      </FormControl>

      {/* Timeout */}
      <FormControl isInvalid={!!errors.timeout}>
        <FormLabel>Timeout (seconds)</FormLabel>
        <NumberInput
          value={timeout}
          onChange={(_, value) => setTimeout(value || 60)}
          min={1}
          max={300}
          step={5}
        >
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <FormHelperText>
          Maximum time to wait for the command to complete (default: 60 seconds)
        </FormHelperText>
        <FormErrorMessage>{errors.timeout}</FormErrorMessage>
      </FormControl>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <VStack align="start" spacing={1}>
            <Text fontWeight="semibold">Security Warnings:</Text>
            {warnings.map((warning, index) => (
              <AlertDescription key={index} fontSize="sm">
                • {warning}
              </AlertDescription>
            ))}
          </VStack>
        </Alert>
      )}

      {/* Action Buttons */}
      <HStack justify="flex-end" spacing={3} pt={4}>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          colorScheme="blue" 
          onClick={handleSave}
          isDisabled={!isValid}
        >
          Save Hook
        </Button>
      </HStack>
    </VStack>
  );
};