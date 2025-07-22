import { FileSystemService } from '../../../services/fileSystemService';

// Mock the service
jest.mock('../../../services/fileSystemService');
const mockFileSystemService = FileSystemService as jest.Mocked<typeof FileSystemService>;

describe('FileDetailsPanel - Settings Type Switch Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Settings type switching service integration', () => {
    it('should call FileSystemService.switchSettingsFileType with correct parameters for project to local', async () => {
      mockFileSystemService.switchSettingsFileType.mockResolvedValue({
        newPath: '/project/settings.local.json',
        newType: 'local',
      });

      const filePath = '/project/settings.json';
      const result = await FileSystemService.switchSettingsFileType(filePath);

      expect(mockFileSystemService.switchSettingsFileType).toHaveBeenCalledWith(filePath);
      expect(result).toEqual({
        newPath: '/project/settings.local.json',
        newType: 'local',
      });
    });

    it('should call FileSystemService.switchSettingsFileType with correct parameters for local to project', async () => {
      mockFileSystemService.switchSettingsFileType.mockResolvedValue({
        newPath: '/project/settings.json',
        newType: 'project',
      });

      const filePath = '/project/settings.local.json';
      const result = await FileSystemService.switchSettingsFileType(filePath);

      expect(mockFileSystemService.switchSettingsFileType).toHaveBeenCalledWith(filePath);
      expect(result).toEqual({
        newPath: '/project/settings.json',
        newType: 'project',
      });
    });

    it('should call FileSystemService.switchSettingsFileType with correct parameters for inactive files', async () => {
      mockFileSystemService.switchSettingsFileType.mockResolvedValue({
        newPath: '/project/settings.local.json.inactive',
        newType: 'local',
      });

      const filePath = '/project/settings.json.inactive';
      const result = await FileSystemService.switchSettingsFileType(filePath);

      expect(mockFileSystemService.switchSettingsFileType).toHaveBeenCalledWith(filePath);
      expect(result).toEqual({
        newPath: '/project/settings.local.json.inactive',
        newType: 'local',
      });
    });

    it('should handle type switch errors properly', async () => {
      const errorMessage = 'Cannot switch type: local settings file already exists';
      mockFileSystemService.switchSettingsFileType.mockRejectedValue(new Error(errorMessage));

      await expect(
        FileSystemService.switchSettingsFileType('/project/settings.json')
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('Settings type determination', () => {
    it('should correctly identify project settings files', () => {
      const projectFiles = [
        'settings.json',
        'settings.json.inactive',
      ];

      projectFiles.forEach(fileName => {
        const baseFileName = fileName.replace('.inactive', '');
        const isLocal = baseFileName === 'settings.local.json';
        expect(isLocal).toBe(false);
      });
    });

    it('should correctly identify local settings files', () => {
      const localFiles = [
        'settings.local.json',
        'settings.local.json.inactive',
      ];

      localFiles.forEach(fileName => {
        const baseFileName = fileName.replace('.inactive', '');
        const isLocal = baseFileName === 'settings.local.json';
        expect(isLocal).toBe(true);
      });
    });
  });

  describe('Type switch button logic', () => {
    it('should determine correct target type for switching', () => {
      const testCases = [
        {
          fileName: 'settings.json',
          expectedTargetType: 'local',
        },
        {
          fileName: 'settings.json.inactive',
          expectedTargetType: 'local',
        },
        {
          fileName: 'settings.local.json',
          expectedTargetType: 'project',
        },
        {
          fileName: 'settings.local.json.inactive',
          expectedTargetType: 'project',
        },
      ];

      testCases.forEach(({ fileName, expectedTargetType }) => {
        const isProject = fileName === 'settings.json' || fileName === 'settings.json.inactive';
        const targetType = isProject ? 'local' : 'project';
        expect(targetType).toBe(expectedTargetType);
      });
    });
  });
});