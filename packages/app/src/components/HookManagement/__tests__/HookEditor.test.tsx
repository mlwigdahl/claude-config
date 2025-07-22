import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { HookEditor } from '../HookEditor';
import { HookEvent } from '@claude-config/core';

const ChakraWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ChakraProvider>{children}</ChakraProvider>
);

describe.skip('HookEditor', () => {
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    mockOnSave.mockClear();
    mockOnCancel.mockClear();
  });

  const defaultProps = {
    initialEvent: 'PreToolUse' as HookEvent,
    initialMatcher: '',
    initialHook: {
      type: 'command' as const,
      command: '',
      timeout: 60
    },
    onSave: mockOnSave,
    onCancel: mockOnCancel
  };

  it('renders the hook editor form', () => {
    render(
      <ChakraWrapper>
        <HookEditor {...defaultProps} />
      </ChakraWrapper>
    );

    expect(screen.getByLabelText(/Hook Event/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tool Matcher Pattern/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Command/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Timeout/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Hook/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
  });

  it('populates form with initial values', () => {
    const props = {
      ...defaultProps,
      initialEvent: 'PostToolUse' as HookEvent,
      initialMatcher: 'Write|Edit',
      initialHook: {
        type: 'command' as const,
        command: 'echo "test command"',
        timeout: 120
      }
    };

    render(
      <ChakraWrapper>
        <HookEditor {...props} />
      </ChakraWrapper>
    );

    expect(screen.getByDisplayValue('PostToolUse - After tool completion')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Write|Edit')).toBeInTheDocument();
    expect(screen.getByDisplayValue('echo "test command"')).toBeInTheDocument();
    expect(screen.getByDisplayValue('120')).toBeInTheDocument();
  });

  it('shows all event options in dropdown', () => {
    render(
      <ChakraWrapper>
        <HookEditor {...defaultProps} />
      </ChakraWrapper>
    );

    const eventSelect = screen.getByLabelText(/Hook Event/);
    
    // Check that all event options are present
    expect(screen.getByText(/PreToolUse - Before tool execution/)).toBeInTheDocument();
    expect(screen.getByText(/PostToolUse - After tool completion/)).toBeInTheDocument();
    expect(screen.getByText(/UserPromptSubmit - When user submits a prompt/)).toBeInTheDocument();
    expect(screen.getByText(/Notification - On specific system notifications/)).toBeInTheDocument();
    expect(screen.getByText(/Stop - When main agent finishes/)).toBeInTheDocument();
    expect(screen.getByText(/SubagentStop - When subagent finishes/)).toBeInTheDocument();
    expect(screen.getByText(/PreCompact - Before context compaction/)).toBeInTheDocument();
  });

  it('validates required command field', async () => {
    render(
      <ChakraWrapper>
        <HookEditor {...defaultProps} />
      </ChakraWrapper>
    );

    const saveButton = screen.getByRole('button', { name: /Save Hook/ });
    
    // Save button should be disabled when command is empty
    expect(saveButton).toBeDisabled();

    // Enter a command
    const commandInput = screen.getByLabelText(/Command/);
    fireEvent.change(commandInput, { target: { value: 'echo "test"' } });

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
  });

  it('shows security warnings for dangerous commands', async () => {
    render(
      <ChakraWrapper>
        <HookEditor {...defaultProps} />
      </ChakraWrapper>
    );

    const commandInput = screen.getByLabelText(/Command/);
    
    // Test sudo warning
    fireEvent.change(commandInput, { target: { value: 'sudo rm -rf /' } });
    
    await waitFor(() => {
      expect(screen.getByText(/Security Warnings/)).toBeInTheDocument();
      expect(screen.getByText(/potential privilege escalation risk/)).toBeInTheDocument();
      expect(screen.getByText(/potential data loss risk/)).toBeInTheDocument();
    });
  });

  it('validates timeout range', async () => {
    render(
      <ChakraWrapper>
        <HookEditor {...defaultProps} />
      </ChakraWrapper>
    );

    const commandInput = screen.getByLabelText(/Command/);
    const timeoutInput = screen.getByLabelText(/Timeout/);
    
    // Add valid command first
    fireEvent.change(commandInput, { target: { value: 'echo "test"' } });
    
    // Test invalid timeout (too high)
    fireEvent.change(timeoutInput, { target: { value: '500' } });
    
    await waitFor(() => {
      expect(screen.getByText(/Timeout must be between 1 and 300 seconds/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save Hook/ })).toBeDisabled();
    });

    // Test valid timeout
    fireEvent.change(timeoutInput, { target: { value: '60' } });
    
    await waitFor(() => {
      expect(screen.queryByText(/Timeout must be between 1 and 300 seconds/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Save Hook/ })).toBeEnabled();
    });
  });

  it('calls onSave with correct parameters', async () => {
    render(
      <ChakraWrapper>
        <HookEditor {...defaultProps} />
      </ChakraWrapper>
    );

    const eventSelect = screen.getByLabelText(/Hook Event/);
    const matcherInput = screen.getByLabelText(/Tool Matcher Pattern/);
    const commandInput = screen.getByLabelText(/Command/);
    const timeoutInput = screen.getByLabelText(/Timeout/);

    // Fill out form
    fireEvent.change(eventSelect, { target: { value: 'PostToolUse' } });
    fireEvent.change(matcherInput, { target: { value: 'Write' } });
    fireEvent.change(commandInput, { target: { value: 'echo "after write"' } });
    fireEvent.change(timeoutInput, { target: { value: '45' } });

    const saveButton = screen.getByRole('button', { name: /Save Hook/ });
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith(
      'PostToolUse',
      'Write',
      {
        type: 'command',
        command: 'echo "after write"',
        timeout: 45
      }
    );
  });

  it('omits default timeout when saving', async () => {
    render(
      <ChakraWrapper>
        <HookEditor {...defaultProps} />
      </ChakraWrapper>
    );

    const commandInput = screen.getByLabelText(/Command/);
    fireEvent.change(commandInput, { target: { value: 'echo "test"' } });

    const saveButton = screen.getByRole('button', { name: /Save Hook/ });
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith(
      'PreToolUse',
      '',
      {
        type: 'command',
        command: 'echo "test"',
        timeout: undefined // Default timeout should be omitted
      }
    );
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(
      <ChakraWrapper>
        <HookEditor {...defaultProps} />
      </ChakraWrapper>
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/ });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows example commands for selected event', () => {
    render(
      <ChakraWrapper>
        <HookEditor {...defaultProps} />
      </ChakraWrapper>
    );

    // Look for the "Example Commands" accordion
    expect(screen.getByText(/Example Commands/)).toBeInTheDocument();
  });

  it('shows common matcher patterns', () => {
    render(
      <ChakraWrapper>
        <HookEditor {...defaultProps} />
      </ChakraWrapper>
    );

    // Look for the "Common Patterns" accordion
    expect(screen.getByText(/Common Patterns/)).toBeInTheDocument();
  });

  it('updates matcher when common pattern is clicked', async () => {
    render(
      <ChakraWrapper>
        <HookEditor {...defaultProps} />
      </ChakraWrapper>
    );

    // Open common patterns
    const commonPatternsButton = screen.getByText(/Common Patterns/);
    fireEvent.click(commonPatternsButton);

    // Click on "Bash" pattern (wait for it to appear)
    await waitFor(() => {
      const bashPattern = screen.getByText('Bash commands only');
      fireEvent.click(bashPattern.closest('[role="button"]') || bashPattern);
    });

    // Check that matcher input is updated
    const matcherInput = screen.getByLabelText(/Tool Matcher Pattern/);
    expect((matcherInput as HTMLInputElement).value).toBe('Bash');
  });

  it('updates command when example is clicked', async () => {
    render(
      <ChakraWrapper>
        <HookEditor {...defaultProps} />
      </ChakraWrapper>
    );

    // Open example commands
    const exampleCommandsButton = screen.getByText(/Example Commands/);
    fireEvent.click(exampleCommandsButton);

    // Click on an example command
    await waitFor(() => {
      const exampleCommand = screen.getByText('echo "About to execute tool: $TOOL_NAME"');
      fireEvent.click(exampleCommand);
    });

    // Check that command input is updated
    const commandInput = screen.getByLabelText(/Command/);
    expect((commandInput as HTMLTextAreaElement).value).toBe('echo "About to execute tool: $TOOL_NAME"');
  });
});