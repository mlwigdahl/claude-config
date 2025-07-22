import { FileSystemService } from '../fileSystemService';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('FileSystemService - Default Directory Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDefaultDirectory', () => {
    it('should fetch and return default directory info for Windows', async () => {
      const mockResponse = {
        success: true,
        data: {
          defaultDirectory: 'C:\\Users\\testuser\\Documents',
          homeDirectory: 'C:\\Users\\testuser',
          platform: 'win32',
          drives: ['C:', 'D:'],
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await FileSystemService.getDefaultDirectory();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:5001/api/filesystem/default-directory');
      expect(result).toEqual(mockResponse.data);
    });

    it('should fetch and return default directory info for macOS', async () => {
      const mockResponse = {
        success: true,
        data: {
          defaultDirectory: '/Users/testuser/Documents',
          homeDirectory: '/Users/testuser',
          platform: 'darwin',
          drives: undefined,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await FileSystemService.getDefaultDirectory();

      expect(mockFetch).toHaveBeenCalledWith('http://localhost:5001/api/filesystem/default-directory');
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle HTTP error responses', async () => {
      const mockErrorResponse = {
        message: 'Server error',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue(mockErrorResponse),
      });

      await expect(FileSystemService.getDefaultDirectory()).rejects.toThrow(
        'Failed to get default directory: Server error'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(FileSystemService.getDefaultDirectory()).rejects.toThrow(
        'Failed to get default directory: Network error'
      );
    });

    it('should handle malformed response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(FileSystemService.getDefaultDirectory()).rejects.toThrow(
        'Failed to get default directory: Failed to get default directory'
      );
    });
  });
});