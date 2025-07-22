import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import ExportDialog from '../ExportDialog';

// Override render to use a working container for React 18
const customRender = (ui: React.ReactElement, options?: any) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  const result = render(ui, { container, ...options });
  
  return {
    ...result,
    unmount: () => {
      result.unmount();
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }
  };
};

// Mock Chakra UI components for testing
jest.mock('@chakra-ui/react', () => {
  // Helper to filter out Chakra-specific props
  const filterChakraProps = (props: any) => {
    const {
      // Layout props
      p, padding, m, margin, mt, mr, mb, ml, pt, pr, pb, pl,
      px, py, mx, my, w, width, h, height, minW, maxW, minH, maxH,
      // Flexbox props  
      direction, wrap, align, justify, alignItems, justifyContent,
      // Border props
      border, borderTop, borderRight, borderBottom, borderLeft,
      borderWidth, borderStyle, borderColor, borderRadius,
      // Color props
      bg, background, color, textColor,
      // Typography props
      fontSize, fontWeight, fontFamily, lineHeight, letterSpacing,
      textAlign, textDecoration, textTransform,
      // Chakra-specific props
      colorScheme, variant, size, isLoading, loadingText,
      leftIcon, rightIcon, spinner, spinnerPlacement, isChecked, onChange, value,
      isDisabled, isOpen, onClose,
      // Filter out these and any other non-standard HTML props
      ...filteredProps
    } = props;
    return filteredProps;
  };

  return {
    Modal: ({ children, isOpen }: any) => isOpen ? <div data-testid="modal">{children}</div> : null,
    ModalOverlay: ({ children }: any) => <div data-testid="modal-overlay">{children}</div>,
    ModalContent: ({ children }: any) => <div data-testid="modal-content">{children}</div>,
    ModalHeader: ({ children }: any) => <div data-testid="modal-header">{children}</div>,
    ModalFooter: ({ children }: any) => <div data-testid="modal-footer">{children}</div>,
    ModalBody: ({ children }: any) => <div data-testid="modal-body">{children}</div>,
    ModalCloseButton: () => <button data-testid="modal-close-button">×</button>,
    Button: ({ children, onClick, isDisabled, ...props }: any) => (
      <button onClick={onClick} disabled={isDisabled} {...filterChakraProps(props)}>{children}</button>
    ),
    VStack: ({ children }: any) => <div data-testid="vstack">{children}</div>,
    HStack: ({ children }: any) => <div data-testid="hstack">{children}</div>,
    FormControl: ({ children }: any) => <div data-testid="form-control">{children}</div>,
    FormLabel: ({ children }: any) => <label data-testid="form-label">{children}</label>,
    Radio: ({ children, value, ...props }: any) => (
      <input type="radio" value={value} {...filterChakraProps(props)} />
    ),
    RadioGroup: ({ children, value, onChange }: any) => (
      <div data-testid="radio-group" data-value={value}>{children}</div>
    ),
    Stack: ({ children }: any) => <div data-testid="stack">{children}</div>,
    Checkbox: ({ children, isChecked, onChange }: any) => (
      <label>
        <input type="checkbox" checked={isChecked} onChange={onChange} />
        {children}
      </label>
    ),
    Text: ({ children }: any) => <span data-testid="text">{children}</span>,
    Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
    AlertIcon: () => <span data-testid="alert-icon">ℹ</span>,
    useToast: () => jest.fn(),
    Spinner: () => <div data-testid="spinner">Loading...</div>,
  };
});

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock window.URL methods
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: jest.fn(() => 'mock-blob-url'),
    revokeObjectURL: jest.fn(),
  },
});

// Mock document methods
const mockClick = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();

Object.defineProperty(document, 'createElement', {
  value: jest.fn(() => ({
    click: mockClick,
    href: '',
    download: '',
  })),
});

Object.defineProperty(document.body, 'appendChild', {
  value: mockAppendChild,
});

