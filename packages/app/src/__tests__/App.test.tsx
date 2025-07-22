import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

// Mock the File System Access API
const mockShowDirectoryPicker = jest.fn();
(globalThis as any).showDirectoryPicker = mockShowDirectoryPicker;

// Mock FileDetailsPanel to avoid complex dependencies
jest.mock('../components/FileDetails/FileDetailsPanel', () => {
  return {
    FileDetailsPanel: () => (
      <div data-testid="file-details-panel">
        <p>Select a file to view details</p>
      </div>
    ),
  };
});

// Mock CreateFilePanel to avoid complex dependencies
jest.mock('../components/Creation/CreateFilePanel', () => {
  return {
    __esModule: true,
    default: () => (
      <div data-testid="create-file-panel">
        <button disabled>Memory</button>
        <button disabled>Settings</button>
        <button disabled>Command</button>
      </div>
    ),
  };
});

// Mock Chakra UI components for testing
jest.mock('@chakra-ui/react', () => {
  // Helper to filter out Chakra-specific props

  const filterChakraProps = (props: any) => {
    // Define list of Chakra props to filter out
    const chakraProps = [
      // Layout props
      'p',
      'padding',
      'm',
      'margin',
      'mt',
      'mr',
      'mb',
      'ml',
      'pt',
      'pr',
      'pb',
      'pl',
      'px',
      'py',
      'mx',
      'my',
      'w',
      'width',
      'h',
      'height',
      'minW',
      'maxW',
      'minH',
      'maxH',
      // Flexbox props
      'direction',
      'wrap',
      'align',
      'justify',
      'alignItems',
      'justifyContent',
      // Grid props
      'templateColumns',
      'templateRows',
      'gap',
      'rowGap',
      'columnGap',
      'gridColumn',
      'gridRow',
      'gridArea',
      'colSpan',
      'rowSpan',
      // Border props
      'border',
      'borderTop',
      'borderRight',
      'borderBottom',
      'borderLeft',
      'borderWidth',
      'borderStyle',
      'borderColor',
      'borderRadius',
      // Color props
      'bg',
      'background',
      'color',
      'textColor',
      // Typography props
      'fontSize',
      'fontWeight',
      'fontFamily',
      'lineHeight',
      'letterSpacing',
      'textAlign',
      'textDecoration',
      'textTransform',
      // Chakra-specific props
      'colorScheme',
      'variant',
      'size',
      'isLoading',
      'loadingText',
      'leftIcon',
      'rightIcon',
      'spinner',
      'spinnerPlacement',
    ];

    const filteredProps = { ...props };
    chakraProps.forEach(prop => {
      delete filteredProps[prop];
    });

    return filteredProps;
  };

  return {
    Box: ({ children, ...props }: any) => (
      <div data-testid="box" {...filterChakraProps(props)}>
        {children}
      </div>
    ),
    Grid: ({ children, ...props }: any) => (
      <div data-testid="grid" {...filterChakraProps(props)}>
        {children}
      </div>
    ),
    GridItem: ({ children, ...props }: any) => (
      <div data-testid="grid-item" {...filterChakraProps(props)}>
        {children}
      </div>
    ),
    VStack: ({ children, ...props }: any) => (
      <div data-testid="vstack" {...filterChakraProps(props)}>
        {children}
      </div>
    ),
    Flex: ({ children, ...props }: any) => (
      <div data-testid="flex" {...filterChakraProps(props)}>
        {children}
      </div>
    ),
    Heading: ({ children, ...props }: any) => (
      <h1 {...filterChakraProps(props)}>{children}</h1>
    ),
    Text: ({ children, ...props }: any) => (
      <p {...filterChakraProps(props)}>{children}</p>
    ),
    Button: ({ children, disabled, isDisabled, ...props }: any) => (
      <button disabled={disabled || isDisabled} {...filterChakraProps(props)}>
        {children}
      </button>
    ),
    ButtonGroup: ({ children, ...props }: any) => (
      <div data-testid="button-group" {...filterChakraProps(props)}>
        {children}
      </div>
    ),
    Alert: ({ children, ...props }: any) => (
      <div data-testid="alert" {...filterChakraProps(props)}>
        {children}
      </div>
    ),
    AlertIcon: ({ ...props }: any) => (
      <span data-testid="alert-icon" {...filterChakraProps(props)} />
    ),
    AlertTitle: ({ children, ...props }: any) => (
      <span data-testid="alert-title" {...filterChakraProps(props)}>
        {children}
      </span>
    ),
    AlertDescription: ({ children, ...props }: any) => (
      <span data-testid="alert-description" {...filterChakraProps(props)}>
        {children}
      </span>
    ),
    CloseButton: ({ ...props }: any) => (
      <button data-testid="close-button" {...filterChakraProps(props)}>
        ×
      </button>
    ),
    useColorModeValue: () => '#ffffff',
    useToast: () => {
      const mockToast = (options?: any) => {
        console.log('Toast called with:', options);
      };
      return mockToast;
    },
    useDisclosure: (defaultIsOpen?: boolean) => ({
      isOpen: defaultIsOpen || false,
      onOpen: jest.fn(),
      onClose: jest.fn(),
      onToggle: jest.fn(),
      isControlled: false,
      getButtonProps: jest.fn(() => ({})),
      getDisclosureProps: jest.fn(() => ({})),
    }),
  };
});

const renderApp = () => {
  return render(<App />);
};

describe.skip('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    renderApp();
    expect(
      screen.getByText('Claude Code Configuration Manager')
    ).toBeInTheDocument();
  });

  it('displays the main header', () => {
    renderApp();
    expect(
      screen.getByRole('heading', {
        name: /claude code configuration manager/i,
      })
    ).toBeInTheDocument();
  });

  it('displays project structure section', () => {
    renderApp();
    expect(screen.getByText('Project Structure')).toBeInTheDocument();
  });

  it('displays user files section', () => {
    renderApp();
    expect(screen.getByText('User Files')).toBeInTheDocument();
  });

  it('displays select project button when no project is selected', () => {
    renderApp();
    expect(screen.getByText('Select Project')).toBeInTheDocument();
    expect(screen.getByText('No project selected')).toBeInTheDocument();
  });

  it('does not display create buttons when no project is selected', () => {
    renderApp();
    expect(
      screen.queryByRole('button', { name: /memory/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /settings/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /command/i })
    ).not.toBeInTheDocument();
  });

  it('shows file selection prompt when no file is selected', () => {
    renderApp();
    expect(
      screen.getByText('Select a file to view details')
    ).toBeInTheDocument();
  });
});
