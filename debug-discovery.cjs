const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock os.homedir to match the test
const originalHomedir = os.homedir;

async function debugDiscoveryIssue() {
  // Create a temp directory for testing
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-hooks-debug-'));
  const projectRoot = path.join(tempDir, 'project');
  const userClaudeDir = path.join(tempDir, 'user-home', '.claude');
  const projectClaudeDir = path.join(projectRoot, '.claude');

  await fs.mkdir(projectRoot, { recursive: true });
  await fs.mkdir(userClaudeDir, { recursive: true });
  await fs.mkdir(projectClaudeDir, { recursive: true });

  // Mock os.homedir to return our temp directory
  os.homedir = () => path.join(tempDir, 'user-home');

  // Create user settings with hooks
  const userSettings = {
    hooks: {
      'PreToolUse': {
        'Bash': { type: 'command', command: 'echo "user: before bash"' },
        'Read': { type: 'command', command: 'echo "user: before read"' }
      }
    }
  };
  
  const userSettingsPath = path.join(userClaudeDir, 'settings.json');
  await fs.writeFile(userSettingsPath, JSON.stringify(userSettings, null, 2));

  // Create project settings with hooks
  const projectSettings = {
    hooks: {
      'PreToolUse': {
        'Bash': { type: 'command', command: 'echo "project: before bash"' },
        'Write': { type: 'command', command: 'echo "project: before write"' }
      },
      'PostToolUse': {
        'Edit': { type: 'command', command: 'echo "project: after edit"' }
      }
    }
  };
  
  const projectSettingsPath = path.join(projectClaudeDir, 'settings.json');
  await fs.writeFile(projectSettingsPath, JSON.stringify(projectSettings, null, 2));

  // Create local settings with hooks
  const localSettings = {
    hooks: {
      'PreToolUse': {
        'Write': { type: 'command', command: 'echo "local: before write"' }
      }
    }
  };
  
  const localSettingsPath = path.join(projectClaudeDir, 'settings.local.json');
  await fs.writeFile(localSettingsPath, JSON.stringify(localSettings, null, 2));

  console.log('=== DEBUG DISCOVERY ===');
  console.log('Project root:', projectRoot);
  console.log('Mocked homedir:', os.homedir());
  console.log('User settings path:', userSettingsPath);
  console.log('Project settings path:', projectSettingsPath);
  console.log('Local settings path:', localSettingsPath);

  // Now try to simulate the discoverSettingsFiles function
  console.log('\n=== TESTING SETTINGS DISCOVERY ===');
  
  // Simple version of getStandardSettingsPaths
  const SETTINGS_DIR = '.claude';
  const homeDir = os.homedir();
  
  const settingsPaths = {
    'USER': path.join(homeDir, SETTINGS_DIR, 'settings.json'),
    'PROJECT_SHARED': path.join(projectRoot, SETTINGS_DIR, 'settings.json'),
    'PROJECT_LOCAL': path.join(projectRoot, SETTINGS_DIR, 'settings.local.json'),
    'COMMAND_LINE': '<command-line>',
    'ENTERPRISE': '/etc/claude/settings.json'
  };

  console.log('Expected paths:', settingsPaths);

  // Check each file
  for (const [type, filePath] of Object.entries(settingsPaths)) {
    if (type === 'COMMAND_LINE' || type === 'ENTERPRISE') {
      console.log(`${type}: skipping (special case)`);
      continue;
    }
    
    try {
      await fs.access(filePath);
      console.log(`${type}: exists at ${filePath}`);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(content);
        console.log(`${type}: content loaded successfully`);
        console.log(`${type}: has hooks:`, !!parsed.hooks);
        if (parsed.hooks) {
          console.log(`${type}: hooks:`, Object.keys(parsed.hooks));
        }
      } catch (error) {
        console.log(`${type}: failed to read content:`, error.message);
      }
    } catch {
      console.log(`${type}: does not exist at ${filePath}`);
    }
  }

  // Restore original homedir
  os.homedir = originalHomedir;

  // Cleanup
  await fs.rm(tempDir, { recursive: true, force: true });
}

debugDiscoveryIssue().catch(console.error);