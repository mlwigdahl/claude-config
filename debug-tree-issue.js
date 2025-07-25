// Debug script for tree view issue
// Run this from the project root: node debug-tree-issue.js

const path = require('path');
const os = require('os');

console.log('=== Environment Info ===');
console.log('Current directory:', process.cwd());
console.log('Home directory:', os.homedir());
console.log('Platform:', process.platform);
console.log('Node version:', process.version);
console.log('Running as:', process.env.USERNAME || process.env.USER);
console.log('');

// Test path for the developer
const testPath = 'C:/TFS/SPCentral-PMS';
const fileName = 'CLAUDE.md';
const filePath = path.join(testPath, fileName);

console.log('=== Path Resolution ===');
console.log('Test path:', testPath);
console.log('Resolved:', path.resolve(testPath));
console.log('Normalized:', path.normalize(testPath));
console.log('Is absolute:', path.isAbsolute(testPath));
console.log('');

console.log('=== File Path Checks ===');
console.log('File path:', filePath);
console.log('Contains .claude:', filePath.includes('.claude'));
console.log('Path with forward slashes:', filePath.replace(/\\/g, '/'));
console.log('');

// Check what the server would do
console.log('=== Server Logic Simulation ===');
const homeDir = os.homedir();
const isHomeDirectory = path.resolve(testPath) === path.resolve(homeDir);
console.log('Is home directory:', isHomeDirectory);
console.log('Should use home context:', isHomeDirectory);

// Simulate isConfigurationFile logic
function checkConfigFile(fileName, filePath, isHomeContext) {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  // In home context, memory files must be in .claude directory
  if (isHomeContext && extension === 'md' && filePath) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const isInClaudeDir = normalizedPath.includes('/.claude/') || normalizedPath.includes('\\.claude\\');
    
    if (!isInClaudeDir) {
      return { type: null, valid: false, reason: 'In home context, .md files must be in .claude directory' };
    }
  }
  
  // CLAUDE.md is always valid
  if (fileName === 'CLAUDE.md') {
    return { type: 'memory', valid: true };
  }
  
  // Other .md files
  if (extension === 'md') {
    return { type: 'memory', valid: true };
  }
  
  return { type: null, valid: false };
}

console.log('');
console.log('Project context check:', checkConfigFile(fileName, filePath, false));
console.log('Home context check:', checkConfigFile(fileName, filePath, true));

// Test with actual file system
const fs = require('fs');
console.log('');
console.log('=== File System Check ===');
try {
  const exists = fs.existsSync(filePath);
  console.log('File exists:', exists);
  
  if (exists) {
    const stats = fs.statSync(filePath);
    console.log('Is file:', stats.isFile());
    console.log('Size:', stats.size);
    console.log('Modified:', stats.mtime);
  }
  
  // List .md files in directory
  const files = fs.readdirSync(testPath);
  const mdFiles = files.filter(f => f.endsWith('.md'));
  console.log('');
  console.log('MD files in directory:', mdFiles);
} catch (error) {
  console.log('Error accessing path:', error.message);
}

console.log('');
console.log('=== Debugging Steps ===');
console.log('1. Pull latest changes and rebuild: git pull && npm run build');
console.log('2. Start server and watch logs: npm run dev');
console.log('3. Open browser to: http://localhost:5001/api/filesystem/debug/tree-check?projectRoot=' + encodeURIComponent(testPath) + '&rootPath=' + encodeURIComponent(testPath));
console.log('4. Check server console for [TREE] log entries');
console.log('5. Try running without Administrator privileges');