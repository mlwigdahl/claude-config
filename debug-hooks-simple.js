#!/usr/bin/env node

/**
 * Simple debug script to test hook extraction logic without dependencies
 */

// Simplified hook extraction logic based on the source code
function extractHooksFromSettings(settings) {
  console.log('\n--- extractHooksFromSettings called ---');
  console.log('Input settings:', JSON.stringify(settings, null, 2));
  
  if (!settings.hooks) {
    console.log('No hooks found in settings, returning empty object');
    return {};
  }

  // Convert from settings format to simplified format
  const hooks = {};

  for (const [eventType, eventHooks] of Object.entries(settings.hooks)) {
    console.log(`\nProcessing event type: ${eventType}`);
    hooks[eventType] = {};
    
    for (const [toolPattern, hookDef] of Object.entries(eventHooks)) {
      console.log(`  Processing tool pattern: ${toolPattern}`);
      console.log(`  Hook definition:`, hookDef);
      
      // Convert from settings HookDefinition to SimpleHookDefinition
      if (typeof hookDef === 'string') {
        hooks[eventType][toolPattern] = hookDef;
      } else {
        hooks[eventType][toolPattern] = {
          type: 'command',
          command: hookDef.command,
          timeout: hookDef.timeout,
        };
      }
      console.log(`  Converted to:`, hooks[eventType][toolPattern]);
    }
  }

  console.log('\nFinal extracted hooks:', JSON.stringify(hooks, null, 2));
  return hooks;
}

// Test with the same data as the failing test
function testHookExtraction() {
  console.log('=== Testing Hook Extraction ===\n');

  // Test 1: User settings
  console.log('TEST 1: User Settings');
  const userSettings = {
    hooks: {
      'PreToolUse': {
        'Bash': { type: 'command', command: 'echo "user: before bash"' },
        'Read': { type: 'command', command: 'echo "user: before read"' }
      }
    }
  };
  const userHooks = extractHooksFromSettings(userSettings);

  // Test 2: Project settings
  console.log('\n\nTEST 2: Project Settings');
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
  const projectHooks = extractHooksFromSettings(projectSettings);

  // Test 3: Local settings
  console.log('\n\nTEST 3: Local Settings');
  const localSettings = {
    hooks: {
      'PreToolUse': {
        'Write': { type: 'command', command: 'echo "local: before write"' }
      }
    }
  };
  const localHooks = extractHooksFromSettings(localSettings);

  // Test 4: Settings without hooks
  console.log('\n\nTEST 4: Settings Without Hooks');
  const emptySettings = {
    model: 'claude-3-opus'
  };
  const emptyHooks = extractHooksFromSettings(emptySettings);

  // Test 5: What happens with file content from discovery
  console.log('\n\nTEST 5: File Content Simulation');
  // Simulate what discoverSettingsFiles might return
  const fileContent = JSON.parse(JSON.stringify(userSettings)); // Deep copy
  console.log('File content type:', typeof fileContent);
  console.log('File content:', JSON.stringify(fileContent, null, 2));
  const fileHooks = extractHooksFromSettings(fileContent);

  // Summary
  console.log('\n\n=== SUMMARY ===');
  console.log('User hooks empty?', Object.keys(userHooks).length === 0);
  console.log('Project hooks empty?', Object.keys(projectHooks).length === 0);
  console.log('Local hooks empty?', Object.keys(localHooks).length === 0);
  console.log('Empty settings hooks empty?', Object.keys(emptyHooks).length === 0);
  console.log('File content hooks empty?', Object.keys(fileHooks).length === 0);
}

// Run the test
testHookExtraction();