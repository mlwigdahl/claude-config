import React from 'react';

// Mock Chakra UI components for testing

// Helper to filter out Chakra-specific props
const filterChakraProps = (props: any) => {
  const chakraProps = [
    // Layout props
    'p', 'padding', 'm', 'margin', 'mt', 'mr', 'mb', 'ml', 'pt', 'pr', 'pb', 'pl',
    'px', 'py', 'mx', 'my', 'w', 'width', 'h', 'height', 'minW', 'maxW', 'minH', 'maxH',
    // Flexbox props
    'direction', 'wrap', 'align', 'justify', 'alignItems', 'justifyContent',
    // Grid props
    'templateColumns', 'templateRows', 'gap', 'rowGap', 'columnGap',
    'gridColumn', 'gridRow', 'gridArea', 'colSpan', 'rowSpan',
    // Border props
    'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
    'borderWidth', 'borderStyle', 'borderColor', 'borderRadius',
    // Color props
    'bg', 'background', 'color', 'textColor',
    // Typography props
    'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing',
    'textAlign', 'textDecoration', 'textTransform',
    // Chakra-specific props
    'colorScheme', 'variant', 'size', 'isLoading', 'loadingText',
    'leftIcon', 'rightIcon', 'spinner', 'spinnerPlacement',
    // Additional props
    'spacing', 'isOpen', 'onClose', 'onOpen', 'isCentered', 'motionPreset',
    'status', 'colorMode', 'orientation', 'placement', 'hasArrow'
  ];

  const filteredProps = { ...props };
  chakraProps.forEach(prop => {
    delete filteredProps[prop];
  });

  return filteredProps;
};

// Mock ChakraProvider
export const ChakraProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

// Mock useToast
export const useToast = () => {
  const mockToast = (options?: any) => {
    console.log('Toast called with:', options);
  };
  
  // Add jest mock properties manually
  (mockToast as any).mockClear = () => {};
  (mockToast as any).mockReset = () => {};
  (mockToast as any).mockRestore = () => {};
  
  return mockToast;
};

// Mock useColorModeValue
export const useColorModeValue = (lightValue: any, darkValue: any) => lightValue;

// Mock useColorMode
export const useColorMode = () => ({
  colorMode: 'light',
  toggleColorMode: jest.fn(),
  setColorMode: jest.fn(),
});

// Mock useDisclosure
export const useDisclosure = (defaultIsOpen?: boolean) => {
  const [isOpen, setIsOpen] = React.useState(defaultIsOpen || false);
  
  return {
    isOpen,
    onOpen: jest.fn(() => setIsOpen(true)),
    onClose: jest.fn(() => setIsOpen(false)),
    onToggle: jest.fn(() => setIsOpen(!isOpen)),
    isControlled: false,
    getButtonProps: jest.fn(() => ({})),
    getDisclosureProps: jest.fn(() => ({})),
  };
};

