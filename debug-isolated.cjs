const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// This simulates the exact test scenario
async function testIsolatedIssue() {
  // Create a temp directory for testing
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-hooks-debug-'));
  const projectRoot = path.join(tempDir, 'project');
  const userClaudeDir = path.join(tempDir, 'user-home', '.claude');
  const projectClaudeDir = path.join(projectRoot, '.claude');

  await fs.mkdir(projectRoot, { recursive: true });
  await fs.mkdir(userClaudeDir, { recursive: true });
  await fs.mkdir(projectClaudeDir, { recursive: true });

  // Create test settings with hooks
  const testSettings = {
    hooks: {
      'PreToolUse': {
        'Bash': { type: 'command', command: 'echo "test: before bash"' },
      }
    }
  };
  
  const settingsPath = path.join(projectClaudeDir, 'settings.json');
  
  // Write the file and ensure it's flushed
  await fs.writeFile(settingsPath, JSON.stringify(testSettings, null, 2));
  console.log('File written');
  
  // Add delay to ensure write is complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Read with Node.js fs
  const rawContent = await fs.readFile(settingsPath, 'utf8');
  console.log('Raw content with Node.js fs:', rawContent);
  console.log('Raw content length:', rawContent.length);
  
  // Parse the JSON to confirm it's valid
  const parsed = JSON.parse(rawContent);
  console.log('Parsed content:', JSON.stringify(parsed, null, 2));
  
  // Now test the ConsolidatedFileSystem (simulate what the real code does)
  // We need to import from the actual codebase
  const { ConsolidatedFileSystem } = require('./packages/core/dist/utils/consolidated-filesystem.js');
  
  try {
    const consolidatedContent = await ConsolidatedFileSystem.readFile(settingsPath);
    console.log('ConsolidatedFileSystem content:', consolidatedContent);
    console.log('ConsolidatedFileSystem content length:', consolidatedContent.length);
    console.log('ConsolidatedFileSystem content equals raw:', consolidatedContent === rawContent);
  } catch (error) {
    console.log('ConsolidatedFileSystem error:', error.message);
  }

  // Test readJsonFile
  try {
    const { readJsonFile } = require('./packages/core/dist/utils/json-file.js');
    const jsonContent = await readJsonFile(settingsPath);
    console.log('readJsonFile result:', JSON.stringify(jsonContent, null, 2));
  } catch (error) {
    console.log('readJsonFile error:', error.message);
  }

  // Cleanup
  await fs.rm(tempDir, { recursive: true, force: true });
}

testIsolatedIssue().catch(console.error);