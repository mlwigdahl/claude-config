// Mock implementation for @core/hooks/index.js

const extractHooksFromSettings = (settings) => {
  if (typeof settings === 'string') {
    try {
      settings = JSON.parse(settings);
    } catch {
      return [];
    }
  }
  
  if (settings && settings.hooks) {
    return Object.entries(settings.hooks).map(([name, command]) => ({
      name,
      command
    }));
  }
  
  return [];
};

const validateHook = (hook) => ({
  isValid: true,
  errors: []
});

const processHooks = (hooks) => ({
  processed: true,
  hooks
});

module.exports = {
  extractHooksFromSettings,
  validateHook,
  processHooks
};