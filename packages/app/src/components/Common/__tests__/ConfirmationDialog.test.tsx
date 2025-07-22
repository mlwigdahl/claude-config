import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChakraProvider } from '@chakra-ui/react';
import { ConfirmationDialog } from '../ConfirmationDialog';

const renderWithChakra = (component: React.ReactElement) => {
  return render(
    <ChakraProvider>
      {component}
    </ChakraProvider>
  );
};

describe('ConfirmationDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Test Title',
    message: 'Test message',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render when open', () => {
    renderWithChakra(<ConfirmationDialog {...defaultProps} />);
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderWithChakra(<ConfirmationDialog {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
  });

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    renderWithChakra(<ConfirmationDialog {...defaultProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    renderWithChakra(<ConfirmationDialog {...defaultProps} />);
    
    const confirmButton = screen.getByText('Confirm');
    await user.click(confirmButton);
    
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should use custom button text when provided', () => {
    renderWithChakra(
      <ConfirmationDialog 
        {...defaultProps} 
        confirmText="Delete Now"
        cancelText="Abort"
      />
    );
    
    expect(screen.getByText('Delete Now')).toBeInTheDocument();
    expect(screen.getByText('Abort')).toBeInTheDocument();
  });

  it('should show loading state on confirm button', () => {
    renderWithChakra(
      <ConfirmationDialog 
        {...defaultProps} 
        isLoading={true}
        confirmText="Delete"
      />
    );
    
    const confirmButton = screen.getByText('Delete');
    expect(confirmButton).toBeDisabled();
  });

  it('should disable both buttons when loading', () => {
    renderWithChakra(
      <ConfirmationDialog 
        {...defaultProps} 
        isLoading={true}
      />
    );
    
    expect(screen.getByText('Cancel')).toBeDisabled();
    expect(screen.getByText('Confirm')).toBeDisabled();
  });

  it('should render with danger variant by default', () => {
    renderWithChakra(<ConfirmationDialog {...defaultProps} />);
    
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toBeInTheDocument();
  });

  it('should render with warning variant when specified', () => {
    renderWithChakra(
      <ConfirmationDialog 
        {...defaultProps} 
        variant="warning"
      />
    );
    
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toBeInTheDocument();
  });

  it('should render with info variant when specified', () => {
    renderWithChakra(
      <ConfirmationDialog 
        {...defaultProps} 
        variant="info"
      />
    );
    
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toBeInTheDocument();
  });

  it('should render dialog with proper accessibility attributes', () => {
    renderWithChakra(<ConfirmationDialog {...defaultProps} />);
    
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
  });

  it('should support tab navigation to buttons', async () => {
    const user = userEvent.setup();
    renderWithChakra(<ConfirmationDialog {...defaultProps} />);
    
    // Both buttons should be tabbable
    const cancelButton = screen.getByText('Cancel');
    const confirmButton = screen.getByText('Confirm');
    
    expect(cancelButton).toBeInTheDocument();
    expect(confirmButton).toBeInTheDocument();
    
    // Clicking Enter on confirm button should trigger confirm
    confirmButton.focus();
    await user.keyboard('{Enter}');
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });
});