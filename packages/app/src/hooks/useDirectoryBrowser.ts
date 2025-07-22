import { useState, useCallback } from 'react';

export interface UseDirectoryBrowserResult {
  isOpen: boolean;
  openBrowser: (initialPath?: string) => void;
  closeBrowser: () => void;
  onDirectorySelect: (path: string, callback?: (path: string) => void) => void;
}

export const useDirectoryBrowser = (): UseDirectoryBrowserResult => {
  const [isOpen, setIsOpen] = useState(false);
  const [_initialPath, setInitialPath] = useState<string>('/');
  const [selectCallback, setSelectCallback] = useState<
    ((path: string) => void) | undefined
  >();

  const openBrowser = useCallback((defaultPath?: string) => {
    setInitialPath(defaultPath || '/');
    setIsOpen(true);
  }, []);

  const closeBrowser = useCallback(() => {
    setIsOpen(false);
    setSelectCallback(undefined);
  }, []);

  const onDirectorySelect = useCallback(
    (path: string, callback?: (path: string) => void) => {
      if (callback) {
        callback(path);
      }
      if (selectCallback) {
        selectCallback(path);
      }
      closeBrowser();
    },
    [selectCallback, closeBrowser]
  );

  return {
    isOpen,
    openBrowser,
    closeBrowser,
    onDirectorySelect,
  };
};
