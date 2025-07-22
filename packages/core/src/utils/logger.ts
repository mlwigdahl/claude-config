export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerOptions {
  level: LogLevel;
  enableConsole: boolean;
  enableFile?: boolean;
  logFilePath?: string;
}

export class Logger {
  private options: LoggerOptions;
  private logs: LogEntry[] = [];

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      ...options,
    };
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    if (level < this.options.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      error,
    };

    this.logs.push(entry);

    if (this.options.enableConsole) {
      this.logToConsole(entry);
    }

    if (this.options.enableFile && this.options.logFilePath) {
      this.logToFile();
    }
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelName = LogLevel[entry.level];
    const message = `[${timestamp}] ${levelName}: ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        if (entry.context) {
          console.debug(message, entry.context);
        } else {
          console.debug(message);
        }
        break;
      case LogLevel.INFO:
        if (entry.context) {
          console.info(message, entry.context);
        } else {
          console.info(message);
        }
        break;
      case LogLevel.WARN:
        if (entry.context) {
          console.warn(message, entry.context);
        } else {
          console.warn(message);
        }
        break;
      case LogLevel.ERROR: {
        const errorData = entry.error || entry.context;
        if (errorData) {
          console.error(message, errorData);
        } else {
          console.error(message);
        }
        break;
      }
    }
  }

  private logToFile(): void {
    // File logging implementation would go here
    // For now, we'll keep it simple and just store in memory
    // In a real implementation, this would write to the specified log file
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(entry => entry.level === level);
  }

  clearLogs(): void {
    this.logs = [];
  }

  setLogLevel(level: LogLevel): void {
    this.options.level = level;
  }
}

// Detect if we're running in test environment
const isTestEnvironment = (): boolean => {
  return (
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
    (typeof process !== 'undefined' &&
      process.env?.JEST_WORKER_ID !== undefined) ||
    typeof jest !== 'undefined'
  );
};

// Global logger instance with test-aware configuration
export const logger = new Logger({
  level: isTestEnvironment() ? LogLevel.WARN : LogLevel.INFO,
  enableConsole: !isTestEnvironment(),
});

// Factory function for getting logger instances
export function getLogger(context?: string): Logger {
  // For now, return the global logger instance
  // In a more sophisticated implementation, this could create
  // context-specific loggers with prefixes
  // Future: use context for prefixing log messages
  if (context) {
    // Could enhance with context-specific functionality
  }
  return logger;
}
