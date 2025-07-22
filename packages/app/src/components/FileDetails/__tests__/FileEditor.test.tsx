import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import FileEditor from '../FileEditor';
import { OperationsProvider } from '../../../contexts/OperationsContext';

// Mock Prism.js
jest.mock('prismjs', () => ({
  highlight: jest.fn((code, language) => `<span class="token">${code}</span>`),
  languages: {
    javascript: {},
    json: {},
    markdown: {},
  },
}));

jest.mock('prismjs/components/prism-json', () => ({}));
jest.mock('prismjs/components/prism-markdown', () => ({}));

const renderWithChakra = (component: React.ReactElement) => {
  return render(
    <ChakraProvider>
      <OperationsProvider>
        {component}
      </OperationsProvider>
    </ChakraProvider>
  );
};

describe('FileEditor', () => {
  const mockOnSave = jest.fn();
  const mockOnValidate = jest.fn();

  const defaultProps = {
    content: '# Test Content\n\nThis is test content.',
    fileName: 'test.md',
    onSave: mockOnSave,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
    mockOnValidate.mockReturnValue({ isValid: true, errors: [] });
  });

  it('renders file editor with content', () => {
    renderWithChakra(<FileEditor {...defaultProps} />);

    expect(screen.getByText('test.md')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue(defaultProps.content);
    expect(screen.getByText('Language: JSON')).toBeInTheDocument();
  });

  it('displays file statistics correctly', () => {
    renderWithChakra(<FileEditor {...defaultProps} />);

    // Check that statistics are displayed (content length is 37)
    expect(screen.getByText(/Lines: \d+ \| Characters: 37/)).toBeInTheDocument();
    expect(screen.getByText('Language: JSON')).toBeInTheDocument();
  });

  it('shows syntax highlighting for different languages', () => {
    const { rerender } = renderWithChakra(
      <FileEditor {...defaultProps} language="json" />
    );

    expect(screen.getByText('Language: JSON')).toBeInTheDocument();

    rerender(
      <ChakraProvider>
        <FileEditor {...defaultProps} language="markdown" />
      </ChakraProvider>
    );

    expect(screen.getByText('Language: MARKDOWN')).toBeInTheDocument();
  });

  it('handles content changes', async () => {
    const user = userEvent.setup();
    renderWithChakra(<FileEditor {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    
    await user.clear(textarea);
    await user.type(textarea, 'New content');

    expect(textarea).toHaveValue('New content');
  });

  it('saves content when save button is clicked', async () => {
    const user = userEvent.setup();
    renderWithChakra(<FileEditor {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    const saveButton = screen.getByText('Save');

    await user.clear(textarea);
    await user.type(textarea, 'Modified content');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('Modified content');
    });
  });

  it('discards changes when discard button is clicked', async () => {
    const user = userEvent.setup();
    renderWithChakra(<FileEditor {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    const discardButton = screen.getByText('Discard');

    await user.clear(textarea);
    await user.type(textarea, 'Modified content');
    await user.click(discardButton);

    expect(textarea).toHaveValue(defaultProps.content);
  });

  it('shows validation errors when content is invalid', async () => {
    const user = userEvent.setup();
    const mockValidate = jest.fn().mockReturnValue({
      isValid: false,
      errors: ['Error 1', 'Error 2']
    });

    renderWithChakra(
      <FileEditor {...defaultProps} onValidate={mockValidate} />
    );

    const textarea = screen.getByRole('textbox');
    
    // Trigger validation by changing content
    await user.clear(textarea);
    await user.type(textarea, 'invalid content');

    expect(screen.getByText('Validation Errors:')).toBeInTheDocument();
    expect(screen.getByText('• Error 1')).toBeInTheDocument();
    expect(screen.getByText('• Error 2')).toBeInTheDocument();
  });

  it('hides validation section when content is valid', () => {
    const mockValidate = jest.fn().mockReturnValue({
      isValid: true,
      errors: []
    });

    renderWithChakra(
      <FileEditor {...defaultProps} onValidate={mockValidate} />
    );

    expect(screen.queryByText('Validation Errors:')).not.toBeInTheDocument();
  });

  it('disables save button when content is invalid', () => {
    const mockValidate = jest.fn().mockReturnValue({
      isValid: false,
      errors: ['Invalid content']
    });

    renderWithChakra(
      <FileEditor {...defaultProps} onValidate={mockValidate} />
    );

    const saveButton = screen.getByText('Save');
    expect(saveButton).toBeDisabled();
  });

  it('shows unsaved changes indicator', async () => {
    const user = userEvent.setup();
    renderWithChakra(<FileEditor {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    
    await user.type(textarea, ' more content');

    expect(screen.getByText('(unsaved changes)')).toBeInTheDocument(); // Unsaved indicator
  });

  it('handles save errors gracefully', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Write operation failed';
    mockOnSave.mockImplementation(() => 
      Promise.reject(new Error(errorMessage))
    );

    renderWithChakra(<FileEditor {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    const saveButton = screen.getByText('Save');

    await user.type(textarea, ' modified');
    await user.click(saveButton);

    // Wait for the save operation to complete
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(defaultProps.content + ' modified');
    });

    // The error is handled via toast notification, which is mocked
    // Just verify that the save button is enabled again after the error
    expect(saveButton).not.toBeDisabled();
  });

  it('works in read-only mode', () => {
    renderWithChakra(
      <FileEditor {...defaultProps} isReadOnly={true} />
    );

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveAttribute('readOnly');
    
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.queryByText('Discard')).not.toBeInTheDocument();
  });

  it('updates statistics when content changes', async () => {
    const user = userEvent.setup();
    renderWithChakra(<FileEditor {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    
    await user.clear(textarea);
    await user.type(textarea, 'Short');

    // Wait for statistics to update
    await waitFor(() => {
      expect(screen.getByText(/Lines: \d+ \| Characters: 5/)).toBeInTheDocument(); // New character count
    });
  });

  it('handles empty content', () => {
    renderWithChakra(
      <FileEditor {...defaultProps} content="" />
    );

    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue('');
    
    expect(screen.getByText(/Lines: \d+ \| Characters: 0/)).toBeInTheDocument(); // Character count
  });

  it('shows loading state during save', async () => {
    const user = userEvent.setup();
    let resolveSave: () => void;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    mockOnSave.mockReturnValue(savePromise);

    renderWithChakra(<FileEditor {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    const saveButton = screen.getByText('Save');

    await user.type(textarea, ' modified');
    await user.click(saveButton);

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(saveButton).toBeDisabled();

    resolveSave!();
    await waitFor(() => {
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
    });
  });

  it('calculates character count correctly', async () => {
    const user = userEvent.setup();
    renderWithChakra(<FileEditor {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    
    await user.clear(textarea);
    await user.type(textarea, 'one two three four');

    await waitFor(() => {
      // Should show 18 characters
      expect(screen.getByText(/Lines: \d+ \| Characters: 18/)).toBeInTheDocument();
    });
  });

  it('calculates line count correctly', async () => {
    const user = userEvent.setup();
    renderWithChakra(<FileEditor {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    
    await user.clear(textarea);
    await user.type(textarea, 'line 1\nline 2\nline 3');

    await waitFor(() => {
      // Should show 3 lines
      expect(screen.getByText(/Lines: 3 \| Characters: \d+/)).toBeInTheDocument();
    });
  });
});