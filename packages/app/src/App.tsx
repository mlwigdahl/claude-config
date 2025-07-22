import React from 'react';
import { FileSystemProvider } from './contexts/FileSystemContext';
import { OperationsProvider } from './contexts/OperationsContext';
import { HooksProvider } from './contexts/HooksContext';
import AppLayout from './components/Layout/AppLayout';

function App() {
  return (
    <FileSystemProvider>
      <OperationsProvider>
        <HooksProvider>
          <AppLayout />
        </HooksProvider>
      </OperationsProvider>
    </FileSystemProvider>
  );
}

export default App;