#!/usr/bin/env node

/**
 * Debug script to replicate the failing hooks integration test
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the functions we need to test
import { 
  extractHooksFromSettings,
  mergeHooksConfigs,
} from './packages/core/src/hooks/utils.js';
import { discoverSettingsFiles } from './packages/core/src/settings/discovery.js';

async function debugHooksExtraction() {
  console.log('=== Debug Hooks Extraction Test ===\n');

  // Create temp directory structure
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'debug-hooks-'));
  const projectRoot = path.join(tempDir, 'project');
  const userClaudeDir = path.join(tempDir, 'user-home', '.claude');
  const projectClaudeDir = path.join(projectRoot, '.claude');

  await fs.mkdir(projectRoot, { recursive: true });
  await fs.mkdir(userClaudeDir, { recursive: true });
  await fs.mkdir(projectClaudeDir, { recursive: true });

  console.log('Created temp directories:');
  console.log('- Temp dir:', tempDir);
  console.log('- Project root:', projectRoot);
  console.log('- User claude dir:', userClaudeDir);
  console.log('- Project claude dir:', projectClaudeDir);
  console.log();

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
  console.log('Created user settings at:', userSettingsPath);
  console.log('User settings content:', JSON.stringify(userSettings, null, 2));
  console.log();

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
  console.log('Created project settings at:', projectSettingsPath);
  console.log('Project settings content:', JSON.stringify(projectSettings, null, 2));
  console.log();

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
  console.log('Created local settings at:', localSettingsPath);
  console.log('Local settings content:', JSON.stringify(localSettings, null, 2));
  console.log();

  // Step 1: Discover settings files
  console.log('=== Step 1: Discovering settings files ===');
  
  // Mock os.homedir for the discovery function
  const originalHomedir = os.homedir;
  os.homedir = () => path.join(tempDir, 'user-home');
  
  try {
    const settingsFiles = await discoverSettingsFiles(projectRoot);
    console.log(`Found ${settingsFiles.length} settings files:`);
    
    settingsFiles.forEach((file, index) => {
      console.log(`\n[${index}] ${file.type}:`);
      console.log('  Path:', file.path);
      console.log('  Exists:', file.exists);
      console.log('  Precedence:', file.precedence);
      console.log('  Is Active:', file.isActive);
      console.log('  Content:', file.content ? JSON.stringify(file.content, null, 2) : 'undefined');
    });

    // Step 2: Filter existing files with content
    console.log('\n=== Step 2: Filtering existing files ===');
    const existingFiles = settingsFiles.filter(f => f.exists && f.content);
    console.log(`Found ${existingFiles.length} existing files with content`);

    // Step 3: Extract hooks from each settings file
    console.log('\n=== Step 3: Extracting hooks from each file ===');
    const hooksConfigs = existingFiles.map(file => {
      console.log(`\nExtracting from ${file.type} (precedence: ${file.precedence}):`);
      console.log('Input content:', JSON.stringify(file.content, null, 2));
      
      const hooks = extractHooksFromSettings(file.content);
      console.log('Extracted hooks:', JSON.stringify(hooks, null, 2));
      
      return {
        hooks: hooks,
        precedence: file.precedence
      };
    });

    // Step 4: Merge hooks according to precedence
    console.log('\n=== Step 4: Merging hooks ===');
    console.log('Hook configs to merge:', JSON.stringify(hooksConfigs, null, 2));
    
    const mergedHooks = mergeHooksConfigs(hooksConfigs);
    console.log('\nMerged hooks result:', JSON.stringify(mergedHooks, null, 2));

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

    console.log('\n=== Comparison ===');
    console.log('Expected:', JSON.stringify(expectedHooks, null, 2));
    console.log('Actual:', JSON.stringify(mergedHooks, null, 2));
    console.log('Match:', JSON.stringify(mergedHooks) === JSON.stringify(expectedHooks));

  } finally {
    // Restore original homedir
    os.homedir = originalHomedir;
    
    // Cleanup
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log('\nCleaned up temp directory');
  }
}

// Run the debug script
debugHooksExtraction().catch(console.error);