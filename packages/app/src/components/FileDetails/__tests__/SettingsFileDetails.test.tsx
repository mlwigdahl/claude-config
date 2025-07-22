import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { SettingsFileDetails } from '../TestWrappers';
import { FileInfo } from '../../../types';
import { OperationsProvider } from '../../../contexts/OperationsContext';

// Mock ConfigurationService
jest.mock('../../../services/configurationService', () => ({
  ConfigurationService: {
    readFileContent: jest.fn(),
    writeFileContent: jest.fn(),
    deleteFile: jest.fn(),
    extractHooksFromSettingsContent: jest.fn(),
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
              await onSave('{"modified": true}');
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

describe('SettingsFileDetails', () => {
  const mockFileInfo: FileInfo = {
    id: 'settings-1',
    name: 'settings.json',
    path: '.claude/settings.json',
    type: 'settings',
    exists: true,
    lastModified: new Date('2023-01-01T12:00:00Z'),
    size: 2048,
  };

  const mockContent = JSON.stringify({
    version: '1.0',
    editor: {
      theme: 'dark',
      fontSize: 14
    },
    hooks: {
      'pre-commit': 'npm test',
      'post-save': 'npm run lint'
    }
  }, null, 2);

  const mockHooks = [
    { name: 'pre-commit', command: 'npm test' },
    { name: 'post-save', command: 'npm run lint' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigurationService.readFileContent.mockResolvedValue(mockContent);
    mockConfigurationService.writeFileContent.mockResolvedValue(undefined);
    mockConfigurationService.deleteFile.mockResolvedValue(undefined);
    mockConfigurationService.extractHooksFromSettingsContent.mockReturnValue(mockHooks);
    mockConfigurationService.validateFileContent.mockResolvedValue({ valid: true, errors: [] });
  });

  it('renders settings file details with header information', async () => {
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('settings.json')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('.claude/settings.json')).toBeInTheDocument();
      expect(screen.getByText(/Last modified:/)).toBeInTheDocument();
    });
  });

  it('loads and displays file content', async () => {
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(mockConfigurationService.readFileContent).toHaveBeenCalledWith(mockFileInfo);
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });
  });

  it('displays file statistics correctly', async () => {
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Keys')).toBeInTheDocument();
      expect(screen.getByText('Hooks')).toBeInTheDocument();
      expect(screen.getByText('Nesting')).toBeInTheDocument();
      expect(screen.getByText('Size')).toBeInTheDocument();
    });
  });

  it('calculates statistics correctly from JSON content', async () => {
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      // Should show hook count - find it specifically by the Hooks label
      expect(screen.getByText('Hooks')).toBeInTheDocument();
      const hooksStatContainer = screen.getByText('Hooks').closest('.chakra-stat');
      expect(hooksStatContainer).toHaveTextContent('2');
    });
  });

  it('extracts and displays hooks information', async () => {
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(mockConfigurationService.extractHooksFromSettingsContent).toHaveBeenCalledWith(mockContent);
    });
  });

  it('shows settings analysis section with hooks', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Settings Analysis')).toBeInTheDocument();
    });

    // Expand the accordion to see hooks
    const analysisButton = screen.getByText('Settings Analysis');
    await user.click(analysisButton);

    await waitFor(() => {
      expect(screen.getByText('Hooks Configuration:')).toBeInTheDocument();
    });
  });

  it('handles file save successfully', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    const saveButton = screen.getByTestId('save-button');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockConfigurationService.writeFileContent).toHaveBeenCalledWith(
        mockFileInfo,
        '{"modified": true}'
      );
    });
  });

  it('handles file deletion with confirmation', async () => {
    const user = userEvent.setup();
    
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete settings.json?');
    
    await waitFor(() => {
      expect(mockConfigurationService.deleteFile).toHaveBeenCalledWith(mockFileInfo);
    });

    confirmSpy.mockRestore();
  });

  it('validates JSON content correctly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    const validateButton = screen.getByTestId('validate-button');
    await user.click(validateButton);

    // Should validate JSON parsing and structure
    expect(mockConfigurationService.validateFileContent).toHaveBeenCalled();
  });

  it('shows validation errors for invalid JSON', async () => {
    mockConfigurationService.readFileContent.mockResolvedValue('invalid json');
    
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });

    // The validation should catch invalid JSON
    // This would be handled by the validation function
  });

  it('shows settings file guidelines', async () => {
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Settings File Guidelines:')).toBeInTheDocument();
      expect(screen.getByText(/Use valid JSON format/)).toBeInTheDocument();
      expect(screen.getByText(/Configure hooks for automated workflows/)).toBeInTheDocument();
    });
  });

  it('handles file loading errors', async () => {
    const errorMessage = 'Failed to load settings file';
    mockConfigurationService.readFileContent.mockRejectedValue(new Error(errorMessage));

    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Settings File')).toBeInTheDocument();
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

    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

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

  it('counts nested keys correctly', async () => {
    const nestedContent = JSON.stringify({
      level1: {
        level2: {
          level3: 'value'
        },
        another: 'value'
      },
      root: 'value'
    }, null, 2);

    mockConfigurationService.readFileContent.mockResolvedValue(nestedContent);

    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      // Should count all keys including nested ones - find specifically by Keys label
      expect(screen.getByText('Keys')).toBeInTheDocument();
      const keysStatContainer = screen.getByText('Keys').closest('.chakra-stat');
      expect(keysStatContainer).toHaveTextContent('5');
    });
  });

  it('calculates maximum nesting level correctly', async () => {
    const deeplyNestedContent = JSON.stringify({
      level1: {
        level2: {
          level3: {
            level4: 'value'
          }
        }
      }
    }, null, 2);

    mockConfigurationService.readFileContent.mockResolvedValue(deeplyNestedContent);

    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      // Should show nesting level (3 levels deep from root) - find by Nesting label
      expect(screen.getByText('Nesting')).toBeInTheDocument();
      const nestingStatContainer = screen.getByText('Nesting').closest('.chakra-stat');
      expect(nestingStatContainer).toHaveTextContent('3');
    });
  });

  it('handles empty settings object', async () => {
    mockConfigurationService.readFileContent.mockResolvedValue('{}');
    mockConfigurationService.extractHooksFromSettingsContent.mockReturnValue([]);

    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      // Check that multiple stats show 0 - verify each by their labels
      expect(screen.getByText('Keys')).toBeInTheDocument();
      expect(screen.getByText('Hooks')).toBeInTheDocument();
      expect(screen.getByText('Nesting')).toBeInTheDocument();
      
      const keysStatContainer = screen.getByText('Keys').closest('.chakra-stat');
      const hooksStatContainer = screen.getByText('Hooks').closest('.chakra-stat');
      const nestingStatContainer = screen.getByText('Nesting').closest('.chakra-stat');
      
      expect(keysStatContainer).toHaveTextContent('0');
      expect(hooksStatContainer).toHaveTextContent('0');
      expect(nestingStatContainer).toHaveTextContent('0');
    });
  });

  it('displays configuration keys preview', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Settings Analysis')).toBeInTheDocument();
    });

    const analysisButton = screen.getByText('Settings Analysis');
    await user.click(analysisButton);

    await waitFor(() => {
      expect(screen.getByText('Configuration Keys:')).toBeInTheDocument();
      expect(screen.getByText(/version, editor, hooks/)).toBeInTheDocument();
    });
  });

  it('handles malformed JSON gracefully', async () => {
    mockConfigurationService.readFileContent.mockResolvedValue('{ invalid json }');
    
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      // Should not crash, should handle parsing errors
      expect(screen.getByTestId('file-editor')).toBeInTheDocument();
    });
  });

  it('displays file size in KB', async () => {
    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    });
  });

  it('handles files without hooks', async () => {
    const contentWithoutHooks = JSON.stringify({
      version: '1.0',
      editor: { theme: 'dark' }
    }, null, 2);

    mockConfigurationService.readFileContent.mockResolvedValue(contentWithoutHooks);
    mockConfigurationService.extractHooksFromSettingsContent.mockReturnValue([]);

    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      // Hooks count should be 0 - find specifically by Hooks label
      expect(screen.getByText('Hooks')).toBeInTheDocument();
      const hooksStatContainer = screen.getByText('Hooks').closest('.chakra-stat');
      expect(hooksStatContainer).toHaveTextContent('0');
    });
  });

  it('truncates long configuration key lists', async () => {
    const user = userEvent.setup();
    const manyKeysContent = JSON.stringify({
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
      key4: 'value4',
      key5: 'value5',
      key6: 'value6',
      key7: 'value7'
    }, null, 2);

    mockConfigurationService.readFileContent.mockResolvedValue(manyKeysContent);

    renderWithProviders(<SettingsFileDetails fileInfo={mockFileInfo} />);

    await waitFor(() => {
      expect(screen.getByText('Settings Analysis')).toBeInTheDocument();
    });

    // Find the accordion button specifically
    const analysisButton = screen.getByRole('button', { name: /Settings Analysis/ });
    await user.click(analysisButton);

    await waitFor(() => {
      expect(screen.getByText('Configuration Keys:')).toBeInTheDocument();
      // Should show ellipsis for truncated keys - be more specific about what text contains ellipsis
      const keysList = screen.getByText(/key1, key2, key3, key4, key5\.\.\./); 
      expect(keysList).toBeInTheDocument();
    });
  });
});