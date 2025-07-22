describe('SettingsFileDetails - Type Indicator Logic', () => {
  describe('Type indicator determination', () => {
    it('should correctly identify project settings files', () => {
      const projectFiles = [
        'settings.json',
        'settings.json.inactive',
      ];

      projectFiles.forEach(fileName => {
        const baseFileName = fileName.replace('.inactive', '');
        const isLocal = baseFileName === 'settings.local.json';
        const typeIndicator = isLocal ? '(local)' : '(project)';
        
        expect(typeIndicator).toBe('(project)');
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
        const typeIndicator = isLocal ? '(local)' : '(project)';
        
        expect(typeIndicator).toBe('(local)');
      });
    });

    it('should handle edge cases correctly', () => {
      const testCases = [
        { fileName: 'settings.json', expectedType: '(project)' },
        { fileName: 'settings.local.json', expectedType: '(local)' },
        { fileName: 'settings.json.inactive', expectedType: '(project)' },
        { fileName: 'settings.local.json.inactive', expectedType: '(local)' },
      ];

      testCases.forEach(({ fileName, expectedType }) => {
        const baseFileName = fileName.replace('.inactive', '');
        const isLocal = baseFileName === 'settings.local.json';
        const typeIndicator = isLocal ? '(local)' : '(project)';
        
        expect(typeIndicator).toBe(expectedType);
      });
    });
  });

  describe('Settings file type switching logic', () => {
    it('should determine correct new type when switching', () => {
      const testCases = [
        { fileName: 'settings.json', expectedNewType: 'local' },
        { fileName: 'settings.json.inactive', expectedNewType: 'local' },
        { fileName: 'settings.local.json', expectedNewType: 'project' },
        { fileName: 'settings.local.json.inactive', expectedNewType: 'project' },
      ];

      testCases.forEach(({ fileName, expectedNewType }) => {
        const isInactive = fileName.endsWith('.inactive');
        const baseFileName = isInactive ? fileName.replace('.inactive', '') : fileName;
        const isCurrentlyLocal = baseFileName === 'settings.local.json';
        
        const newType = isCurrentlyLocal ? 'project' : 'local';
        
        expect(newType).toBe(expectedNewType);
      });
    });

    it('should construct correct new file names when switching', () => {
      const testCases = [
        { 
          fileName: 'settings.json', 
          expectedNewName: 'settings.local.json',
          expectedNewType: 'local'
        },
        { 
          fileName: 'settings.json.inactive', 
          expectedNewName: 'settings.local.json.inactive',
          expectedNewType: 'local'
        },
        { 
          fileName: 'settings.local.json', 
          expectedNewName: 'settings.json',
          expectedNewType: 'project'
        },
        { 
          fileName: 'settings.local.json.inactive', 
          expectedNewName: 'settings.json.inactive',
          expectedNewType: 'project'
        },
      ];

      testCases.forEach(({ fileName, expectedNewName, expectedNewType }) => {
        const isInactive = fileName.endsWith('.inactive');
        const baseFileName = isInactive ? fileName.replace('.inactive', '') : fileName;
        const isCurrentlyLocal = baseFileName === 'settings.local.json';
        
        let newFileName: string;
        let newType: 'project' | 'local';
        
        if (isCurrentlyLocal) {
          // Switch from local to project
          newFileName = isInactive ? 'settings.json.inactive' : 'settings.json';
          newType = 'project';
        } else {
          // Switch from project to local
          newFileName = isInactive ? 'settings.local.json.inactive' : 'settings.local.json';
          newType = 'local';
        }
        
        expect(newFileName).toBe(expectedNewName);
        expect(newType).toBe(expectedNewType);
      });
    });
  });
});