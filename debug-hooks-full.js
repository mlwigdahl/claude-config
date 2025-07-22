#!/usr/bin/env node

/**
 * Full debug script simulating the test environment more closely
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

// Simulate readJsonFile behavior
async function readJsonFile(filePath) {
  console.log(`Reading JSON file: ${filePath}`);
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Handle empty files
    if (!content.trim()) {
      console.log('File is empty, returning empty object');
      return {};
    }
    
    try {
      const parsed = JSON.parse(content);
      console.log('JSON parsed successfully:', JSON.stringify(parsed, null, 2));
      return parsed;
    } catch (parseError) {
      console.error(`JSON parse error: ${parseError.message}`);
      throw new Error(`Failed to parse JSON: ${parseError.message}`);
    }
  } catch (error) {
    console.error(`Failed to read file: ${error.message}`);
    throw error;
  }
}

// Simulate extractHooksFromSettings
function extractHooksFromSettings(settings) {
  console.log('\n--- extractHooksFromSettings called ---');
  console.log('Input type:', typeof settings);
  console.log('Input settings:', JSON.stringify(settings, null, 2));
  
  if (!settings || !settings.hooks) {
    console.log('No hooks found in settings, returning empty object');
    return {};
  }

  const hooks = {};

  for (const [eventType, eventHooks] of Object.entries(settings.hooks)) {
    console.log(`Processing event type: ${eventType}`);
    hooks[eventType] = {};
    
    for (const [toolPattern, hookDef] of Object.entries(eventHooks)) {
      console.log(`  Processing tool pattern: ${toolPattern}`);
      console.log(`  Hook definition:`, hookDef);
      
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

  console.log('Final extracted hooks:', JSON.stringify(hooks, null, 2));
  return hooks;
}

// Simulate mergeHooksConfigs
function mergeHooksConfigs(configs) {
  console.log('\n--- mergeHooksConfigs called ---');
  console.log('Configs to merge:', JSON.stringify(configs, null, 2));
  
  // Sort by precedence (lower number = lower precedence, higher number = higher precedence)
  const sorted = configs.sort((a, b) => a.precedence - b.precedence);
  console.log('Sorted by precedence:', sorted.map(c => `precedence ${c.precedence}`).join(', '));

  const merged = {};

  // Merge in precedence order (lower precedence first, higher precedence overwrites)
  for (const { hooks } of sorted) {
    console.log('Merging hooks:', JSON.stringify(hooks, null, 2));
    
    for (const [eventType, eventHooks] of Object.entries(hooks)) {
      if (!merged[eventType]) {
        merged[eventType] = {};
      }

      // Higher precedence hooks override lower precedence ones
      for (const [toolPattern, hookDef] of Object.entries(eventHooks)) {
        merged[eventType][toolPattern] = hookDef;
      }
    }
  }

  console.log('Final merged result:', JSON.stringify(merged, null, 2));
  return merged;
}

// Full test simulation
async function debugFullTest() {
  console.log('=== Full Test Simulation ===\n');

  // Create temp directory structure
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'debug-hooks-full-'));
  const projectRoot = path.join(tempDir, 'project');
  const userClaudeDir = path.join(tempDir, 'user-home', '.claude');
  const projectClaudeDir = path.join(projectRoot, '.claude');

  await fs.mkdir(projectRoot, { recursive: true });
  await fs.mkdir(userClaudeDir, { recursive: true });
  await fs.mkdir(projectClaudeDir, { recursive: true });

  console.log('Created temp directories');

  try {
    // Create user settings
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
    console.log('\nCreated user settings');

    // Create project settings
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
    console.log('Created project settings');

    // Create local settings
    const localSettings = {
      hooks: {
        'PreToolUse': {
          'Write': { type: 'command', command: 'echo "local: before write"' }
        }
      }
    };
    
    const localSettingsPath = path.join(projectClaudeDir, 'settings.local.json');
    await fs.writeFile(localSettingsPath, JSON.stringify(localSettings, null, 2));
    console.log('Created local settings');

    // Simulate discoverSettingsFiles
    console.log('\n=== Simulating discoverSettingsFiles ===');
    
    // Read each file
    console.log('\n1. Reading user settings:');
    const userContent = await readJsonFile(userSettingsPath);
    
    console.log('\n2. Reading project settings:');
    const projectContent = await readJsonFile(projectSettingsPath);
    
    console.log('\n3. Reading local settings:');
    const localContent = await readJsonFile(localSettingsPath);

    // Simulate file info objects
    const settingsFiles = [
      {
        type: 'USER',
        path: userSettingsPath,
        content: userContent,
        precedence: 1,
        exists: true,
        isActive: true
      },
      {
        type: 'PROJECT_SHARED',
        path: projectSettingsPath,
        content: projectContent,
        precedence: 2,
        exists: true,
        isActive: true
      },
      {
        type: 'PROJECT_LOCAL',
        path: localSettingsPath,
        content: localContent,
        precedence: 3,
        exists: true,
        isActive: true
      }
    ];

    // Filter existing files with content
    console.log('\n=== Filtering existing files ===');
    const existingFiles = settingsFiles.filter(f => f.exists && f.content);
    console.log(`Found ${existingFiles.length} existing files with content`);

    // Check if content is actually there
    existingFiles.forEach((file, index) => {
      console.log(`\nFile ${index} (${file.type}):`);
      console.log('  Has content?', !!file.content);
      console.log('  Content type:', typeof file.content);
      console.log('  Content keys:', file.content ? Object.keys(file.content) : 'N/A');
      console.log('  Has hooks?', file.content && file.content.hooks ? 'Yes' : 'No');
    });

    // Extract hooks from each settings file
    console.log('\n=== Extracting hooks from each file ===');
    const hooksConfigs = existingFiles.map(file => {
      console.log(`\nExtracting from ${file.type} (precedence: ${file.precedence}):`);
      
      const hooks = extractHooksFromSettings(file.content);
      
      return {
        hooks: hooks,
        precedence: file.precedence
      };
    });

    // Check what we got
    console.log('\n=== Checking extracted hooks ===');
    hooksConfigs.forEach((config, index) => {
      console.log(`\nConfig ${index} (precedence ${config.precedence}):`);
      console.log('  Empty?', Object.keys(config.hooks).length === 0);
      console.log('  Hooks:', JSON.stringify(config.hooks, null, 2));
    });

    // Merge hooks
    console.log('\n=== Merging hooks ===');
    const mergedHooks = mergeHooksConfigs(hooksConfigs);

    // Expected result
    const expectedHooks = {
      'PreToolUse': {
        'Bash': { type: 'command', command: 'echo "project: before bash"' },
        'Read': { type: 'command', command: 'echo "user: before read"' },
        'Write': { type: 'command', command: 'echo "local: before write"' }
      },
      'PostToolUse': {
        'Edit': { type: 'command', command: 'echo "project: after edit"' }
      }
    };

    console.log('\n=== Final Comparison ===');
    console.log('Expected:', JSON.stringify(expectedHooks, null, 2));
    console.log('Actual:', JSON.stringify(mergedHooks, null, 2));
    console.log('Match:', JSON.stringify(mergedHooks) === JSON.stringify(expectedHooks));

    // Additional debugging
    console.log('\n=== Additional Debugging ===');
    console.log('Merged hooks is empty?', Object.keys(mergedHooks).length === 0);
    
    if (Object.keys(mergedHooks).length === 0) {
      console.log('\nDEBUG: Merged hooks is empty. Let\'s trace why:');
      
      // Check if files were read correctly
      console.log('\n1. Were files read correctly?');
      console.log('   User content empty?', Object.keys(userContent).length === 0);
      console.log('   Project content empty?', Object.keys(projectContent).length === 0);
      console.log('   Local content empty?', Object.keys(localContent).length === 0);
      
      // Check if hooks were extracted
      console.log('\n2. Were hooks extracted?');
      hooksConfigs.forEach((config, i) => {
        console.log(`   Config ${i} hooks empty?`, Object.keys(config.hooks).length === 0);
      });
      
      // Re-read a file to double-check
      console.log('\n3. Re-reading user file to double-check:');
      const doubleCheck = await fs.readFile(userSettingsPath, 'utf8');
      console.log('   Raw content:', doubleCheck);
      console.log('   Parsed:', JSON.parse(doubleCheck));
    }

  } finally {
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log('\nCleaned up temp directory');
  }
}

// Run the debug
debugFullTest().catch(console.error);