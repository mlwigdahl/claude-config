import { FileSystemService } from '../fileSystemService';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('FileSystemService - Settings Type Switching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('switchSettingsFileType', () => {
    it('should make correct API call and return result', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          success: true,
          message: 'Settings file type switched successfully',
          data: {
            newPath: '/project/settings.local.json',
            newType: 'local',
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await FileSystemService.switchSettingsFileType('/project/settings.json');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5001/api/filesystem/switch-settings-type',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filePath: '/project/settings.json' }),
        }
      );

      expect(result).toEqual({
        newPath: '/project/settings.local.json',
        newType: 'local',
      });
    });

    it('should handle API errors correctly', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({
          message: 'Cannot switch type: local settings file already exists',
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        FileSystemService.switchSettingsFileType('/project/settings.json')
      ).rejects.toThrow('Cannot switch type: local settings file already exists');
    });

    it('should handle network errors correctly', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        FileSystemService.switchSettingsFileType('/project/settings.json')
      ).rejects.toThrow('Failed to switch settings file type: Network error');
    });

    it('should handle responses without error message', async () => {
      const mockResponse = {
        ok: false,
        json: async () => ({}),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await expect(
        FileSystemService.switchSettingsFileType('/project/settings.json')
      ).rejects.toThrow('Failed to switch settings file type');
    });
  });
});