import { FileSystemService } from '../../../services/fileSystemService';

// Mock the service
jest.mock('../../../services/fileSystemService');

const mockFileSystemService = FileSystemService as jest.Mocked<typeof FileSystemService>;

describe('FileDetailsPanel - Inactive File Service Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call FileSystemService.activateFile correctly', async () => {
    mockFileSystemService.activateFile.mockResolvedValue('/path/to/CLAUDE.md');

    const result = await FileSystemService.activateFile('/path/to/CLAUDE.md.inactive');
    
    expect(result).toBe('/path/to/CLAUDE.md');
    expect(mockFileSystemService.activateFile).toHaveBeenCalledWith('/path/to/CLAUDE.md.inactive');
  });

  it('should call FileSystemService.deactivateFile correctly', async () => {
    mockFileSystemService.deactivateFile.mockResolvedValue('/path/to/CLAUDE.md.inactive');

    const result = await FileSystemService.deactivateFile('/path/to/CLAUDE.md');
    
    expect(result).toBe('/path/to/CLAUDE.md.inactive');
    expect(mockFileSystemService.deactivateFile).toHaveBeenCalledWith('/path/to/CLAUDE.md');
  });

  it('should handle activation errors', async () => {
    const errorMessage = 'Cannot activate: active version already exists';
    mockFileSystemService.activateFile.mockRejectedValue(new Error(errorMessage));

    await expect(
      FileSystemService.activateFile('/path/to/CLAUDE.md.inactive')
    ).rejects.toThrow(errorMessage);
  });

  it('should handle deactivation errors', async () => {
    const errorMessage = 'Cannot deactivate: inactive version already exists';
    mockFileSystemService.deactivateFile.mockRejectedValue(new Error(errorMessage));

    await expect(
      FileSystemService.deactivateFile('/path/to/CLAUDE.md')
    ).rejects.toThrow(errorMessage);
  });
});