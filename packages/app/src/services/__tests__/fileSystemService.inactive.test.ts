import { FileSystemService } from '../fileSystemService';

// Mock fetch for testing
global.fetch = jest.fn();

describe('FileSystemService - Inactive File Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isConfigurationFile - inactive file detection', () => {
    it('should recognize inactive memory files', () => {
      const result = FileSystemService.isConfigurationFile('CLAUDE.md.inactive');
      expect(result).toEqual({
        type: 'memory',
        valid: true,
        isInactive: true
      });
    });

    it('should recognize inactive settings files', () => {
      const result = FileSystemService.isConfigurationFile('settings.json.inactive');
      expect(result).toEqual({
        type: 'settings',
        valid: true,
        isInactive: true
      });
    });

    it('should recognize inactive command files', () => {
      const result = FileSystemService.isConfigurationFile('mycommand.md.inactive', '/project/.claude/commands/mycommand.md.inactive');
      expect(result).toEqual({
        type: 'command',
        valid: true,
        isInactive: true
      });
    });

    it('should reject invalid inactive files', () => {
      const result = FileSystemService.isConfigurationFile('invalid.txt.inactive');
      expect(result).toEqual({
        type: null,
        valid: false,
        isInactive: false,
        validationError: 'Invalid inactive file: "invalid.txt" is not a valid configuration file'
      });
    });

    it('should reject files with .inactive in wrong position', () => {
      const result = FileSystemService.isConfigurationFile('CLAUDE.inactive.md');
      expect(result).toEqual({
        type: null,
        valid: false,
        isInactive: false,
        validationError: 'Invalid file name: ".inactive" should only appear at the end of the filename'
      });
    });

    it('should handle active files normally', () => {
      const result = FileSystemService.isConfigurationFile('CLAUDE.md');
      expect(result).toEqual({
        type: 'memory',
        valid: true,
        isInactive: false
      });
    });
  });

  describe('deactivateFile', () => {
    beforeEach(() => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/file?')) {
          // Mock file exists check
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ message: 'File not found' })
          });
        }
        if (url.includes('/api/filesystem/rename')) {
          // Mock rename operation
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
    });

    it('should deactivate an active file', async () => {
      const result = await FileSystemService.deactivateFile('/path/to/CLAUDE.md');
      expect(result).toBe('/path/to/CLAUDE.md.inactive');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/filesystem/file?path=')
        // GET request has no body, just the URL with query params
      );
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/filesystem/rename'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            oldPath: '/path/to/CLAUDE.md',
            newPath: '/path/to/CLAUDE.md.inactive'
          })
        })
      );
    });

    it('should throw error if file is already inactive', async () => {
      await expect(
        FileSystemService.deactivateFile('/path/to/CLAUDE.md.inactive')
      ).rejects.toThrow('File is already inactive');
    });

    it('should throw error if inactive version already exists', async () => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/file?')) {
          // Mock inactive file already exists
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ content: 'existing content' })
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      await expect(
        FileSystemService.deactivateFile('/path/to/CLAUDE.md')
      ).rejects.toThrow('Cannot deactivate: inactive version already exists');
    });
  });

  describe('activateFile', () => {
    beforeEach(() => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/file?')) {
          // Mock file exists check
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ message: 'File not found' })
          });
        }
        if (url.includes('/api/filesystem/rename')) {
          // Mock rename operation
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });
    });

    it('should activate an inactive file', async () => {
      const result = await FileSystemService.activateFile('/path/to/CLAUDE.md.inactive');
      expect(result).toBe('/path/to/CLAUDE.md');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/filesystem/file?path=')
        // GET request has no body, just the URL with query params
      );
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/filesystem/rename'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            oldPath: '/path/to/CLAUDE.md.inactive',
            newPath: '/path/to/CLAUDE.md'
          })
        })
      );
    });

    it('should throw error if file is already active', async () => {
      await expect(
        FileSystemService.activateFile('/path/to/CLAUDE.md')
      ).rejects.toThrow('File is already active');
    });

    it('should throw error if active version already exists', async () => {
      (fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/filesystem/file?')) {
          // Mock active file already exists
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ content: 'existing content' })
          });
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      await expect(
        FileSystemService.activateFile('/path/to/CLAUDE.md.inactive')
      ).rejects.toThrow('Cannot activate: active version already exists');
    });
  });

  describe('renameFile', () => {
    it('should call the rename API endpoint', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      await FileSystemService.renameFile('/old/path.md', '/new/path.md');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/filesystem/rename'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            oldPath: '/old/path.md',
            newPath: '/new/path.md'
          })
        })
      );
    });

    it('should throw error on API failure', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Rename failed' })
      });

      await expect(
        FileSystemService.renameFile('/old/path.md', '/new/path.md')
      ).rejects.toThrow('Failed to rename file: Rename failed');
    });
  });
});