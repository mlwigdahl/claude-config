import React from 'react';

// Mock Chakra UI icons for Jest testing
const MockIcon = ({ 'data-testid': testId, ...props }: any) =>
  React.createElement('svg', { 'data-testid': testId || 'mock-icon', ...props });

export const SearchIcon = MockIcon;
export const RepeatIcon = MockIcon;
export const ChevronRightIcon = MockIcon;
export const ChevronDownIcon = MockIcon;
export const FolderIcon = MockIcon;
export const DocumentIcon = MockIcon;

// Export any other icons you might need
export default MockIcon;