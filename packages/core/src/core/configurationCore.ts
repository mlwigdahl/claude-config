/**
 * Core configuration business logic
 * This module contains the consolidated validation, parsing, and template creation logic
 * that was previously duplicated between client and server services
 */

import {
  ConfigurationCore,
  ConfigurationFileTemplate,
  UnifiedValidationResult,
  MemoryParseResult,
  SettingsParseResult,
  CommandParseResult,
} from '../types/configuration.js';
import { SettingsConfig } from '../types/settings.js';
import { SpecialSyntaxValidationResult } from '../types/commands.js';
import { HookDefinition } from '../types/hooks.js';

import { validateSettings } from '../settings/validation.js';
import { validateCommandFile } from '../commands/validation.js';

/**
 * Core configuration service implementation
 * Provides centralized business logic for all configuration operations
 */
export class ConfigurationCoreImpl implements ConfigurationCore {
  /**
   * Validate memory file content
   */
  validateMemoryFile(
    content: string,
    filePath: string
  ): UnifiedValidationResult {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check if content is empty
      if (!content || content.trim().length === 0) {
        errors.push('Memory file cannot be empty');
      }

      // Check file extension
      if (!filePath.endsWith('.md')) {
        errors.push('Memory file must have .md extension');
      }

      // Check for expected file name
      if (!filePath.includes('CLAUDE.md')) {
        warnings.push('Memory file is typically named CLAUDE.md');
      }

      // Extract imports
      const imports = this.extractImports(content);

      // Validate imports
      for (const importPath of imports) {
        if (!importPath.trim()) {
          errors.push('Empty import path found');
        }
      }

      // Check for basic markdown structure
      if (!content.includes('#')) {
        warnings.push(
          'Memory file should contain at least one markdown header'
        );
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          imports,
          hasImports: imports.length > 0,
          lineCount: content.split('\n').length,
        },
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          error instanceof Error
            ? error.message
            : 'Memory file validation failed',
        ],
        warnings: [],
      };
    }
  }

  /**
   * Validate settings file content
   */
  validateSettingsFile(content: string): UnifiedValidationResult {
    try {
      const result = validateSettings(content);

      return {
        valid: result.isValid,
        errors: result.errors,
        warnings: result.warnings || [],
        metadata: {
          hasHooks: this.hasHooksInSettings(content),
          settingsKeys: this.extractSettingsKeys(content),
        },
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          error instanceof Error
            ? error.message
            : 'Settings file validation failed',
        ],
        warnings: [],
      };
    }
  }

  /**
   * Validate command file content
   */
  validateCommandFile(
    content: string,
    filePath: string
  ): UnifiedValidationResult {
    try {
      const result = validateCommandFile(content, filePath);

      return {
        valid: result.isValid,
        errors: result.errors,
        warnings: result.warnings || [],
        metadata: {
          hasFrontmatter: this.hasFrontmatter(content),
          commandName: this.extractCommandName(filePath),
          specialSyntax: this.detectSpecialSyntax(content),
        },
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          error instanceof Error
            ? error.message
            : 'Command file validation failed',
        ],
        warnings: [],
      };
    }
  }

  /**
   * Create memory file template
   */
  createMemoryTemplate(path?: string): ConfigurationFileTemplate {
    const defaultPath = path || 'CLAUDE.md';

    return {
      content: this.generateMemoryTemplate(),
      path: defaultPath,
      type: 'memory',
      metadata: {
        isTemplate: true,
        createdAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Create settings file template
   */
  createSettingsTemplate(
    type: 'user' | 'project' = 'project'
  ): ConfigurationFileTemplate {
    const path =
      type === 'user' ? '~/.claude/settings.json' : '.claude/settings.json';

    return {
      content: this.generateSettingsTemplate(type),
      path,
      type: 'settings',
      metadata: {
        isTemplate: true,
        settingsType: type,
        createdAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Create command file template
   */
  createCommandTemplate(
    name: string,
    namespace?: string
  ): ConfigurationFileTemplate {
    const fileName = `${name}.md`;
    const path = namespace ? `${namespace}/${fileName}` : fileName;

    return {
      content: this.generateCommandTemplate(name, namespace),
      path,
      type: 'command',
      metadata: {
        isTemplate: true,
        commandName: name,
        namespace,
        createdAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Parse memory file content
   */
  parseMemoryFile(content: string): MemoryParseResult {
    try {
      const imports = this.extractImports(content);
      const cleanContent = this.removeImports(content);

      return {
        content: cleanContent,
        imports,
        metadata: {
          hasImports: imports.length > 0,
          lineCount: content.split('\n').length,
        },
      };
    } catch (error) {
      return {
        content,
        imports: [],
        errors: [
          error instanceof Error
            ? error.message
            : 'Failed to parse memory file',
        ],
      };
    }
  }

  /**
   * Parse settings file content
   */
  parseSettingsFile(content: string): SettingsParseResult {
    try {
      const settings = JSON.parse(content) as SettingsConfig;
      const hooks = this.extractHooksFromSettings(settings);

      return {
        settings,
        hooks,
        metadata: {
          hasHooks: hooks.length > 0,
          settingsKeys: Object.keys(settings),
        },
      };
    } catch (error) {
      return {
        settings: {},
        hooks: [],
        errors: [
          error instanceof Error
            ? error.message
            : 'Failed to parse settings file',
        ],
      };
    }
  }

  /**
   * Parse command file content
   */
  parseCommandFile(content: string): CommandParseResult {
    try {
      const { frontmatter, content: bodyContent } =
        this.extractFrontmatter(content);
      const specialSyntax = this.analyzeSpecialSyntax(content);

      return {
        frontmatter,
        content: bodyContent,
        specialSyntax,
        metadata: {
          hasFrontmatter: !!frontmatter,
          contentLength: bodyContent.length,
        },
      };
    } catch (error) {
      return {
        content,
        errors: [
          error instanceof Error
            ? error.message
            : 'Failed to parse command file',
        ],
      };
    }
  }

  /**
   * Extract hooks from settings
   */
  extractHooksFromSettings(settings: SettingsConfig): HookDefinition[] {
    const hooks: HookDefinition[] = [];

    if (settings.hooks) {
      for (const [_toolName, toolHooks] of Object.entries(settings.hooks)) {
        for (const [_eventType, hookDef] of Object.entries(toolHooks)) {
          if (this.isValidHookDefinition(hookDef)) {
            hooks.push({
              ...hookDef,
              type: 'command', // Ensure type is set
            });
          }
        }
      }
    }

    return hooks;
  }

  /**
   * Validate hook definition
   */
  validateHook(hook: HookDefinition): UnifiedValidationResult {
    const errors: string[] = [];

    if (!hook.type || hook.type !== 'command') {
      errors.push('Hook type must be "command"');
    }

    if (!hook.command || typeof hook.command !== 'string') {
      errors.push('Hook command must be a non-empty string');
    }

    if (
      hook.timeout !== undefined &&
      (typeof hook.timeout !== 'number' || hook.timeout <= 0)
    ) {
      errors.push('Hook timeout must be a positive number');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  // Private helper methods

  private generateMemoryTemplate(): string {
    return `# Memory File

This is a memory file that provides context and instructions for Claude Code.

## Project Context

Add relevant information about your project here.

## Code Patterns

Document common patterns and conventions used in your codebase.

## Important Notes

Add any important notes or reminders here.
`;
  }

  private generateSettingsTemplate(type: 'user' | 'project'): string {
    const baseSettings = {
      permissions: {
        allow: ['*'],
        deny: [],
      },
    };

    if (type === 'project') {
      return JSON.stringify(
        {
          ...baseSettings,
          env: {
            PROJECT_NAME: 'your-project-name',
          },
          hooks: {
            Bash: {
              pre: {
                type: 'command',
                command: "echo 'Running bash command...'",
                timeout: 30,
              },
            },
          },
        },
        null,
        2
      );
    }

    return JSON.stringify(baseSettings, null, 2);
  }

  private generateCommandTemplate(name: string, namespace?: string): string {
    const title = namespace ? `${namespace}:${name}` : name;

    return `---
description: ${title} command
allowed-tools:
  - Bash
  - Read
  - Write
---

# ${title}

This is a slash command that can be invoked as \`/${title}\`.

## Usage

\`\`\`
/${title}
\`\`\`

## Implementation

Add your command implementation here.
`;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^@import\s+(.+)$/);
      if (match) {
        imports.push(match[1].trim());
      }
    }

    return imports;
  }

  private removeImports(content: string): string {
    return content
      .split('\n')
      .filter(line => !line.match(/^@import\s+/))
      .join('\n');
  }

  private hasHooksInSettings(content: string): boolean {
    try {
      const settings = JSON.parse(content);
      return !!(settings.hooks && Object.keys(settings.hooks).length > 0);
    } catch {
      return false;
    }
  }

  private extractSettingsKeys(content: string): string[] {
    try {
      const settings = JSON.parse(content);
      return Object.keys(settings);
    } catch {
      return [];
    }
  }

  private hasFrontmatter(content: string): boolean {
    return content.trim().startsWith('---');
  }

  private extractCommandName(filePath: string): string {
    const fileName = filePath.split('/').pop() || '';
    return fileName.replace(/\.md$/, '');
  }

  private detectSpecialSyntax(content: string): boolean {
    return /(\$ARGUMENTS|^!\s|^@\s|<thinking>)/m.test(content);
  }

  private extractFrontmatter(content: string): {
    frontmatter?: Record<string, any>;
    content: string;
  } {
    const lines = content.split('\n');

    if (lines[0] !== '---') {
      return { content };
    }

    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      return { content };
    }

    const frontmatterLines = lines.slice(1, endIndex);
    const bodyLines = lines.slice(endIndex + 1);

    try {
      const frontmatter = this.parseYamlFrontmatter(
        frontmatterLines.join('\n')
      );
      return {
        frontmatter,
        content: bodyLines.join('\n'),
      };
    } catch {
      return { content };
    }
  }

  private parseYamlFrontmatter(yaml: string): Record<string, any> {
    // Simple YAML parser for frontmatter
    const result: Record<string, any> = {};
    const lines = yaml.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        const value = match[2];

        if (value.startsWith('[') && value.endsWith(']')) {
          // Array value
          result[key] = value
            .slice(1, -1)
            .split(',')
            .map(v => v.trim());
        } else {
          // String value
          result[key] = value;
        }
      }
    }

    return result;
  }

  private analyzeSpecialSyntax(content: string): SpecialSyntaxValidationResult {
    const errors: any[] = [];
    const warnings: string[] = [];

    // Check for $ARGUMENTS placeholder
    if (content.includes('$ARGUMENTS')) {
      // This is valid special syntax
    }

    // Check for bash commands (! prefix)
    const bashCommands = content.match(/^!\s+.*$/gm);
    if (bashCommands) {
      // Validate bash commands
      for (const cmd of bashCommands) {
        if (cmd.trim() === '!') {
          errors.push({
            type: 'BASH_COMMAND',
            line: 0,
            column: 0,
            message: 'Empty bash command',
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private isValidHookDefinition(hookDef: any): hookDef is HookDefinition {
    return (
      hookDef &&
      typeof hookDef === 'object' &&
      hookDef.type === 'command' &&
      typeof hookDef.command === 'string' &&
      hookDef.command.length > 0
    );
  }
}

/**
 * Create a singleton instance of the configuration core
 */
export const configurationCore = new ConfigurationCoreImpl();
