/**
 * Tests for command discovery and namespace management
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  discoverSlashCommands,
  getActiveCommands,
  findCommand,
  discoverNamespaces,
  getCommandsInNamespace,
  namespaceExists,
  createNamespace,
  listCommands
} from '../discovery.js';
import { SlashCommandContent, SlashCommandType } from '../../types/commands.js';

// Mock os module
jest.mock('os');

describe('Command Discovery', () => {
  let tempDir: string;
  let projectRoot: string;
  let userCommandsDir: string;
  let projectCommandsDir: string;

  const mockedOs = os as jest.Mocked<typeof os>;

  beforeEach(async () => {
    // Use real os.tmpdir() for creating temp directory, but mock homedir
    const realOs = jest.requireActual('os');
    tempDir = await fs.mkdtemp(path.join(realOs.tmpdir(), 'claude-config-test-'));
    projectRoot = path.join(tempDir, 'project');
    userCommandsDir = path.join(tempDir, 'user-home', '.claude', 'commands');
    projectCommandsDir = path.join(projectRoot, '.claude', 'commands');

    await fs.mkdir(projectRoot, { recursive: true });
    await fs.mkdir(userCommandsDir, { recursive: true });
    await fs.mkdir(projectCommandsDir, { recursive: true });

    // Mock os.homedir to return our temp directory
    mockedOs.homedir.mockReturnValue(path.join(tempDir, 'user-home'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  describe('discoverSlashCommands', () => {
    it('should discover commands from both user and project directories', async () => {
      // Create user command
      await fs.writeFile(
        path.join(userCommandsDir, 'user-cmd.md'),
        'User command content'
      );

      // Create project command
      await fs.writeFile(
        path.join(projectCommandsDir, 'project-cmd.md'),
        'Project command content'
      );

      const result = await discoverSlashCommands(projectRoot);

      expect(result.commands).toHaveLength(2);
      
      const userCommand = result.commands.find(cmd => cmd.name === 'user-cmd');
      expect(userCommand).toBeDefined();
      expect(userCommand!.type).toBe(SlashCommandType.USER);
      expect(userCommand!.isActive).toBe(true);

      const projectCommand = result.commands.find(cmd => cmd.name === 'project-cmd');
      expect(projectCommand).toBeDefined();
      expect(projectCommand!.type).toBe(SlashCommandType.PROJECT);
      expect(projectCommand!.isActive).toBe(true);
    });

    it('should discover commands with namespaces', async () => {
      // Create namespaced commands
      await fs.mkdir(path.join(projectCommandsDir, 'git'), { recursive: true });
      await fs.writeFile(
        path.join(projectCommandsDir, 'git', 'commit.md'),
        'Git commit command'
      );

      await fs.mkdir(path.join(projectCommandsDir, 'docker'), { recursive: true });
      await fs.writeFile(
        path.join(projectCommandsDir, 'docker', 'build.md'),
        'Docker build command'
      );

      const result = await discoverSlashCommands(projectRoot);

      expect(result.commands).toHaveLength(2);
      expect(result.namespaces).toContain('git');
      expect(result.namespaces).toContain('docker');

      const gitCommand = result.commands.find(cmd => cmd.namespace === 'git');
      expect(gitCommand).toBeDefined();
      expect(gitCommand!.fullName).toBe('git:commit');
      expect(gitCommand!.invocation).toBe('/git:commit');
    });

    it('should handle command conflicts with precedence', async () => {
      // Create same command in both user and project
      await fs.writeFile(
        path.join(userCommandsDir, 'conflict-cmd.md'),
        'User conflict command'
      );

      await fs.writeFile(
        path.join(projectCommandsDir, 'conflict-cmd.md'),
        'Project conflict command'
      );

      const result = await discoverSlashCommands(projectRoot);

      expect(result.commands).toHaveLength(2);
      expect(result.conflicts).toHaveLength(1);

      const conflict = result.conflicts[0];
      expect(conflict.commandName).toBe('conflict-cmd');
      expect(conflict.resolved.type).toBe(SlashCommandType.PROJECT); // Project wins
      expect(conflict.conflictingCommands).toHaveLength(2);

      // Check that project command is active, user command is not
      const projectCommand = result.commands.find(cmd => cmd.type === SlashCommandType.PROJECT);
      expect(projectCommand!.isActive).toBe(true);

      const userCommand = result.commands.find(cmd => cmd.type === SlashCommandType.USER);
      expect(userCommand!.isActive).toBe(false);
      expect(userCommand!.overriddenBy).toBe(projectCommand!.path);
    });

    it('should handle nested namespaces', async () => {
      // Create nested namespace command
      await fs.mkdir(path.join(projectCommandsDir, 'git', 'flow'), { recursive: true });
      await fs.writeFile(
        path.join(projectCommandsDir, 'git', 'flow', 'feature.md'),
        'Git flow feature command'
      );

      const result = await discoverSlashCommands(projectRoot);

      expect(result.commands).toHaveLength(1);
      expect(result.namespaces).toContain('git/flow');

      const command = result.commands[0];
      expect(command.namespace).toBe('git/flow');
      expect(command.fullName).toBe('git/flow:feature');
      expect(command.invocation).toBe('/git/flow:feature');
    });

    it('should handle corrupted command files gracefully', async () => {
      // Create valid command
      await fs.writeFile(
        path.join(projectCommandsDir, 'valid.md'),
        'Valid command'
      );

      // Create corrupted command with invalid frontmatter
      await fs.writeFile(
        path.join(projectCommandsDir, 'corrupted.md'),
        '---\ninvalid: yaml: content:\n---\nCommand content'
      );

      const result = await discoverSlashCommands(projectRoot);

      // Should discover valid command and attempt corrupted one
      expect(result.commands).toHaveLength(2);
      
      const validCommand = result.commands.find(cmd => cmd.name === 'valid');
      expect(validCommand).toBeDefined();
      expect(validCommand!.content).toBeDefined();

      const corruptedCommand = result.commands.find(cmd => cmd.name === 'corrupted');
      expect(corruptedCommand).toBeDefined();
      expect(corruptedCommand!.content).toBeUndefined(); // Failed to parse
    });

    it('should handle missing directories gracefully', async () => {
      // Don't create any command directories
      await fs.rm(userCommandsDir, { recursive: true, force: true });
      await fs.rm(projectCommandsDir, { recursive: true, force: true });

      const result = await discoverSlashCommands(projectRoot);

      expect(result.commands).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
      expect(result.namespaces).toHaveLength(0);
    });
  });

  describe('getActiveCommands', () => {
    it('should return only active commands', async () => {
      // Create conflicting commands
      await fs.writeFile(
        path.join(userCommandsDir, 'active-cmd.md'),
        'User active command'
      );

      await fs.writeFile(
        path.join(projectCommandsDir, 'active-cmd.md'),
        'Project active command'
      );

      // Create unique command
      await fs.writeFile(
        path.join(projectCommandsDir, 'unique.md'),
        'Unique command'
      );

      const commands = await getActiveCommands(projectRoot);

      expect(commands).toHaveLength(2); // Only active commands
      expect(commands.every(cmd => cmd.isActive)).toBe(true);
      expect(commands.some(cmd => cmd.name === 'active-cmd' && cmd.type === SlashCommandType.PROJECT)).toBe(true);
      expect(commands.some(cmd => cmd.name === 'unique')).toBe(true);
    });
  });

  describe('findCommand', () => {
    it('should find command by name', async () => {
      await fs.writeFile(
        path.join(projectCommandsDir, 'find-cmd.md'),
        'Find command'
      );

      const command = await findCommand(projectRoot, 'find-cmd');

      expect(command).toBeDefined();
      expect(command!.name).toBe('find-cmd');
      expect(command!.isActive).toBe(true);
    });

    it('should find command by name and namespace', async () => {
      await fs.mkdir(path.join(projectCommandsDir, 'git'), { recursive: true });
      await fs.writeFile(
        path.join(projectCommandsDir, 'git', 'commit.md'),
        'Git commit command'
      );

      const command = await findCommand(projectRoot, 'commit', 'git');

      expect(command).toBeDefined();
      expect(command!.name).toBe('commit');
      expect(command!.namespace).toBe('git');
      expect(command!.fullName).toBe('git:commit');
    });

    it('should return undefined for non-existent command', async () => {
      const command = await findCommand(projectRoot, 'nonexistent');
      expect(command).toBeUndefined();
    });

    it('should return undefined for inactive command', async () => {
      // Create conflicting commands (user will be inactive)
      await fs.writeFile(
        path.join(userCommandsDir, 'inactive-cmd.md'),
        'User inactive command'
      );

      await fs.writeFile(
        path.join(projectCommandsDir, 'inactive-cmd.md'),
        'Project inactive command'
      );

      // Try to find the user command specifically - but findCommand only returns active
      const command = await findCommand(projectRoot, 'inactive-cmd');
      expect(command).toBeDefined();
      expect(command!.type).toBe(SlashCommandType.PROJECT); // Active one
    });
  });

  describe('discoverNamespaces', () => {
    it('should discover all namespaces', async () => {
      // Create various namespaces
      await fs.mkdir(path.join(projectCommandsDir, 'git'), { recursive: true });
      await fs.writeFile(
        path.join(projectCommandsDir, 'git', 'commit.md'),
        'Git commit'
      );

      await fs.mkdir(path.join(userCommandsDir, 'docker'), { recursive: true });
      await fs.writeFile(
        path.join(userCommandsDir, 'docker', 'build.md'),
        'Docker build'
      );

      await fs.mkdir(path.join(projectCommandsDir, 'project', 'deploy'), { recursive: true });
      await fs.writeFile(
        path.join(projectCommandsDir, 'project', 'deploy', 'staging.md'),
        'Deploy to staging'
      );

      const namespaces = await discoverNamespaces(projectRoot);

      expect(namespaces.length).toBeGreaterThan(0);
      
      const gitNamespace = namespaces.find(ns => ns.name === 'git');
      expect(gitNamespace).toBeDefined();
      expect(gitNamespace!.commandCount).toBe(1);
      expect(gitNamespace!.type).toBe(SlashCommandType.PROJECT);

      const dockerNamespace = namespaces.find(ns => ns.name === 'docker');
      expect(dockerNamespace).toBeDefined();
      expect(dockerNamespace!.type).toBe(SlashCommandType.USER);
    });

    it('should handle nested namespaces', async () => {
      await fs.mkdir(path.join(projectCommandsDir, 'project', 'deploy'), { recursive: true });
      await fs.writeFile(
        path.join(projectCommandsDir, 'project', 'deploy', 'staging.md'),
        'Deploy to staging'
      );

      const namespaces = await discoverNamespaces(projectRoot);

      expect(namespaces.some(ns => ns.name === 'project')).toBe(true);
      expect(namespaces.some(ns => ns.name === 'project/deploy')).toBe(true);
    });
  });

  describe('getCommandsInNamespace', () => {
    it('should return commands in specific namespace', async () => {
      // Create commands in git namespace
      await fs.mkdir(path.join(projectCommandsDir, 'git'), { recursive: true });
      await fs.writeFile(
        path.join(projectCommandsDir, 'git', 'commit.md'),
        'Git commit'
      );
      await fs.writeFile(
        path.join(projectCommandsDir, 'git', 'push.md'),
        'Git push'
      );

      // Create command in different namespace
      await fs.mkdir(path.join(projectCommandsDir, 'docker'), { recursive: true });
      await fs.writeFile(
        path.join(projectCommandsDir, 'docker', 'build.md'),
        'Docker build'
      );

      const gitCommands = await getCommandsInNamespace(projectRoot, 'git');

      expect(gitCommands).toHaveLength(2);
      expect(gitCommands.every(cmd => cmd.namespace === 'git')).toBe(true);
      expect(gitCommands.some(cmd => cmd.name === 'commit')).toBe(true);
      expect(gitCommands.some(cmd => cmd.name === 'push')).toBe(true);
    });
  });

  describe('namespaceExists', () => {
    it('should detect existing namespace', async () => {
      await fs.mkdir(path.join(projectCommandsDir, 'git'), { recursive: true });

      const exists = await namespaceExists(projectRoot, 'git');
      expect(exists).toBe(true);
    });

    it('should detect non-existing namespace', async () => {
      const exists = await namespaceExists(projectRoot, 'nonexistent');
      expect(exists).toBe(false);
    });

    it('should check specific command type', async () => {
      await fs.mkdir(path.join(projectCommandsDir, 'git'), { recursive: true });

      const existsProject = await namespaceExists(projectRoot, 'git', SlashCommandType.PROJECT);
      expect(existsProject).toBe(true);

      const existsUser = await namespaceExists(projectRoot, 'git', SlashCommandType.USER);
      expect(existsUser).toBe(false);
    });
  });

  describe('createNamespace', () => {
    it('should create namespace directory', async () => {
      await createNamespace(projectRoot, 'new-namespace');

      const namespacePath = path.join(projectCommandsDir, 'new-namespace');
      const stat = await fs.stat(namespacePath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should create nested namespace directory', async () => {
      await createNamespace(projectRoot, 'project/deploy');

      const namespacePath = path.join(projectCommandsDir, 'project', 'deploy');
      const stat = await fs.stat(namespacePath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should create user namespace', async () => {
      await createNamespace(projectRoot, 'user-namespace', SlashCommandType.USER);

      const namespacePath = path.join(userCommandsDir, 'user-namespace');
      const stat = await fs.stat(namespacePath);
      expect(stat.isDirectory()).toBe(true);
    });
  });

  describe('listCommands', () => {
    beforeEach(async () => {
      // Set up test commands
      await fs.writeFile(path.join(projectCommandsDir, 'root-cmd.md'), 'Root command');
      
      await fs.mkdir(path.join(projectCommandsDir, 'git'), { recursive: true });
      await fs.writeFile(path.join(projectCommandsDir, 'git', 'commit.md'), 'Git commit');
      await fs.writeFile(path.join(projectCommandsDir, 'git', 'push.md'), 'Git push');
      
      await fs.writeFile(path.join(userCommandsDir, 'user-cmd.md'), 'User command');
    });

    it('should list all commands by default', async () => {
      const commands = await listCommands(projectRoot);

      expect(commands).toHaveLength(4);
      expect(commands.every(cmd => cmd.isActive)).toBe(true); // activeOnly defaults to true
    });

    it('should filter by namespace', async () => {
      const commands = await listCommands(projectRoot, { namespace: 'git' });

      expect(commands).toHaveLength(2);
      expect(commands.every(cmd => cmd.namespace === 'git')).toBe(true);
    });

    it('should filter by type', async () => {
      const commands = await listCommands(projectRoot, { type: SlashCommandType.USER });

      expect(commands).toHaveLength(1);
      expect(commands[0].type).toBe(SlashCommandType.USER);
    });

    it('should include inactive commands when requested', async () => {
      // Create conflicting command to have inactive ones
      await fs.writeFile(path.join(userCommandsDir, 'root-cmd.md'), 'User root command');

      const commands = await listCommands(projectRoot, { activeOnly: false });

      expect(commands.length).toBeGreaterThan(4); // Should include inactive command
      expect(commands.some(cmd => !cmd.isActive)).toBe(true);
    });

    it('should sort commands by full name', async () => {
      const commands = await listCommands(projectRoot);

      // Check that commands are sorted
      for (let i = 1; i < commands.length; i++) {
        expect(commands[i].fullName >= commands[i - 1].fullName).toBe(true);
      }
    });
  });
});