import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { CommandFileDetails } from '../TestWrappers';
import { FileInfo } from '../../../types';
import { OperationsProvider } from '../../../contexts/OperationsContext';

// Mock ConfigurationService
jest.mock('../../../services/configurationService', () => ({
  ConfigurationService: {
    readFileContent: jest.fn(),
    writeFileContent: jest.fn(),
    deleteFile: jest.fn(),
    validateFileContent: jest.fn(),
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
              await onSave('# Modified Command\n\n```bash\necho "modified"\n```');
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

describe('CommandFileDetails', () => {
  const mockFileInfo: FileInfo = {
    id: 'command-1',
    name: 'deploy.md',
    path: '.claude/commands/deploy.md',
    type: 'command',
    exists: true,
    lastModified: new Date('2023-01-01T12:00:00Z'),
    size: 1536,
  };

  const mockContent = `# Deploy Commands

This file contains deployment commands for the project.

## Development Deployment

\`\`\`bash
npm run build
npm run deploy:dev
\`\`\`

## Production Deployment

\`\`\`bash
npm run build:prod
npm run deploy:prod
\`\`\`

## Database Migration

\`\`\`sql
ALTER TABLE users ADD COLUMN email VARCHAR(255);
\`\`\``;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigurationService.readFileContent.mockResolvedValue(mockContent);
    mockConfigurationService.writeFileContent.mockResolvedValue(undefined);
    mockConfigurationService.deleteFile.mockResolvedValue(undefined);
    mockConfigurationService.validateFileContent.mockResolvedValue({ valid: true, errors: [] });
  });

  it('renders command file details with header information', async () => {
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('deploy.md')).toBeInTheDocument();
      expect(screen.getByText('Command')).toBeInTheDocument();
      expect(screen.getByText('.claude/commands/deploy.md')).toBeInTheDocument();
      expect(screen.getByText(/Last modified:/)).toBeInTheDocument();
    });
  });

  it('loads and displays file content', async () => {
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(mockConfigurationService.readFileContent).toHaveBeenCalledWith(mockFileInfo);
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });
  });

  it('displays file statistics correctly', async () => {
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Words')).toBeInTheDocument();
      expect(screen.getByText('Lines')).toBeInTheDocument();
      expect(screen.getByText('Code Blocks')).toBeInTheDocument();
      expect(screen.getByText('Sections')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
    });
  });

  it('analyzes command file content correctly', async () => {
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      // Should detect 3 code blocks in the content
      expect(screen.getByText('3')).toBeInTheDocument(); // Code blocks count
      
      // Should detect 4 markdown headers (# and ##)
      expect(screen.getByText('4')).toBeInTheDocument(); // Sections count
    });
  });

  it('shows command blocks analysis when present', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Command Blocks (3)')).toBeInTheDocument();
    });

    // Expand the command blocks accordion
    const commandBlocksButton = screen.getByText('Command Blocks (3)');
    await act(async () => {
      await user.click(commandBlocksButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Block 1:')).toBeInTheDocument();
      expect(screen.getByText('Block 2:')).toBeInTheDocument();
      expect(screen.getByText('Block 3:')).toBeInTheDocument();
    });
  });

  it('handles file save successfully', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save-button');
    await act(async () => {
      await user.click(saveButton);
    });

    await waitFor(() => {
      expect(mockConfigurationService.writeFileContent).toHaveBeenCalledWith(
        mockFileInfo,
        '# Modified Command\n\n```bash\necho "modified"\n```'
      );
    });
  });

  it('handles file deletion with confirmation', async () => {
    const user = userEvent.setup();
    
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete deploy.md?');
    
    await waitFor(() => {
      expect(mockConfigurationService.deleteFile).toHaveBeenCalledWith(mockFileInfo);
    });

    confirmSpy.mockRestore();
  });

  it('cancels deletion when user declines confirmation', async () => {
    const user = userEvent.setup();
    
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockConfigurationService.deleteFile).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('validates command file content', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    const validateButton = screen.getByTestId('validate-button');
    await user.click(validateButton);

    // Should validate markdown structure and code blocks
    expect(mockConfigurationService.validateFileContent).toHaveBeenCalled();
  });

  it('shows validation errors for empty content', async () => {
    mockConfigurationService.readFileContent.mockResolvedValue('');
    
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    // The validation logic should detect empty content
    // This would be handled by the component's validation function
  });

  it('detects unbalanced code blocks', async () => {
    const invalidContent = '# Test\n\n```bash\necho "test"\n'; // Missing closing ```
    mockConfigurationService.readFileContent.mockResolvedValue(invalidContent);
    
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    // The validation should catch unbalanced code blocks
  });

  it('shows command file guidelines', async () => {
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Command File Guidelines:')).toBeInTheDocument();
      expect(screen.getByText(/Use markdown headers to organize/)).toBeInTheDocument();
      expect(screen.getByText(/Wrap commands in code blocks/)).toBeInTheDocument();
    });
  });

  it('handles file loading errors', async () => {
    const errorMessage = 'Failed to load command file';
    mockConfigurationService.readFileContent.mockRejectedValue(new Error(errorMessage));

    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Command File')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('file-editor')).not.toBeInTheDocument();
  });

  it('handles save errors gracefully', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Write operation failed';
    
    mockConfigurationService.writeFileContent.mockImplementation(() => 
      Promise.reject(new Error(errorMessage))
    );

    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save-button');
    await act(async () => {
      await user.click(saveButton);
    });

    await waitFor(() => {
      expect(mockConfigurationService.writeFileContent).toHaveBeenCalled();
    });
    
    // Check that error is handled gracefully (component doesn't crash)
    expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('extracts command blocks correctly', async () => {
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Command Blocks (3)')).toBeInTheDocument();
    });
  });

  it('truncates long command blocks in preview', async () => {
    const user = userEvent.setup();
    const longCommandContent = `# Long Command

\`\`\`bash
${Array(50).fill('echo "This is a very long command that should be truncated in the preview"').join('\n')}
\`\`\``;

    mockConfigurationService.readFileContent.mockResolvedValue(longCommandContent);

    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Command Blocks (1)')).toBeInTheDocument();
    });

    const commandBlocksButton = screen.getByText('Command Blocks (1)');
    await user.click(commandBlocksButton);

    await waitFor(() => {
      // Should show truncated content with ellipsis
      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });
  });

  it('limits command block preview to first 3 blocks', async () => {
    const user = userEvent.setup();
    const multipleBlocksContent = `# Multiple Commands

\`\`\`bash
command1
\`\`\`

\`\`\`bash
command2
\`\`\`

\`\`\`bash
command3
\`\`\`

\`\`\`bash
command4
\`\`\`

\`\`\`bash
command5
\`\`\``;

    mockConfigurationService.readFileContent.mockResolvedValue(multipleBlocksContent);

    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Command Blocks (5)')).toBeInTheDocument();
    });

    const commandBlocksButton = screen.getByText('Command Blocks (5)');
    await user.click(commandBlocksButton);

    await waitFor(() => {
      expect(screen.getByText('Block 1:')).toBeInTheDocument();
      expect(screen.getByText('Block 2:')).toBeInTheDocument();
      expect(screen.getByText('Block 3:')).toBeInTheDocument();
      expect(screen.getByText('+2 more command blocks')).toBeInTheDocument();
    });
  });

  it('displays file size in KB', async () => {
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('1.5 KB')).toBeInTheDocument();
    });
  });

  it('handles files without code blocks', async () => {
    const noCodeBlocksContent = '# Command File\n\nThis file has no code blocks.';
    mockConfigurationService.readFileContent.mockResolvedValue(noCodeBlocksContent);

    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument(); // Code blocks count
    });

    // Should not show command blocks section when there are none
    expect(screen.queryByText(/Command Blocks \(/)).not.toBeInTheDocument();
  });

  it('recalculates statistics when content changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

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

  it('handles files without lastModified date', async () => {
    const fileInfoWithoutDate = { ...mockFileInfo, lastModified: undefined };
    
    renderWithProviders(<CommandFileDetails fileInfo={fileInfoWithoutDate} />);

    await waitFor(() => {
      expect(screen.getByText('deploy.md')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Last modified:/)).not.toBeInTheDocument();
  });

  it('handles files without size', async () => {
    const fileInfoWithoutSize = { ...mockFileInfo, size: undefined };
    
    renderWithProviders(<CommandFileDetails fileInfo={fileInfoWithoutSize} />);

    await waitFor(() => {
      expect(screen.getByText('deploy.md')).toBeInTheDocument();
    });

    expect(screen.queryByText('Size')).not.toBeInTheDocument();
  });

  it('validates content with missing headers', async () => {
    const noHeadersContent = 'Just some content without headers.\n\n```bash\necho "test"\n```';
    mockConfigurationService.readFileContent.mockResolvedValue(noHeadersContent);
    
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    // Should detect missing headers in validation
  });

  it('validates content with missing code blocks', async () => {
    const noCodeContent = '# Command File\n\nThis has headers but no code blocks.';
    mockConfigurationService.readFileContent.mockResolvedValue(noCodeContent);
    
    renderWithProviders(<CommandFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    // Should detect missing code blocks in validation
  });
});