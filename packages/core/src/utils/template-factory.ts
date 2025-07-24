/**
 * Centralized template factory for all configuration file types
 * Consolidates template creation logic from across the codebase
 */

export interface TemplateContent {
  content: string;
  path: string;
  description?: string;
}

export interface TemplateOptions {
  projectName?: string;
  author?: string;
  description?: string;
  commands?: string[];
  model?: string;
  namespace?: string;
}

/**
 * Centralized template factory for creating consistent configuration file templates
 */
export class TemplateFactory {
  /**
   * Create memory file template (CLAUDE.md)
   */
  static createMemoryTemplate(options: TemplateOptions = {}): TemplateContent {
    const { projectName = 'your-project-name', author = 'Project Author' } =
      options;

    const content = `# Memory File

This is a memory file that provides context and instructions for Claude Code.

## Project Context

**Project**: ${projectName}
**Author**: ${author}

Add relevant information about your project here.

## Code Patterns

Document common patterns and conventions used in your codebase.

### Naming Conventions
- Use descriptive variable and function names
- Follow TypeScript/JavaScript naming conventions
- Use consistent file naming patterns

### Architecture Patterns
- Describe your project's architecture
- Document module organization
- Explain key design decisions

## Important Notes

Add any important notes or reminders here.

### Development Guidelines
- Code style preferences
- Testing requirements
- Deployment considerations

### Dependencies
- Key libraries and frameworks
- Version constraints
- Configuration requirements
`;

    return {
      content,
      path: 'CLAUDE.md',
      description: 'Memory file for project context and guidelines',
    };
  }

  /**
   * Create settings file template (settings.json)
   */
  static createSettingsTemplate(
    options: TemplateOptions = {}
  ): TemplateContent {
    const { projectName = 'your-project-name', model } = options;

    const settings: any = {
      permissions: {
        allow: ['*'],
        deny: [],
      },
      env: {
        PROJECT_NAME: projectName,
      },
      hooks: {
        PreToolUse: [
          {
            matcher: '*',
            hooks: [
              {
                type: 'command',
                command: "echo 'Running pre-tool command...'",
                timeout: 30,
              },
            ],
          },
        ],
      },
    };

    // Only include model if explicitly provided
    if (model) {
      settings.model = model;
    }

    // Generate clean JSON without BOM or extra whitespace
    const jsonContent = JSON.stringify(settings, null, 2);

    return {
      content: jsonContent,
      path: '.claude/settings.json',
      description: 'Claude Code settings configuration',
    };
  }

  /**
   * Create command file template (.md)
   */
  static createCommandTemplate(options: TemplateOptions = {}): TemplateContent {
    const {
      description = 'New command',
      commands = ['Bash', 'Read', 'Write'],
      namespace,
    } = options;

    const commandName = 'new-command';
    const namespacedPath = namespace
      ? `.claude/commands/${namespace}/${commandName}.md`
      : `.claude/commands/${commandName}.md`;

    const allowedToolsList = commands.map(cmd => `  - ${cmd}`).join('\n');

    const content = `---
description: ${description}
allowed-tools:
${allowedToolsList}
---

# ${description}

This is a slash command that can be invoked as \`/${namespace ? `${namespace}:` : ''}${commandName}\`.

## Usage

\`\`\`
/${namespace ? `${namespace}:` : ''}${commandName}
\`\`\`

## Implementation

Add your command implementation here.

### Parameters

Describe any parameters this command accepts.

### Examples

Provide examples of how to use this command.

### Notes

Add any important notes about this command's behavior.
`;

    return {
      content,
      path: namespacedPath,
      description: `Slash command: ${description}`,
    };
  }

  /**
   * Create minimal memory template for simple use cases
   */
  static createMinimalMemoryTemplate(): TemplateContent {
    return {
      content: '# Memory File\n\nContent here.\n',
      path: 'CLAUDE.md',
      description: 'Minimal memory file template',
    };
  }

  /**
   * Create minimal settings template for simple use cases
   */
  static createMinimalSettingsTemplate(): TemplateContent {
    const settings = {
      permissions: {
        allow: ['*'],
        deny: [],
      },
    };

    // Generate clean JSON without BOM or extra whitespace
    const jsonContent = JSON.stringify(settings, null, 2);

    return {
      content: jsonContent,
      path: '.claude/settings.json',
      description: 'Minimal settings template',
    };
  }

  /**
   * Create minimal command template for simple use cases
   */
  static createMinimalCommandTemplate(): TemplateContent {
    return {
      content: `---
description: Simple command
allowed-tools:
  - Bash
---

# Simple Command

Basic command implementation.
`,
      path: '.claude/commands/simple-command.md',
      description: 'Minimal command template',
    };
  }

  /**
   * Get all available template types
   */
  static getAvailableTemplates(): Array<{
    type: string;
    description: string;
    method: string;
  }> {
    return [
      {
        type: 'memory',
        description: 'Memory file for project context',
        method: 'createMemoryTemplate',
      },
      {
        type: 'settings',
        description: 'Settings configuration file',
        method: 'createSettingsTemplate',
      },
      {
        type: 'command',
        description: 'Slash command definition',
        method: 'createCommandTemplate',
      },
      {
        type: 'memory-minimal',
        description: 'Minimal memory file',
        method: 'createMinimalMemoryTemplate',
      },
      {
        type: 'settings-minimal',
        description: 'Minimal settings file',
        method: 'createMinimalSettingsTemplate',
      },
      {
        type: 'command-minimal',
        description: 'Minimal command file',
        method: 'createMinimalCommandTemplate',
      },
    ];
  }

  /**
   * Create template by type string
   */
  static createByType(
    type: string,
    options: TemplateOptions = {}
  ): TemplateContent {
    switch (type) {
      case 'memory':
        return this.createMemoryTemplate(options);
      case 'settings':
        return this.createSettingsTemplate(options);
      case 'command':
        return this.createCommandTemplate(options);
      case 'memory-minimal':
        return this.createMinimalMemoryTemplate();
      case 'settings-minimal':
        return this.createMinimalSettingsTemplate();
      case 'command-minimal':
        return this.createMinimalCommandTemplate();
      default:
        throw new Error(`Unknown template type: ${type}`);
    }
  }
}

// Export individual template creation functions for backward compatibility
export const createMemoryTemplate = TemplateFactory.createMemoryTemplate;
export const createSettingsTemplate = TemplateFactory.createSettingsTemplate;
export const createCommandTemplate = TemplateFactory.createCommandTemplate;
