import React from 'react';
import { render, screen } from '@testing-library/react';
import Header from '../Header';
import { FileSystemProvider } from '../../../contexts/FileSystemContext';

// Mock ExportDialog component
jest.mock('../../Export/ExportDialog', () => {
  return {
    __esModule: true,
    default: () => <div data-testid="export-dialog">Export Dialog</div>,
  };
});

// Mock Chakra UI icons
jest.mock('@chakra-ui/icons', () => ({
  DownloadIcon: () => <span data-testid="download-icon">📥</span>,
}));

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
      // Grid props
      templateColumns, templateRows, gap, rowGap, columnGap,
      gridColumn, gridRow, gridArea, colSpan, rowSpan,
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
      leftIcon, rightIcon, spinner, spinnerPlacement,
      // Filter out these and any other non-standard HTML props
      ...filteredProps
    } = props;
    return filteredProps;
  };

  return {
    Box: ({ children, ...props }: any) => <div data-testid="box" {...filterChakraProps(props)}>{children}</div>,
    Flex: ({ children, ...props }: any) => <div data-testid="flex" {...filterChakraProps(props)}>{children}</div>,
    Heading: ({ children, ...props }: any) => <h1 {...filterChakraProps(props)}>{children}</h1>,
    Text: ({ children, ...props }: any) => <p {...filterChakraProps(props)}>{children}</p>,
    Button: ({ children, ...props }: any) => <button {...filterChakraProps(props)}>{children}</button>,
    HStack: ({ children, ...props }: any) => <div data-testid="hstack" {...filterChakraProps(props)}>{children}</div>,
    useColorModeValue: () => '#ffffff',
  };
});

const renderHeader = () => {
  return render(
    <FileSystemProvider>
      <Header />
    </FileSystemProvider>
  );
};

describe('Header', () => {
  it('renders the main title', () => {
    renderHeader();
    expect(screen.getByRole('heading', { name: /claude code configuration console/i })).toBeInTheDocument();
  });

  it('displays the subtitle', () => {
    renderHeader();
    expect(screen.getByText(/manage your claude code settings, commands, and memory files/i)).toBeInTheDocument();
  });

  it('applies correct heading level', () => {
    renderHeader();
    const heading = screen.getByRole('heading', { name: /claude code configuration console/i });
    expect(heading.tagName).toBe('H1');
  });
});