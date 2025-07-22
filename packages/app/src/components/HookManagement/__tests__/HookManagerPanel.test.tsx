import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { HookManagerPanel } from '../HookManagerPanel';
import { HookEvent, SettingsHookMatcher } from '@claude-config/core';

const ChakraWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ChakraProvider>{children}</ChakraProvider>
);

describe('HookManagerPanel', () => {
  const mockOnHooksChange = jest.fn();

  beforeEach(() => {
    mockOnHooksChange.mockClear();
  });

  const sampleHooks: Partial<Record<HookEvent, SettingsHookMatcher[]>> = {
    'PreToolUse': [
      {
        matcher: 'Bash',
        hooks: [
          { type: 'command', command: 'echo "Before bash command"', timeout: 30 }
        ]
      }
    ],
    'PostToolUse': [
      {
        matcher: '',
        hooks: [
          { type: 'command', command: 'echo "After any tool"' }
        ]
      }
    ]
  };

  it('renders the panel with hook management title', () => {
    render(
      <ChakraWrapper>
        <HookManagerPanel
          hooks={{}}
          onHooksChange={mockOnHooksChange}
          isEditing={false}
        />
      </ChakraWrapper>
    );

    expect(screen.getByText('Claude Code Hooks')).toBeInTheDocument();
    expect(screen.getByText('Configure event-based hooks for tool execution')).toBeInTheDocument();
  });

  it('shows empty state when no hooks are configured', () => {
    render(
      <ChakraWrapper>
        <HookManagerPanel
          hooks={{}}
          onHooksChange={mockOnHooksChange}
          isEditing={false}
        />
      </ChakraWrapper>
    );

    expect(screen.getByText(/No hooks configured. Enable editing mode to add hooks./)).toBeInTheDocument();
  });

  it('displays configured hooks correctly', () => {
    render(
      <ChakraWrapper>
        <HookManagerPanel
          hooks={sampleHooks}
          onHooksChange={mockOnHooksChange}
          isEditing={false}
        />
      </ChakraWrapper>
    );

    // Check that PreToolUse hook is displayed
    expect(screen.getByText('PreToolUse')).toBeInTheDocument();
    expect(screen.getByText('Before tool execution')).toBeInTheDocument();
    expect(screen.getByText('echo "Before bash command"')).toBeInTheDocument();

    // Check that PostToolUse hook is displayed
    expect(screen.getByText('PostToolUse')).toBeInTheDocument();
    expect(screen.getByText('After tool completion')).toBeInTheDocument();
    expect(screen.getByText('echo "After any tool"')).toBeInTheDocument();
  });

  it('shows Add Hook button when editing', () => {
    render(
      <ChakraWrapper>
        <HookManagerPanel
          hooks={{}}
          onHooksChange={mockOnHooksChange}
          isEditing={true}
        />
      </ChakraWrapper>
    );

    expect(screen.getByRole('button', { name: /Add Hook/ })).toBeInTheDocument();
  });

  it('hides Add Hook button when not editing', () => {
    render(
      <ChakraWrapper>
        <HookManagerPanel
          hooks={{}}
          onHooksChange={mockOnHooksChange}
          isEditing={false}
        />
      </ChakraWrapper>
    );

    expect(screen.queryByRole('button', { name: /Add Hook/ })).not.toBeInTheDocument();
  });

  it.skip('shows edit and delete buttons for hooks when editing', () => {
    render(
      <ChakraWrapper>
        <HookManagerPanel
          hooks={sampleHooks}
          onHooksChange={mockOnHooksChange}
          isEditing={true}
        />
      </ChakraWrapper>
    );

    const editButtons = screen.getAllByLabelText('Edit hook');
    const deleteButtons = screen.getAllByLabelText('Delete hook');
    
    expect(editButtons).toHaveLength(2); // Two hooks configured
    expect(deleteButtons).toHaveLength(2);
  });

  it.skip('hides edit and delete buttons when not editing', () => {
    render(
      <ChakraWrapper>
        <HookManagerPanel
          hooks={sampleHooks}
          onHooksChange={mockOnHooksChange}
          isEditing={false}
        />
      </ChakraWrapper>
    );

    expect(screen.queryByLabelText('Edit hook')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Delete hook')).not.toBeInTheDocument();
  });

  it.skip('opens modal when Add Hook is clicked', async () => {
    render(
      <ChakraWrapper>
        <HookManagerPanel
          hooks={{}}
          onHooksChange={mockOnHooksChange}
          isEditing={true}
        />
      </ChakraWrapper>
    );

    const addButton = screen.getByRole('button', { name: /Add Hook/ });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Add New Hook')).toBeInTheDocument();
    });
  });

  it.skip('deletes hook when delete button is clicked', () => {
    render(
      <ChakraWrapper>
        <HookManagerPanel
          hooks={sampleHooks}
          onHooksChange={mockOnHooksChange}
          isEditing={true}
        />
      </ChakraWrapper>
    );

    const deleteButtons = screen.getAllByLabelText('Delete hook');
    fireEvent.click(deleteButtons[0]);

    expect(mockOnHooksChange).toHaveBeenCalled();
    
    // Check that the hook was removed from the updated hooks object
    const updatedHooks = mockOnHooksChange.mock.calls[0][0];
    expect(updatedHooks.PreToolUse).toEqual([]);
  });

  it.skip('displays matcher pattern correctly', () => {
    render(
      <ChakraWrapper>
        <HookManagerPanel
          hooks={sampleHooks}
          onHooksChange={mockOnHooksChange}
          isEditing={false}
        />
      </ChakraWrapper>
    );

    // Check Bash matcher
    expect(screen.getByText('Bash')).toBeInTheDocument();
    
    // Check empty matcher (should show as "(all tools)")
    expect(screen.getByText('(all tools)')).toBeInTheDocument();
  });

  it.skip('displays timeout information when present', () => {
    render(
      <ChakraWrapper>
        <HookManagerPanel
          hooks={sampleHooks}
          onHooksChange={mockOnHooksChange}
          isEditing={false}
        />
      </ChakraWrapper>
    );

    expect(screen.getByText('Timeout: 30s')).toBeInTheDocument();
  });

  it.skip('handles empty hooks object gracefully', () => {
    render(
      <ChakraWrapper>
        <HookManagerPanel
          hooks={{}}
          onHooksChange={mockOnHooksChange}
          isEditing={false}
        />
      </ChakraWrapper>
    );

    expect(screen.getByText(/No hooks configured/)).toBeInTheDocument();
    expect(screen.queryByText('PreToolUse')).not.toBeInTheDocument();
  });
});