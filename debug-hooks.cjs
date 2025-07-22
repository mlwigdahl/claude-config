const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function debugHooksIssue() {
  // Create a temp directory for testing
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-hooks-debug-'));
  const projectRoot = path.join(tempDir, 'project');
  const userClaudeDir = path.join(tempDir, 'user-home', '.claude');
  const projectClaudeDir = path.join(projectRoot, '.claude');

  await fs.mkdir(projectRoot, { recursive: true });
  await fs.mkdir(userClaudeDir, { recursive: true });
  await fs.mkdir(projectClaudeDir, { recursive: true });

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

  console.log('=== DEBUG INFO ===');
  console.log('Project root:', projectRoot);
  console.log('User settings path:', userSettingsPath);
  console.log('Project settings path:', projectSettingsPath);
  
  // Check if files exist
  console.log('User settings exists:', await fs.access(userSettingsPath).then(() => true).catch(() => false));
  console.log('Project settings exists:', await fs.access(projectSettingsPath).then(() => true).catch(() => false));

  // Read files directly
  const userContent = await fs.readFile(userSettingsPath, 'utf8');
  const projectContent = await fs.readFile(projectSettingsPath, 'utf8');
  
  console.log('User settings content:', userContent);
  console.log('Project settings content:', projectContent);
  
  // Parse JSON
  const userParsed = JSON.parse(userContent);
  const projectParsed = JSON.parse(projectContent);
  
  console.log('User parsed:', JSON.stringify(userParsed, null, 2));
  console.log('Project parsed:', JSON.stringify(projectParsed, null, 2));

  // Test extractHooksFromSettings manually
  function extractHooksFromSettings(settings) {
    console.log('Input to extractHooksFromSettings:', JSON.stringify(settings, null, 2));
    
    if (!settings.hooks) {
      console.log('No hooks property found');
      return {};
    }

    const hooks = {};
    for (const [eventType, eventHooks] of Object.entries(settings.hooks)) {
      console.log(`Processing event type: ${eventType}`);
      hooks[eventType] = {};
      for (const [toolPattern, hookDef] of Object.entries(eventHooks)) {
        console.log(`Processing tool pattern: ${toolPattern}, hookDef:`, hookDef);
        if (typeof hookDef === 'string') {
          hooks[eventType][toolPattern] = hookDef;
        } else {
          hooks[eventType][toolPattern] = {
            type: 'command',
            command: hookDef.command,
            timeout: hookDef.timeout,
          };
        }
      }
    }
    
    console.log('Extracted hooks:', JSON.stringify(hooks, null, 2));
    return hooks;
  }

  const userHooks = extractHooksFromSettings(userParsed);
  const projectHooks = extractHooksFromSettings(projectParsed);

  console.log('User extracted hooks:', JSON.stringify(userHooks, null, 2));
  console.log('Project extracted hooks:', JSON.stringify(projectHooks, null, 2));

  // Cleanup
  await fs.rm(tempDir, { recursive: true, force: true });
}

debugHooksIssue().catch(console.error);