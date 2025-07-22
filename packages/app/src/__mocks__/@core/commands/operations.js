// Mock implementation for @core/commands/operations.js

const createEmptyCommandFile = () => ({
  content: '# Command File\n\n```bash\necho "hello"\n```',
  path: 'command.md'
});

const validateCommandFile = (file) => ({
  isValid: true,
  errors: []
});

const parseCommandFile = (content) => ({
  commands: [],
  metadata: {},
  content
});

const processCommandFile = (file) => ({
  processed: true,
  content: file.content
});

module.exports = {
  createEmptyCommandFile,
  validateCommandFile,
  parseCommandFile,
  processCommandFile
};