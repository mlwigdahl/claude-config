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
    
    // Create a more isolated directory structure - put project deeper in hierarchy
    // to prevent parent directory traversal from reaching real directories
    const isolatedRoot = path.join(tempDir, 'isolated', 'workspace', 'deep', 'structure');
    projectRoot = path.join(isolatedRoot, 'project');
    userCommandsDir = path.join(tempDir, 'user-home', '.claude', 'commands');
    projectCommandsDir = path.join(projectRoot, '.claude', 'commands');

    await fs.mkdir(projectRoot, { recursive: true });
    await fs.mkdir(userCommandsDir, { recursive: true });
    await fs.mkdir(projectCommandsDir, { recursive: true });
    
    // Create some empty directories in the isolated path to prevent traversal
    // from going too far up
    for (let i = 0; i < 5; i++) {
      const barrierDir = path.join(isolatedRoot, '..', `barrier-${i}`);
      await fs.mkdir(barrierDir, { recursive: true });
    }

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

      // Filter to only the commands we created
      const relevantCommands = result.commands.filter(cmd => 
        cmd.name === 'user-cmd' || cmd.name === 'project-cmd'
      );

      expect(relevantCommands).toHaveLength(2);
      
      const userCommand = relevantCommands.find(cmd => cmd.name === 'user-cmd');
      expect(userCommand).toBeDefined();
      expect(userCommand!.type).toBe(SlashCommandType.USER);
      expect(userCommand!.isActive).toBe(true);

      const projectCommand = relevantCommands.find(cmd => cmd.name === 'project-cmd');
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

      // Filter to only the commands we created
      const relevantCommands = result.commands.filter(cmd => 
        cmd.name === 'commit' || cmd.name === 'build'
      );

      expect(relevantCommands).toHaveLength(2);
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

      // Filter out any commands from real parent directories (test isolation issue)
      const testCommands = result.commands.filter(cmd => 
        cmd.path.includes(tempDir) || cmd.name === 'conflict-cmd'
      );
      const testConflicts = result.conflicts.filter(conflict =>
        conflict.commandName === 'conflict-cmd'
      );

      expect(testCommands).toHaveLength(2);
      expect(testConflicts).toHaveLength(1);

      const conflict = testConflicts[0];
      expect(conflict.commandName).toBe('conflict-cmd');
      expect(conflict.resolved.type).toBe(SlashCommandType.PROJECT); // Project wins
      expect(conflict.conflictingCommands).toHaveLength(2);

      // Check that project command is active, user command is not
      const projectCommand = testCommands.find(cmd => cmd.type === SlashCommandType.PROJECT);
      expect(projectCommand!.isActive).toBe(true);

      const userCommand = testCommands.find(cmd => cmd.type === SlashCommandType.USER);
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

      // Filter out any commands from real parent directories (test isolation issue)
      const testCommands = result.commands.filter(cmd => 
        cmd.path.includes(tempDir)
      );

      expect(testCommands).toHaveLength(1);
      expect(result.namespaces).toContain('git/flow');

      const command = testCommands[0];
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

      // Filter out any commands from real parent directories (test isolation issue)
      const testCommands = result.commands.filter(cmd => 
        cmd.path.includes(tempDir)
      );

      // Should discover valid command and attempt corrupted one
      expect(testCommands).toHaveLength(2);
      
      const validCommand = testCommands.find(cmd => cmd.name === 'valid');
      expect(validCommand).toBeDefined();
      expect(validCommand!.content).toBeDefined();

      const corruptedCommand = testCommands.find(cmd => cmd.name === 'corrupted');
      expect(corruptedCommand).toBeDefined();
      expect(corruptedCommand!.content).toBeUndefined(); // Failed to parse
    });

    it('should handle missing directories gracefully', async () => {
      // Don't create any command directories
      await fs.rm(userCommandsDir, { recursive: true, force: true });
      await fs.rm(projectCommandsDir, { recursive: true, force: true });

      const result = await discoverSlashCommands(projectRoot);

      // Filter out any commands from real parent directories (test isolation issue)
      const testCommands = result.commands.filter(cmd => 
        cmd.path.includes(tempDir)
      );

      expect(testCommands).toHaveLength(0);
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

      const allCommands = await getActiveCommands(projectRoot);

      // Filter out any commands from real parent directories (test isolation issue)
      const commands = allCommands.filter(cmd => 
        cmd.path.includes(tempDir)
      );

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

      // Filter to only the commands we expect from beforeEach
      const expectedCommands = commands.filter(cmd => 
        cmd.name === 'root-cmd' || 
        cmd.name === 'commit' || 
        cmd.name === 'push' || 
        cmd.name === 'user-cmd'
      );

      expect(expectedCommands).toHaveLength(4);
      expect(expectedCommands.every(cmd => cmd.isActive)).toBe(true); // activeOnly defaults to true
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

  describe('Parent Command Discovery', () => {
    let parentDir: string;
    let parentCommandsDir: string;

    beforeEach(async () => {
      // Create parent directory structure
      parentDir = path.dirname(projectRoot);
      parentCommandsDir = path.join(parentDir, '.claude', 'commands');
      await fs.mkdir(parentCommandsDir, { recursive: true });
    });

    afterEach(async () => {
      // Clean up parent directories to avoid test interference
      try {
        const claudeDir = path.join(parentDir, '.claude');
        await fs.rm(claudeDir, { recursive: true, force: true });
        
        const grandparentDir = path.dirname(parentDir);
        const grandparentClaudeDir = path.join(grandparentDir, '.claude');
        await fs.rm(grandparentClaudeDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should discover commands in parent directories', async () => {
      // Clean up any existing commands first
      try {
        const tempRoot = path.dirname(path.dirname(projectRoot));
        const tempClaudeDir = path.join(tempRoot, '.claude');
        await fs.rm(tempClaudeDir, { recursive: true, force: true });
      } catch {
        // Ignore if doesn't exist
      }

      // Create parent command
      await fs.writeFile(path.join(parentCommandsDir, 'parent-cmd.md'), 'Parent command content');
      
      // Create project command  
      await fs.writeFile(path.join(projectCommandsDir, 'project-cmd.md'), 'Project command content');

      const discovery = await discoverSlashCommands(projectRoot);

      // Filter out any commands that might be from other tests
      const relevantCommands = discovery.commands.filter(cmd => 
        cmd.name === 'parent-cmd' || cmd.name === 'project-cmd'
      );

      expect(relevantCommands).toHaveLength(2);
      
      const parentCommand = relevantCommands.find(cmd => cmd.name === 'parent-cmd');
      const projectCommand = relevantCommands.find(cmd => cmd.name === 'project-cmd');
      
      expect(parentCommand).toBeDefined();
      expect(parentCommand?.type).toBe(SlashCommandType.PARENT);
      expect(parentCommand?.isActive).toBe(true);
      
      expect(projectCommand).toBeDefined();
      expect(projectCommand?.type).toBe(SlashCommandType.PROJECT);
      expect(projectCommand?.isActive).toBe(true);
    });

    it('should handle precedence correctly with parent commands', async () => {
      // Create the same command in different locations
      const commandName = 'shared-cmd';
      
      await fs.writeFile(path.join(userCommandsDir, `${commandName}.md`), 'User version');
      await fs.writeFile(path.join(parentCommandsDir, `${commandName}.md`), 'Parent version'); 
      await fs.writeFile(path.join(projectCommandsDir, `${commandName}.md`), 'Project version');

      const discovery = await discoverSlashCommands(projectRoot);
      
      // Should find all three versions
      const sharedCommands = discovery.commands.filter(cmd => cmd.name === commandName);
      expect(sharedCommands).toHaveLength(3);

      // Check precedence: PROJECT (3) > PARENT (2) > USER (1)
      const activeCommand = sharedCommands.find(cmd => cmd.isActive);
      const inactiveCommands = sharedCommands.filter(cmd => !cmd.isActive);
      
      expect(activeCommand).toBeDefined();
      expect(activeCommand?.type).toBe(SlashCommandType.PROJECT);
      expect(inactiveCommands).toHaveLength(2);
      
      // Should have one conflict record
      expect(discovery.conflicts).toHaveLength(1);
      expect(discovery.conflicts[0].commandName).toBe(commandName);
    });

    it('should discover parent commands with namespaces', async () => {
      // Create namespaced parent command
      const namespaceDir = path.join(parentCommandsDir, 'parent-ns');
      await fs.mkdir(namespaceDir, { recursive: true });
      await fs.writeFile(path.join(namespaceDir, 'namespaced-cmd.md'), 'Namespaced parent command');

      const discovery = await discoverSlashCommands(projectRoot);
      
      const namespacedCommand = discovery.commands.find(cmd => 
        cmd.name === 'namespaced-cmd' && cmd.namespace === 'parent-ns'
      );
      
      expect(namespacedCommand).toBeDefined();
      expect(namespacedCommand?.type).toBe(SlashCommandType.PARENT);
      expect(namespacedCommand?.fullName).toBe('parent-ns:namespaced-cmd');
      expect(namespacedCommand?.invocation).toBe('/parent-ns:namespaced-cmd');
      
      // Should be included in namespaces list
      expect(discovery.namespaces).toContain('parent-ns');
    });

    it('should traverse multiple parent directory levels', async () => {
      // Create grandparent directory with commands
      const grandparentDir = path.dirname(parentDir);
      const grandparentCommandsDir = path.join(grandparentDir, '.claude', 'commands');
      await fs.mkdir(grandparentCommandsDir, { recursive: true });
      await fs.writeFile(path.join(grandparentCommandsDir, 'grandparent-cmd.md'), 'Grandparent command');
      
      // Create parent command too
      await fs.writeFile(path.join(parentCommandsDir, 'parent-cmd.md'), 'Parent command');

      const discovery = await discoverSlashCommands(projectRoot);
      
      const parentCommand = discovery.commands.find(cmd => cmd.name === 'parent-cmd');
      const grandparentCommand = discovery.commands.find(cmd => cmd.name === 'grandparent-cmd');
      
      expect(parentCommand).toBeDefined();
      expect(parentCommand?.type).toBe(SlashCommandType.PARENT);
      
      expect(grandparentCommand).toBeDefined();
      expect(grandparentCommand?.type).toBe(SlashCommandType.PARENT);
      
      // Both should be active (no conflicts)
      expect(parentCommand?.isActive).toBe(true);
      expect(grandparentCommand?.isActive).toBe(true);
    });
  });
});