// Layout components
export const Box = ({ children, ...props }: any) => (
  <div data-testid="box" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const Container = ({ children, ...props }: any) => (
  <div data-testid="container" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const Flex = ({ children, ...props }: any) => (
  <div data-testid="flex" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const Grid = ({ children, ...props }: any) => (
  <div data-testid="grid" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const GridItem = ({ children, ...props }: any) => (
  <div data-testid="grid-item" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const VStack = ({ children, ...props }: any) => (
  <div data-testid="vstack" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const HStack = ({ children, ...props }: any) => (
  <div data-testid="hstack" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const Stack = ({ children, ...props }: any) => (
  <div data-testid="stack" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const SimpleGrid = ({ children, ...props }: any) => (
  <div data-testid="simple-grid" {...filterChakraProps(props)}>
    {children}
  </div>
);

// Typography components
export const Heading = ({ children, ...props }: any) => (
  <h1 {...filterChakraProps(props)}>{children}</h1>
);

export const Text = ({ children, ...props }: any) => (
  <p {...filterChakraProps(props)}>{children}</p>
);

export const Badge = ({ children, ...props }: any) => (
  <span data-testid="badge" {...filterChakraProps(props)}>
    {children}
  </span>
);

// Form components
export const Button = ({ children, disabled, isDisabled, isLoading, loadingText, ...props }: any) => (
  <button disabled={disabled || isDisabled || isLoading} {...filterChakraProps(props)}>
    {isLoading && loadingText ? loadingText : children}
  </button>
);

export const ButtonGroup = ({ children, ...props }: any) => (
  <div data-testid="button-group" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const IconButton = ({ 'aria-label': ariaLabel, icon, ...props }: any) => (
  <button aria-label={ariaLabel} {...filterChakraProps(props)}>
    {icon}
  </button>
);

export const Input = ({ value, onChange, isReadOnly, ...props }: any) => {
  const [internalValue, setInternalValue] = React.useState(value || '');
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <input 
      {...filterChakraProps(props)}
      value={value !== undefined ? value : internalValue}
      onChange={handleChange}
      readOnly={isReadOnly}
    />
  );
};

export const Select = ({ children, value, onChange, ...props }: any) => {
  const [internalValue, setInternalValue] = React.useState(value || '');
  
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setInternalValue(newValue);
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <select 
      {...filterChakraProps(props)}
      value={value !== undefined ? value : internalValue}
      onChange={handleChange}
    >
      {children}
    </select>
  );
};

export const Textarea = ({ ...props }: any) => (
  <textarea {...filterChakraProps(props)} />
);

export const FormControl = ({ children, isInvalid, ...props }: any) => (
  <div data-testid="form-control" aria-invalid={isInvalid} {...filterChakraProps(props)}>
    {children}
  </div>
);

export const FormLabel = ({ children, htmlFor, ...props }: any) => (
  <label htmlFor={htmlFor} {...filterChakraProps(props)}>{children}</label>
);

export const FormHelperText = ({ children, ...props }: any) => (
  <div data-testid="form-helper-text" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const FormErrorMessage = ({ children, ...props }: any) => (
  <div data-testid="form-error-message" role="alert" {...filterChakraProps(props)}>
    {children}
  </div>
);

// Feedback components
export const Alert = ({ children, ...props }: any) => (
  <div data-testid="alert" role="alert" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const AlertIcon = ({ ...props }: any) => (
  <span data-testid="alert-icon" {...filterChakraProps(props)} />
);

export const AlertTitle = ({ children, ...props }: any) => (
  <span data-testid="alert-title" {...filterChakraProps(props)}>
    {children}
  </span>
);

export const AlertDescription = ({ children, ...props }: any) => (
  <span data-testid="alert-description" {...filterChakraProps(props)}>
    {children}
  </span>
);

export const CloseButton = ({ ...props }: any) => (
  <button data-testid="close-button" aria-label="Close" {...filterChakraProps(props)}>
    ×
  </button>
);

export const Spinner = ({ ...props }: any) => (
  <div data-testid="spinner" {...filterChakraProps(props)}>Loading...</div>
);

export const Progress = ({ value, ...props }: any) => (
  <div data-testid="progress" {...filterChakraProps(props)}>
    <div style={{ width: `${value}%` }}>Progress: {value}%</div>
  </div>
);

// Overlay components
export const Modal = ({ children, isOpen, onClose, ...props }: any) => {
  if (!isOpen) return null;
  return (
    <div data-testid="modal" role="dialog" {...filterChakraProps(props)}>
      {children}
    </div>
  );
};

export const ModalOverlay = ({ ...props }: any) => (
  <div data-testid="modal-overlay" {...filterChakraProps(props)} />
);

export const ModalContent = ({ children, ...props }: any) => (
  <div data-testid="modal-content" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const ModalHeader = ({ children, ...props }: any) => (
  <div data-testid="modal-header" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const ModalBody = ({ children, ...props }: any) => (
  <div data-testid="modal-body" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const ModalFooter = ({ children, ...props }: any) => (
  <div data-testid="modal-footer" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const ModalCloseButton = ({ ...props }: any) => (
  <button data-testid="modal-close-button" aria-label="Close" {...filterChakraProps(props)}>
    ×
  </button>
);

// Disclosure components
export const Accordion = ({ children, ...props }: any) => (
  <div data-testid="accordion" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const AccordionItem = ({ children, ...props }: any) => (
  <div data-testid="accordion-item" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const AccordionButton = ({ children, ...props }: any) => (
  <button data-testid="accordion-button" {...filterChakraProps(props)}>
    {children}
  </button>
);

export const AccordionPanel = ({ children, ...props }: any) => (
  <div data-testid="accordion-panel" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const AccordionIcon = ({ ...props }: any) => (
  <span data-testid="accordion-icon" {...filterChakraProps(props)} />
);

// Data display components
export const Stat = ({ children, ...props }: any) => (
  <div className="chakra-stat" data-testid="stat" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const StatLabel = ({ children, ...props }: any) => (
  <div data-testid="stat-label" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const StatNumber = ({ children, ...props }: any) => (
  <div data-testid="stat-number" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const StatHelpText = ({ children, ...props }: any) => (
  <div data-testid="stat-help-text" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const Code = ({ children, ...props }: any) => (
  <code {...filterChakraProps(props)}>{children}</code>
);

export const Divider = ({ ...props }: any) => (
  <hr data-testid="divider" {...filterChakraProps(props)} />
);

export const Tooltip = ({ children, label, ...props }: any) => (
  <div title={label} {...filterChakraProps(props)}>
    {children}
  </div>
);

// Alert Dialog components
export const AlertDialog = ({ children, isOpen, onClose, ...props }: any) => {
  if (!isOpen) return null;
  return (
    <div data-testid="alert-dialog" role="alertdialog" {...filterChakraProps(props)}>
      {children}
    </div>
  );
};

export const AlertDialogOverlay = ({ children, ...props }: any) => (
  <div data-testid="alert-dialog-overlay" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const AlertDialogContent = ({ children, ...props }: any) => (
  <div data-testid="alert-dialog-content" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const AlertDialogHeader = ({ children, ...props }: any) => (
  <div data-testid="alert-dialog-header" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const AlertDialogBody = ({ children, ...props }: any) => (
  <div data-testid="alert-dialog-body" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const AlertDialogFooter = ({ children, ...props }: any) => (
  <div data-testid="alert-dialog-footer" {...filterChakraProps(props)}>
    {children}
  </div>
);

// Navigation components
export const Tabs = ({ children, ...props }: any) => (
  <div data-testid="tabs" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const TabList = ({ children, ...props }: any) => (
  <div data-testid="tab-list" role="tablist" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const Tab = ({ children, ...props }: any) => (
  <button data-testid="tab" role="tab" {...filterChakraProps(props)}>
    {children}
  </button>
);

export const TabPanels = ({ children, ...props }: any) => (
  <div data-testid="tab-panels" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const TabPanel = ({ children, ...props }: any) => (
  <div data-testid="tab-panel" role="tabpanel" {...filterChakraProps(props)}>
    {children}
  </div>
);

// Menu components
export const Menu = ({ children, ...props }: any) => (
  <div data-testid="menu" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const MenuButton = ({ children, ...props }: any) => (
  <button data-testid="menu-button" {...filterChakraProps(props)}>
    {children}
  </button>
);

export const MenuList = ({ children, ...props }: any) => (
  <div data-testid="menu-list" {...filterChakraProps(props)}>
    {children}
  </div>
);

export const MenuItem = ({ children, ...props }: any) => (
  <button data-testid="menu-item" {...filterChakraProps(props)}>
    {children}
  </button>
);

export const MenuDivider = ({ ...props }: any) => (
  <hr data-testid="menu-divider" {...filterChakraProps(props)} />
);

// Icon component (generic)
export const Icon = ({ as: IconComponent, ...props }: any) => {
  if (IconComponent) {
    return <IconComponent {...props} />;
  }
  return <svg data-testid="icon" {...filterChakraProps(props)} />;
};

