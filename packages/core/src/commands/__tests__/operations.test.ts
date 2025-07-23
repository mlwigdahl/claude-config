/**
 * Tests for slash command operations
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  createSlashCommand,
  updateSlashCommand,
  moveSlashCommand,
  deleteSlashCommand
} from '../operations.js';
import { SlashCommandContent } from '../../types/commands.js';
import { ErrorCode } from '../../utils/error-handling.js';

describe('Slash Command Operations', () => {
  let tempDir: string;
  let projectRoot: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-config-test-'));
    projectRoot = path.join(tempDir, 'project');
    await fs.mkdir(projectRoot);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('createSlashCommand', () => {
    it('should create a simple command', async () => {
      const content = 'This is a test command.\n\nUse $ARGUMENTS for parameters.';
      
      const result = await createSlashCommand(projectRoot, 'example', content);
      
      expect(result.success).toBe(true);
      expect(result.commandPath).toBe(path.join(projectRoot, '.claude', 'commands', 'example.md'));
      expect(result.commandInfo?.name).toBe('example');
      expect(result.commandInfo?.fullName).toBe('example');
      expect(result.commandInfo?.invocation).toBe('/example');
      
      // Verify file was created
      const filePath = path.join(projectRoot, '.claude', 'commands', 'example.md');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
      
      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe(content + '\n');
    });

    it('should create a command with frontmatter', async () => {
      const content: SlashCommandContent = {
        frontmatter: {
          description: 'Test command',
          'allowed-tools': ['Read', 'Write']
        },
        content: 'Command content with $ARGUMENTS.',
        rawContent: ''
      };
      
      const result = await createSlashCommand(projectRoot, 'sample', content);
      
      expect(result.success).toBe(true);
      expect(result.commandInfo?.content?.frontmatter).toEqual(content.frontmatter);
    });

    it('should create a command with namespace', async () => {
      const content = 'Git commit command.';
      
      const result = await createSlashCommand(projectRoot, 'commit', content, 'git');
      
      expect(result.success).toBe(true);
      expect(result.commandPath).toBe(path.join(projectRoot, '.claude', 'commands', 'git', 'commit.md'));
      expect(result.commandInfo?.namespace).toBe('git');
      expect(result.commandInfo?.fullName).toBe('git:commit');
      expect(result.commandInfo?.invocation).toBe('/git:commit');
      
      // Verify namespace directory was created
      const namespaceDir = path.join(projectRoot, '.claude', 'commands', 'git');
      const dirExists = await fs.access(namespaceDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(true);
    });

    it('should reject invalid command names', async () => {
      const content = 'Test content';
      
      const result = await createSlashCommand(projectRoot, 'help', content);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_PATH);
    });

    it('should reject invalid command content', async () => {
      const content: SlashCommandContent = {
        frontmatter: {
          description: 123 // Invalid type
        } as any,
        content: 'Command content',
        rawContent: ''
      };
      
      const result = await createSlashCommand(projectRoot, 'invalid-cmd', content);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_COMMAND_SYNTAX);
    });

    it('should reject creating existing command without force', async () => {
      const content = 'Test command';
      
      // Create command first
      await createSlashCommand(projectRoot, 'duplicate-cmd', content);
      
      // Try to create again
      const result = await createSlashCommand(projectRoot, 'duplicate-cmd', content);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.FILE_ALREADY_EXISTS);
    });

    it('should overwrite existing command with force option', async () => {
      const originalContent = 'Original content';
      const newContent = 'New content';
      
      // Create command first
      await createSlashCommand(projectRoot, 'force-cmd', originalContent);
      
      // Overwrite with force
      const result = await createSlashCommand(projectRoot, 'force-cmd', newContent, undefined, { force: true });
      
      expect(result.success).toBe(true);
      
      // Verify content was updated
      const filePath = path.join(projectRoot, '.claude', 'commands', 'force-cmd.md');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe(newContent + '\n');
    });

    it('should perform dry run when requested', async () => {
      const content = 'Test command';
      
      const result = await createSlashCommand(projectRoot, 'dry-run-cmd', content, undefined, { dryRun: true });
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('[DRY RUN]');
      
      // Verify file was NOT created
      const filePath = path.join(projectRoot, '.claude', 'commands', 'dry-run-cmd.md');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });
  });

  describe('updateSlashCommand', () => {
    it('should update existing command content', async () => {
      const originalContent = 'Original command content';
      const updatedContent = 'Updated command content with $ARGUMENTS';
      
      // Create command first
      await createSlashCommand(projectRoot, 'update-cmd', originalContent);
      
      // Update command
      const result = await updateSlashCommand(projectRoot, 'update-cmd', updatedContent);
      
      expect(result.success).toBe(true);
      expect(result.commandInfo?.content?.content).toBe(updatedContent);
      
      // Verify file was updated
      const filePath = path.join(projectRoot, '.claude', 'commands', 'update-cmd.md');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toBe(updatedContent + '\n');
    });

    it('should update command frontmatter', async () => {
      const originalContent: SlashCommandContent = {
        frontmatter: { description: 'Original description' },
        content: 'Command content',
        rawContent: ''
      };
      const updates: Partial<SlashCommandContent> = {
        frontmatter: { 
          description: 'Updated description',
          'allowed-tools': ['Read']
        }
      };
      
      // Create command first
      await createSlashCommand(projectRoot, 'frontmatter-cmd', originalContent);
      
      // Update command
      const result = await updateSlashCommand(projectRoot, 'frontmatter-cmd', updates);
      
      expect(result.success).toBe(true);
      expect(result.commandInfo?.content?.frontmatter).toEqual(updates.frontmatter);
    });

    it('should reject updating non-existent command', async () => {
      const result = await updateSlashCommand(projectRoot, 'nonexistent', 'content');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('should create backup when requested', async () => {
      const originalContent = 'Original content';
      const updatedContent = 'Updated content';
      
      // Create command first
      await createSlashCommand(projectRoot, 'backup-cmd', originalContent);
      
      // Update with backup
      await updateSlashCommand(projectRoot, 'backup-cmd', updatedContent, undefined, { backup: true });
      
      // Check backup was created
      const commandsDir = path.join(projectRoot, '.claude', 'commands');
      const files = await fs.readdir(commandsDir);
      const backupFiles = files.filter(f => f.includes('backup-cmd.md.backup'));
      expect(backupFiles.length).toBe(1);
    });
  });

  describe('moveSlashCommand', () => {
    it('should move command to new name', async () => {
      const content = 'Test command content';
      
      // Create source command
      await createSlashCommand(projectRoot, 'old-name', content);
      
      // Move command
      const result = await moveSlashCommand(projectRoot, 'old-name', 'new-name');
      
      expect(result.success).toBe(true);
      expect(result.commandInfo?.name).toBe('new-name');
      
      // Verify source no longer exists
      const sourcePath = path.join(projectRoot, '.claude', 'commands', 'old-name.md');
      const sourceExists = await fs.access(sourcePath).then(() => true).catch(() => false);
      expect(sourceExists).toBe(false);
      
      // Verify target exists with correct content
      const targetPath = path.join(projectRoot, '.claude', 'commands', 'new-name.md');
      const targetExists = await fs.access(targetPath).then(() => true).catch(() => false);
      expect(targetExists).toBe(true);
      
      const targetContent = await fs.readFile(targetPath, 'utf-8');
      expect(targetContent).toBe(content + '\n');
    });

    it('should move command to different namespace', async () => {
      const content = 'Git command content';
      
      // Create source command
      await createSlashCommand(projectRoot, 'commit', content);
      
      // Move to namespace
      const result = await moveSlashCommand(projectRoot, 'commit', 'commit', undefined, 'git');
      
      expect(result.success).toBe(true);
      expect(result.commandInfo?.namespace).toBe('git');
      expect(result.commandInfo?.fullName).toBe('git:commit');
      expect(result.warnings).toContain('Command moved between namespaces - invocation path has changed');
      
      // Verify moved correctly
      const targetPath = path.join(projectRoot, '.claude', 'commands', 'git', 'commit.md');
      const targetExists = await fs.access(targetPath).then(() => true).catch(() => false);
      expect(targetExists).toBe(true);
    });

    it('should reject moving non-existent command', async () => {
      const result = await moveSlashCommand(projectRoot, 'nonexistent', 'target');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('should reject moving to existing target without force', async () => {
      const content1 = 'Command 1';
      const content2 = 'Command 2';
      
      // Create both commands
      await createSlashCommand(projectRoot, 'source', content1);
      await createSlashCommand(projectRoot, 'target', content2);
      
      // Try to move
      const result = await moveSlashCommand(projectRoot, 'source', 'target');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.FILE_ALREADY_EXISTS);
    });

    it('should clean up empty namespace directories', async () => {
      const content = 'Test command';
      
      // Create command in namespace
      await createSlashCommand(projectRoot, 'move-cmd', content, 'temp');
      
      // Move out of namespace
      const result = await moveSlashCommand(projectRoot, 'move-cmd', 'move-cmd', 'temp');
      
      expect(result.success).toBe(true);
      
      // Verify namespace directory was cleaned up
      const namespaceDir = path.join(projectRoot, '.claude', 'commands', 'temp');
      const dirExists = await fs.access(namespaceDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(false);
    });
  });

  describe('deleteSlashCommand', () => {
    it('should delete existing command', async () => {
      const content = 'Test command';
      
      // Create command
      await createSlashCommand(projectRoot, 'delete-cmd', content);
      
      // Delete command
      const result = await deleteSlashCommand(projectRoot, 'delete-cmd');
      
      expect(result.success).toBe(true);
      
      // Verify file was deleted
      const filePath = path.join(projectRoot, '.claude', 'commands', 'delete-cmd.md');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });

    it('should delete command in namespace', async () => {
      const content = 'Git commit command';
      
      // Create command in namespace
      await createSlashCommand(projectRoot, 'commit', content, 'git');
      
      // Delete command
      const result = await deleteSlashCommand(projectRoot, 'commit', 'git');
      
      expect(result.success).toBe(true);
      
      // Verify file was deleted
      const filePath = path.join(projectRoot, '.claude', 'commands', 'git', 'commit.md');
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(false);
    });

    it('should reject deleting non-existent command', async () => {
      const result = await deleteSlashCommand(projectRoot, 'nonexistent');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('should create backup when requested', async () => {
      const content = 'Test command';
      
      // Create command
      await createSlashCommand(projectRoot, 'backup-del-cmd', content);
      
      // Delete with backup
      const result = await deleteSlashCommand(projectRoot, 'backup-del-cmd', undefined, { backup: true });
      
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('Backup created'))).toBe(true);
      
      // Check backup was created
      const commandsDir = path.join(projectRoot, '.claude', 'commands');
      const files = await fs.readdir(commandsDir);
      const backupFiles = files.filter(f => f.includes('backup-del-cmd.md.backup'));
      expect(backupFiles.length).toBe(1);
    });

    it('should include warnings for commands with descriptions', async () => {
      const content: SlashCommandContent = {
        frontmatter: {
          description: 'Important command'
        },
        content: 'Command content',
        rawContent: ''
      };
      
      // Create command with description
      await createSlashCommand(projectRoot, 'important', content);
      
      // Delete command
      const result = await deleteSlashCommand(projectRoot, 'important');
      
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.includes('description'))).toBe(true);
    });

    it('should clean up empty namespace directories', async () => {
      const content = 'Test command';
      
      // Create command in namespace
      await createSlashCommand(projectRoot, 'cleanup-cmd', content, 'temp');
      
      // Delete command
      const result = await deleteSlashCommand(projectRoot, 'cleanup-cmd', 'temp');
      
      expect(result.success).toBe(true);
      
      // Verify namespace directory was cleaned up
      const namespaceDir = path.join(projectRoot, '.claude', 'commands', 'temp');
      const dirExists = await fs.access(namespaceDir).then(() => true).catch(() => false);
      expect(dirExists).toBe(false);
    });
  });
});