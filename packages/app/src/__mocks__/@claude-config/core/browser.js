// Mock implementation for @claude-config/core/browser

export const createClientConfigurationService = jest.fn(() => ({
  setupProject: jest.fn(),
  readFileContent: jest.fn(),
  writeFileContent: jest.fn(),
  createFile: jest.fn(),
  deleteFile: jest.fn(),
  getProjectFiles: jest.fn(),
  validateFile: jest.fn(),
}));

export const ClientConfigurationService = jest.fn();

export const TemplateFactory = {
  createMemoryTemplate: jest.fn(() => ({
    content: '# Memory File\n\nContent here.',
    path: 'CLAUDE.md'
  })),
  createSettingsTemplate: jest.fn(() => ({
    content: '{\n  "version": "1.0",\n  "settings": {}\n}',
    path: 'settings.json'
  })),
  createCommandTemplate: jest.fn(() => ({
    content: '# Command File\n\n```bash\necho "hello"\n```',
    path: 'commands.md'
  }))
};

export const createMemoryTemplate = TemplateFactory.createMemoryTemplate;
export const createSettingsTemplate = TemplateFactory.createSettingsTemplate;
export const createCommandTemplate = TemplateFactory.createCommandTemplate;

export const Logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

export const getLogger = jest.fn(() => Logger);

export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};