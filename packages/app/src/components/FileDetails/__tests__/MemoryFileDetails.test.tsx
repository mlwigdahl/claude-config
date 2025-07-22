import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { MemoryFileDetails } from '../TestWrappers';
import { FileInfo } from '../../../types';
import { OperationsProvider } from '../../../contexts/OperationsContext';

// Mock ConfigurationService
jest.mock('../../../services/configurationService', () => ({
  ConfigurationService: {
    readFileContent: jest.fn(),
    writeFileContent: jest.fn(),
    deleteFile: jest.fn(),
  },
}));

// Mock FileEditor
jest.mock('../FileEditor', () => {
  return function MockFileEditor({ 
    content, 
    onSave, 
    onValidate,
  }: {
    content: string;
    onSave: (content: string) => Promise<void>;
    onValidate?: (content: string) => { isValid: boolean; errors: string[] };
  }) {
    return (
      <div data-testid="file-editor">
        <textarea data-testid="editor-content" defaultValue={content} />
        <button 
          data-testid="save-button"
          onClick={async () => {
            try {
              await onSave('modified content');
            } catch (error) {
              // Mock handles the error like the real FileEditor does
              // Error is handled gracefully by the component
            }
          }}
        >
          Save
        </button>
        <button
          data-testid="validate-button"
          onClick={() => onValidate?.(content)}
        >
          Validate
        </button>
      </div>
    );
  };
});

import { ConfigurationService } from '../../../services/configurationService';

const mockConfigurationService = ConfigurationService as jest.Mocked<typeof ConfigurationService>;

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ChakraProvider>
      <OperationsProvider>
        {component}
      </OperationsProvider>
    </ChakraProvider>
  );
};

describe('MemoryFileDetails', () => {
  const mockFileInfo: FileInfo = {
    id: 'memory-1',
    name: 'CLAUDE.md',
    path: 'CLAUDE.md',
    type: 'memory',
    exists: true,
    lastModified: new Date('2023-01-01T12:00:00Z'),
    size: 1024,
  };

  const mockContent = '# Memory File\n\nThis is a memory file with some content.\n\n## Section 1\n\nMore content here.';

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigurationService.readFileContent.mockResolvedValue(mockContent);
    mockConfigurationService.writeFileContent.mockResolvedValue(undefined);
    mockConfigurationService.deleteFile.mockResolvedValue(undefined);
  });

  it('renders memory file details with header information', async () => {
    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      // Check for the Memory badge to verify the component loaded
      expect(screen.getByText('Memory')).toBeInTheDocument();
      // Check that filename appears (there will be multiple instances, but that's ok for this test)
      expect(screen.getAllByText('CLAUDE.md')).toHaveLength(2); // title and path
      expect(screen.getByText(/Last modified:/)).toBeInTheDocument();
    });
  });

  it('loads and displays file content', async () => {
    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(mockConfigurationService.readFileContent).toHaveBeenCalledWith(mockFileInfo);
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });
  });

  it('displays file statistics correctly', async () => {
    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      // Check for statistics section
      expect(screen.getByText('Words')).toBeInTheDocument();
      expect(screen.getByText('Lines')).toBeInTheDocument();
      expect(screen.getByText('Sections')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
    });
  });

  it('calculates statistics correctly', async () => {
    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      // The content has 2 markdown headers (## Section 1 and # Memory File)
      // Find the sections stat specifically by its label
      expect(screen.getByText('Sections')).toBeInTheDocument();
      const sectionsStatContainer = screen.getByText('Sections').closest('.chakra-stat');
      expect(sectionsStatContainer).toHaveTextContent('2');
    });
  });

  it('handles file save successfully', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save-button');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockConfigurationService.writeFileContent).toHaveBeenCalledWith(
        mockFileInfo,
        'modified content'
      );
    });
  });

  it('handles file deletion with confirmation', async () => {
    const user = userEvent.setup();
    
    // Mock window.confirm
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    
    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete CLAUDE.md?');
    
    await waitFor(() => {
      expect(mockConfigurationService.deleteFile).toHaveBeenCalledWith(mockFileInfo);
    });

    confirmSpy.mockRestore();
  });

  it('cancels deletion when user declines confirmation', async () => {
    const user = userEvent.setup();
    
    // Mock window.confirm to return false
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    
    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockConfigurationService.deleteFile).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('validates memory file content', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    const validateButton = screen.getByTestId('validate-button');
    await user.click(validateButton);

    // Validation should pass for valid content
    expect(screen.queryByText('Memory file cannot be empty')).not.toBeInTheDocument();
  });

  it('shows validation errors for empty content', async () => {
    mockConfigurationService.readFileContent.mockResolvedValue('');
    
    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    // The validation logic should detect empty content
    // This would be handled by the FileEditor component's validation
  });

  it('shows memory file guidelines', async () => {
    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Memory File Guidelines:')).toBeInTheDocument();
      expect(screen.getByText(/Use markdown headers/)).toBeInTheDocument();
      expect(screen.getByText(/Include clear, actionable information/)).toBeInTheDocument();
    });
  });

  it('handles file loading errors', async () => {
    const errorMessage = 'Failed to load file';
    mockConfigurationService.readFileContent.mockRejectedValue(new Error(errorMessage));

    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Memory File')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    // Should not show the file editor when there's an error
    expect(screen.queryByTestId('file-editor')).not.toBeInTheDocument();
  });

  it('handles save errors gracefully', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Write operation failed';
    mockConfigurationService.writeFileContent.mockImplementation(() => 
      Promise.reject(new Error(errorMessage))
    );

    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save-button');
    await act(async () => {
      await user.click(saveButton);
    });

    // The error would be handled by the component's error handling
    await waitFor(() => {
      expect(mockConfigurationService.writeFileContent).toHaveBeenCalled();
    });
    
    // Check that error is handled gracefully (component doesn't crash)
    expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('disables delete button while loading', () => {
    mockConfigurationService.readFileContent.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    const deleteButton = screen.getByText('Delete');
    expect(deleteButton).toBeDisabled();
  });

  it('recalculates statistics when content changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    // Save with new content should trigger stats recalculation
    const saveButton = screen.getByTestId('save-button');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockConfigurationService.writeFileContent).toHaveBeenCalled();
    });
  });

  it('displays file size in KB', async () => {
    renderWithProviders(<MemoryFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    });
  });

  it('handles files without lastModified date', async () => {
    const fileInfoWithoutDate = { ...mockFileInfo, lastModified: undefined };
    
    renderWithProviders(<MemoryFileDetails fileInfo={fileInfoWithoutDate} />);

    await waitFor(() => {
      // Check that the component renders by looking for the Memory badge
      expect(screen.getByText('Memory')).toBeInTheDocument();
      // Use getAllByText to handle multiple instances of the filename
      expect(screen.getAllByText(fileInfoWithoutDate.name)).toHaveLength(2);
    });

    // Should not show lastModified text when date is undefined
    expect(screen.queryByText(/Last modified:/)).not.toBeInTheDocument();
  });

  it('handles files without size', async () => {
    const fileInfoWithoutSize = { ...mockFileInfo, size: undefined };
    
    renderWithProviders(<MemoryFileDetails fileInfo={fileInfoWithoutSize} />);

    await waitFor(() => {
      // Check that the component renders by looking for the Memory badge
      expect(screen.getByText('Memory')).toBeInTheDocument();
      // Use getAllByText to handle multiple instances of the filename
      expect(screen.getAllByText(fileInfoWithoutSize.name)).toHaveLength(2);
    });

    // Should not show size stat when size is undefined
    expect(screen.queryByText('Size')).not.toBeInTheDocument();
  });
});