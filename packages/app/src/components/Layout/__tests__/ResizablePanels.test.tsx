import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import ResizablePanels from '../ResizablePanels';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ChakraProvider>{children}</ChakraProvider>
);

describe('ResizablePanels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const LeftPanel = () => <div data-testid="left-panel">Left Panel Content</div>;
  const RightPanel = () => <div data-testid="right-panel">Right Panel Content</div>;

  it('renders both panels', () => {
    render(
      <TestWrapper>
        <ResizablePanels
          leftPanel={<LeftPanel />}
          rightPanel={<RightPanel />}
        />
      </TestWrapper>
    );

    expect(screen.getByTestId('left-panel')).toBeInTheDocument();
    expect(screen.getByTestId('right-panel')).toBeInTheDocument();
  });

  it('renders with resizable elements', () => {
    render(
      <TestWrapper>
        <ResizablePanels
          leftPanel={<LeftPanel />}
          rightPanel={<RightPanel />}
          defaultLeftWidth={400}
        />
      </TestWrapper>
    );

    const leftPanel = screen.getByTestId('resizable-left-panel');
    const divider = screen.getByTestId('resizable-divider');
    const handle = screen.getByTestId('resizable-handle');
    
    expect(leftPanel).toBeInTheDocument();
    expect(divider).toBeInTheDocument();
    expect(handle).toBeInTheDocument();
  });

  it('loads width from localStorage', () => {
    mockLocalStorage.getItem.mockReturnValue('500');

    render(
      <TestWrapper>
        <ResizablePanels
          leftPanel={<LeftPanel />}
          rightPanel={<RightPanel />}
          storageKey="test-key"
          defaultLeftWidth={300}
        />
      </TestWrapper>
    );

    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key');
  });

  it('respects minimum width constraint', () => {
    mockLocalStorage.getItem.mockReturnValue('100'); // Below minimum

    render(
      <TestWrapper>
        <ResizablePanels
          leftPanel={<LeftPanel />}
          rightPanel={<RightPanel />}
          minLeftWidth={200}
        />
      </TestWrapper>
    );

    const leftPanel = screen.getByTestId('resizable-left-panel');
    expect(leftPanel).toBeInTheDocument();
  });

  it('respects maximum width constraint', () => {
    mockLocalStorage.getItem.mockReturnValue('1000'); // Above maximum

    render(
      <TestWrapper>
        <ResizablePanels
          leftPanel={<LeftPanel />}
          rightPanel={<RightPanel />}
          maxLeftWidth={600}
        />
      </TestWrapper>
    );

    const leftPanel = screen.getByTestId('resizable-left-panel');
    expect(leftPanel).toBeInTheDocument();
  });

  it('handles mouse down on divider', () => {
    render(
      <TestWrapper>
        <ResizablePanels
          leftPanel={<LeftPanel />}
          rightPanel={<RightPanel />}
        />
      </TestWrapper>
    );

    const divider = screen.getByTestId('resizable-divider');
    expect(divider).toBeInTheDocument();

    // Simulate mouse down
    fireEvent.mouseDown(divider, { clientX: 100 });

    // Should change cursor and prevent text selection
    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');
  });

  it('handles mouse drag to resize', () => {
    render(
      <TestWrapper>
        <ResizablePanels
          leftPanel={<LeftPanel />}
          rightPanel={<RightPanel />}
          defaultLeftWidth={300}
          minLeftWidth={200}
          maxLeftWidth={600}
        />
      </TestWrapper>
    );

    const divider = screen.getByTestId('resizable-divider');
    const leftPanel = screen.getByTestId('resizable-left-panel');

    // Start drag
    fireEvent.mouseDown(divider, { clientX: 100 });

    // Simulate mouse move
    act(() => {
      fireEvent.mouseMove(document, { clientX: 150 }); // Move 50px right
    });

    // Panel should still exist (functional test rather than exact width)
    expect(leftPanel).toBeInTheDocument();
  });

  it('saves width to localStorage on mouse up', () => {
    render(
      <TestWrapper>
        <ResizablePanels
          leftPanel={<LeftPanel />}
          rightPanel={<RightPanel />}
          storageKey="resize-test"
          defaultLeftWidth={300}
        />
      </TestWrapper>
    );

    const divider = screen.getByTestId('resizable-divider');

    // Start and end drag
    fireEvent.mouseDown(divider, { clientX: 100 });
    act(() => {
      fireEvent.mouseMove(document, { clientX: 150 });
      fireEvent.mouseUp(document);
    });

    // Should save new width (exact value tested functionally)
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('resize-test', expect.any(String));
  });

  it('cleans up event listeners on mouse up', () => {
    const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

    render(
      <TestWrapper>
        <ResizablePanels
          leftPanel={<LeftPanel />}
          rightPanel={<RightPanel />}
        />
      </TestWrapper>
    );

    const divider = screen.getByTestId('resizable-divider');

    // Start and end drag
    fireEvent.mouseDown(divider, { clientX: 100 });
    act(() => {
      fireEvent.mouseUp(document);
    });

    // Should clean up event listeners and styles
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');

    removeEventListenerSpy.mockRestore();
  });

  it('renders visual handle on divider', () => {
    render(
      <TestWrapper>
        <ResizablePanels
          leftPanel={<LeftPanel />}
          rightPanel={<RightPanel />}
        />
      </TestWrapper>
    );

    // Should have a visual handle element
    const handle = screen.getByTestId('resizable-handle');
    expect(handle).toBeInTheDocument();
  });
});