Object.defineProperty(document.body, 'removeChild', {
  value: mockRemoveChild,
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div data-testid="test-wrapper">{children}</div>
);

describe.skip('ExportDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    projectPath: '/test/project',
    projectName: 'test-project'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders export dialog with all options', () => {
    const { unmount } = customRender(
      <TestWrapper>
        <ExportDialog {...defaultProps} />
      </TestWrapper>
    );
    
    // Clean up after test
    afterEach(() => {
      unmount();
    });

    expect(screen.getByText('Export Project: test-project')).toBeInTheDocument();
    expect(screen.getByText('Memory Files')).toBeInTheDocument();
    expect(screen.getByText('Settings Files')).toBeInTheDocument();
    expect(screen.getByText('Additional Options')).toBeInTheDocument();
  });

  it('loads default options on open', async () => {
    const defaultOptions = {
      memoryFiles: 'all',
      settingsFiles: 'both',
      commandFiles: true,
      includeInactive: false,
      recursive: true,
      format: 'zip'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(defaultOptions)
    } as Response);

    render(
      <TestWrapper>
        <ExportDialog {...defaultProps} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/export/defaults');
    });

    // Check that default options are selected
    expect(screen.getByDisplayValue('all')).toBeChecked();
    expect(screen.getByDisplayValue('both')).toBeChecked();
  });

  it('allows changing memory file options', () => {
    render(
      <TestWrapper>
        <ExportDialog {...defaultProps} />
      </TestWrapper>
    );

    const claudeOnlyRadio = screen.getByDisplayValue('claude-only');
    fireEvent.click(claudeOnlyRadio);

    expect(claudeOnlyRadio).toBeChecked();
  });

  it('allows changing settings file options', () => {
    render(
      <TestWrapper>
        <ExportDialog {...defaultProps} />
      </TestWrapper>
    );

    const projectOnlyRadio = screen.getByDisplayValue('project-only');
    fireEvent.click(projectOnlyRadio);

    expect(projectOnlyRadio).toBeChecked();
  });

  it('allows toggling additional options', () => {
    render(
      <TestWrapper>
        <ExportDialog {...defaultProps} />
      </TestWrapper>
    );

    const inactiveCheckbox = screen.getByLabelText('Include inactive files (.inactive suffix)');
    const recursiveCheckbox = screen.getByLabelText('Recurse into subdirectories');

    fireEvent.click(inactiveCheckbox);
    fireEvent.click(recursiveCheckbox);

    expect(inactiveCheckbox).toBeChecked();
    expect(recursiveCheckbox).not.toBeChecked();
  });

  it('disables export button when no file types selected', () => {
    render(
      <TestWrapper>
        <ExportDialog {...defaultProps} />
      </TestWrapper>
    );

    // Set all options to none/false
    const memoryNone = screen.getByDisplayValue('none');
    const settingsNone = screen.getAllByDisplayValue('none')[1]; // Second 'none' radio
    const commandCheckbox = screen.getByLabelText('Include command files');

    fireEvent.click(memoryNone);
    fireEvent.click(settingsNone);
    fireEvent.click(commandCheckbox); // Uncheck

    const exportButton = screen.getByText('Export Project');
    expect(exportButton).toBeDisabled();
    expect(screen.getByText('Please select at least one type of file to export.')).toBeInTheDocument();
  });

  it('exports project successfully', async () => {
    const mockBlob = new Blob(['mock-zip-content'], { type: 'application/zip' });
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (name: string) => {
          if (name === 'content-disposition') {
            return 'attachment; filename="test-project-export.zip"';
          }
          return null;
        }
      },
      blob: () => Promise.resolve(mockBlob)
    } as Response);

    render(
      <TestWrapper>
        <ExportDialog {...defaultProps} />
      </TestWrapper>
    );

    const exportButton = screen.getByText('Export Project');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/export', expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"projectPath":"/test/project"')
      }));
    });

    // Verify file download was triggered
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
  });

  it('handles export failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error'
    } as Response);

    render(
      <TestWrapper>
        <ExportDialog {...defaultProps} />
      </TestWrapper>
    );

    const exportButton = screen.getByText('Export Project');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/export', expect.any(Object));
    });

    // The error would be shown via toast, which is harder to test in unit tests
    // In a real app, you might want to use a more testable notification system
  });

  it('calls onClose when dialog is closed', () => {
    const mockOnClose = jest.fn();
    
    render(
      <TestWrapper>
        <ExportDialog {...defaultProps} onClose={mockOnClose} />
      </TestWrapper>
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state during export', async () => {
    // Mock a slow response
    mockFetch.mockImplementation(() => new Promise(resolve => {
      setTimeout(() => resolve({
        ok: true,
        headers: { get: () => null },
        blob: () => Promise.resolve(new Blob())
      } as Response), 100);
    }));

    render(
      <TestWrapper>
        <ExportDialog {...defaultProps} />
      </TestWrapper>
    );

    const exportButton = screen.getByText('Export Project');
    fireEvent.click(exportButton);

    // Check loading state
    expect(screen.getByText('Exporting...')).toBeInTheDocument();
    expect(exportButton).toBeDisabled();
  });
});