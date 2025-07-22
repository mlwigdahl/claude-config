/**
 * Tests for Logger utility
 */

import { Logger, LogLevel, getLogger, logger } from '../logger.js';

describe('Logger', () => {
  let testLogger: Logger;

  beforeEach(() => {
    testLogger = new Logger({ enableConsole: false, level: LogLevel.DEBUG }); // Disable console to avoid test output
  });

  afterEach(() => {
    testLogger.clearLogs();
  });

  describe('constructor', () => {
    it('should use default options', () => {
      const defaultLogger = new Logger();
      
      const logs = defaultLogger.getLogs();
      expect(logs).toEqual([]);
    });

    it('should accept custom options', () => {
      const customLogger = new Logger({
        level: LogLevel.DEBUG,
        enableConsole: false,
        enableFile: true,
        logFilePath: '/tmp/test.log'
      });
      
      const logs = customLogger.getLogs();
      expect(logs).toEqual([]);
    });
  });

  describe('log levels', () => {
    it('should respect log level filtering', () => {
      const infoLogger = new Logger({ level: LogLevel.INFO, enableConsole: false });
      
      infoLogger.debug('debug message');
      infoLogger.info('info message');
      infoLogger.warn('warn message');
      infoLogger.error('error message');
      
      const logs = infoLogger.getLogs();
      expect(logs).toHaveLength(3); // debug should be filtered out
      expect(logs[0].level).toBe(LogLevel.INFO);
      expect(logs[1].level).toBe(LogLevel.WARN);
      expect(logs[2].level).toBe(LogLevel.ERROR);
    });

    it('should log debug messages when level is DEBUG', () => {
      const debugLogger = new Logger({ level: LogLevel.DEBUG, enableConsole: false });
      
      debugLogger.debug('debug message');
      debugLogger.info('info message');
      
      const logs = debugLogger.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe(LogLevel.DEBUG);
      expect(logs[1].level).toBe(LogLevel.INFO);
    });

    it('should not log debug messages when level is INFO', () => {
      const infoLogger = new Logger({ level: LogLevel.INFO, enableConsole: false });
      
      infoLogger.debug('debug message');
      infoLogger.info('info message');
      
      const logs = infoLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.INFO);
    });

    it('should filter based on WARN level', () => {
      const warnLogger = new Logger({ level: LogLevel.WARN, enableConsole: false });
      
      warnLogger.debug('debug message');
      warnLogger.info('info message');
      warnLogger.warn('warn message');
      warnLogger.error('error message');
      
      const logs = warnLogger.getLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[1].level).toBe(LogLevel.ERROR);
    });

    it('should filter based on ERROR level', () => {
      const errorLogger = new Logger({ level: LogLevel.ERROR, enableConsole: false });
      
      errorLogger.debug('debug message');
      errorLogger.info('info message');
      errorLogger.warn('warn message');
      errorLogger.error('error message');
      
      const logs = errorLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
    });
  });

  describe('log methods', () => {
    it('should call debug() correctly', () => {
      testLogger.debug('test debug message');
      
      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.DEBUG);
      expect(logs[0].message).toBe('test debug message');
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });

    it('should call info() correctly', () => {
      testLogger.info('test info message');
      
      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.INFO);
      expect(logs[0].message).toBe('test info message');
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });

    it('should call warn() correctly', () => {
      testLogger.warn('test warn message');
      
      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[0].message).toBe('test warn message');
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });

    it('should call error() correctly with error object', () => {
      const testError = new Error('test error');
      testLogger.error('test error message', testError);
      
      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
      expect(logs[0].message).toBe('test error message');
      expect(logs[0].error).toBe(testError);
      expect(logs[0].timestamp).toBeInstanceOf(Date);
    });

    it('should call error() correctly with context', () => {
      const context = { userId: 123, action: 'delete' };
      testLogger.error('test error message', undefined, context);
      
      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LogLevel.ERROR);
      expect(logs[0].message).toBe('test error message');
      expect(logs[0].context).toEqual(context);
      expect(logs[0].error).toBeUndefined();
    });

    it('should handle context objects in all log methods', () => {
      const context = { key: 'value' };
      
      testLogger.debug('debug with context', context);
      testLogger.info('info with context', context);
      testLogger.warn('warn with context', context);
      testLogger.error('error with context', undefined, context);
      
      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(4);
      logs.forEach(log => {
        expect(log.context).toEqual(context);
      });
    });
  });

  describe('console logging', () => {
    let consoleSpy: {
      debug: jest.SpyInstance;
      info: jest.SpyInstance;
      warn: jest.SpyInstance;
      error: jest.SpyInstance;
    };

    beforeEach(() => {
      consoleSpy = {
        debug: jest.spyOn(console, 'debug').mockImplementation(),
        info: jest.spyOn(console, 'info').mockImplementation(),
        warn: jest.spyOn(console, 'warn').mockImplementation(),
        error: jest.spyOn(console, 'error').mockImplementation(),
      };
    });

    afterEach(() => {
      consoleSpy.debug.mockRestore();
      consoleSpy.info.mockRestore();
      consoleSpy.warn.mockRestore();
      consoleSpy.error.mockRestore();
    });

    it('should log to console when enableConsole is true', () => {
      const consoleLogger = new Logger({ enableConsole: true, level: LogLevel.DEBUG });
      
      consoleLogger.debug('debug message');
      consoleLogger.info('info message');
      consoleLogger.warn('warn message');
      consoleLogger.error('error message');
      
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG: debug message')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO: info message')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN: warn message')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: error message')
      );
    });

    it('should not log to console when enableConsole is false', () => {
      const consoleLogger = new Logger({ enableConsole: false });
      
      consoleLogger.debug('debug message');
      consoleLogger.info('info message');
      consoleLogger.warn('warn message');
      consoleLogger.error('error message');
      
      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });

    it('should format messages correctly', () => {
      const consoleLogger = new Logger({ enableConsole: true });
      
      consoleLogger.info('test message');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: test message$/)
      );
    });

    it('should handle context objects', () => {
      const consoleLogger = new Logger({ enableConsole: true });
      const context = { key: 'value' };
      
      consoleLogger.info('message with context', context);
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO: message with context'),
        context
      );
    });

    it('should handle error objects', () => {
      const consoleLogger = new Logger({ enableConsole: true });
      const testError = new Error('test error');
      
      consoleLogger.error('error message', testError);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: error message'),
        testError
      );
    });

    it('should handle debug level console output', () => {
      const consoleLogger = new Logger({ enableConsole: true, level: LogLevel.DEBUG });
      const context = { debug: true };
      
      consoleLogger.debug('debug message', context);
      
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG: debug message'),
        context
      );
    });

    it('should handle warn level console output', () => {
      const consoleLogger = new Logger({ enableConsole: true });
      const context = { warning: true };
      
      consoleLogger.warn('warn message', context);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN: warn message'),
        context
      );
    });

    it('should handle error level without context', () => {
      const consoleLogger = new Logger({ enableConsole: true });
      
      consoleLogger.error('simple error');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR: simple error')
      );
    });
  });

  describe('file logging', () => {
    it('should call logToFile when enableFile is true', () => {
      const fileLogger = new Logger({ 
        enableFile: true, 
        logFilePath: '/tmp/test.log',
        enableConsole: false 
      });
      
      // Since logToFile is currently a stub, we just ensure it doesn't crash
      fileLogger.info('test message');
      
      const logs = fileLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('test message');
    });

    it('should not call logToFile when enableFile is false', () => {
      const fileLogger = new Logger({ 
        enableFile: false,
        enableConsole: false 
      });
      
      fileLogger.info('test message');
      
      const logs = fileLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('test message');
    });

    it('should not call logToFile when enableFile is true but no logFilePath', () => {
      const fileLogger = new Logger({ 
        enableFile: true,
        enableConsole: false 
      });
      
      fileLogger.info('test message');
      
      const logs = fileLogger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('test message');
    });
  });

  describe('log storage', () => {
    it('should store logs in memory', () => {
      testLogger.info('message 1');
      testLogger.warn('message 2');
      testLogger.error('message 3');
      
      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('message 1');
      expect(logs[1].message).toBe('message 2');
      expect(logs[2].message).toBe('message 3');
    });

    it('should return all logs with getLogs()', () => {
      testLogger.debug('debug');
      testLogger.info('info');
      testLogger.warn('warn');
      testLogger.error('error');
      
      const logs = testLogger.getLogs();
      expect(logs).toHaveLength(4);
      expect(logs.map(log => log.message)).toEqual(['debug', 'info', 'warn', 'error']);
    });

    it('should filter logs by level with getLogsByLevel()', () => {
      testLogger.debug('debug');
      testLogger.info('info 1');
      testLogger.info('info 2');
      testLogger.warn('warn');
      testLogger.error('error');
      
      const infoLogs = testLogger.getLogsByLevel(LogLevel.INFO);
      expect(infoLogs).toHaveLength(2);
      expect(infoLogs[0].message).toBe('info 1');
      expect(infoLogs[1].message).toBe('info 2');
      
      const warnLogs = testLogger.getLogsByLevel(LogLevel.WARN);
      expect(warnLogs).toHaveLength(1);
      expect(warnLogs[0].message).toBe('warn');
      
      const errorLogs = testLogger.getLogsByLevel(LogLevel.ERROR);
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].message).toBe('error');
    });

    it('should clear logs with clearLogs()', () => {
      testLogger.info('message 1');
      testLogger.warn('message 2');
      
      expect(testLogger.getLogs()).toHaveLength(2);
      
      testLogger.clearLogs();
      
      expect(testLogger.getLogs()).toHaveLength(0);
    });

    it('should return a copy of logs array', () => {
      testLogger.info('original message');
      
      const logs1 = testLogger.getLogs();
      const logs2 = testLogger.getLogs();
      
      expect(logs1).not.toBe(logs2); // Different array instances
      expect(logs1).toEqual(logs2); // Same content
      
      logs1.push({
        timestamp: new Date(),
        level: LogLevel.DEBUG,
        message: 'added externally'
      });
      
      expect(testLogger.getLogs()).toHaveLength(1); // Original not modified
    });
  });

  describe('configuration', () => {
    it('should update log level with setLogLevel()', () => {
      const configLogger = new Logger({ level: LogLevel.INFO, enableConsole: false });
      
      configLogger.debug('should be filtered');
      configLogger.info('should be logged');
      
      expect(configLogger.getLogs()).toHaveLength(1);
      
      configLogger.setLogLevel(LogLevel.DEBUG);
      
      configLogger.debug('should now be logged');
      
      expect(configLogger.getLogs()).toHaveLength(2);
      expect(configLogger.getLogs()[1].level).toBe(LogLevel.DEBUG);
    });

    it('should respect updated log level for subsequent logs', () => {
      const configLogger = new Logger({ level: LogLevel.WARN, enableConsole: false });
      
      configLogger.info('filtered info');
      configLogger.warn('logged warn');
      
      expect(configLogger.getLogs()).toHaveLength(1);
      
      configLogger.setLogLevel(LogLevel.DEBUG);
      
      configLogger.debug('now logged debug');
      configLogger.info('now logged info');
      
      expect(configLogger.getLogs()).toHaveLength(3);
      expect(configLogger.getLogs()[1].level).toBe(LogLevel.DEBUG);
      expect(configLogger.getLogs()[2].level).toBe(LogLevel.INFO);
    });
  });

  describe('test environment detection', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      // Mock console.warn to suppress output
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should detect test environment correctly', () => {
      // We're running in a test environment, so this should be true
      expect(process.env.NODE_ENV).toBe('test');
      
      // The global logger should be configured for test environment
      expect(logger).toBeDefined();
    });

    it('should use WARN level in test environment', () => {
      // The global logger should be configured with WARN level for tests
      // We can't directly test this without accessing private properties,
      // but we can test that debug messages are filtered
      const originalLogs = logger.getLogs();
      const initialCount = originalLogs.length;
      
      logger.debug('debug message in test');
      logger.warn('warn message in test');
      
      const newLogs = logger.getLogs();
      expect(newLogs.length).toBe(initialCount + 1); // Only warn should be logged
      
      // In test environment, console output is suppressed, so we just check
      // that the message was logged internally
      expect(newLogs[newLogs.length - 1].message).toBe('warn message in test');
      expect(newLogs[newLogs.length - 1].level).toBe(2); // WARN level
      
      // Clean up
      logger.clearLogs();
    });
  });

  describe('getLogger factory', () => {
    it('should return logger instance', () => {
      const factoryLogger = getLogger();
      expect(factoryLogger).toBeDefined();
      expect(factoryLogger).toBeInstanceOf(Logger);
    });

    it('should handle context parameter', () => {
      const contextLogger = getLogger('test-context');
      expect(contextLogger).toBeDefined();
      expect(contextLogger).toBeInstanceOf(Logger);
      
      // For now, it returns the same global logger
      expect(contextLogger).toBe(logger);
    });

    it('should return same instance for global logger', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
      expect(logger1).toBe(logger);
    });
  });

  describe('timestamp and log entry structure', () => {
    it('should create proper log entry structure', () => {
      const beforeTime = Date.now();
      testLogger.info('test message', { key: 'value' });
      const afterTime = Date.now();
      
      const logs = testLogger.getLogs();
      const logEntry = logs[0];
      
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry).toHaveProperty('level');
      expect(logEntry).toHaveProperty('message');
      expect(logEntry).toHaveProperty('context');
      expect(logEntry).toHaveProperty('error');
      
      expect(logEntry.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime);
      expect(logEntry.timestamp.getTime()).toBeLessThanOrEqual(afterTime);
      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.message).toBe('test message');
      expect(logEntry.context).toEqual({ key: 'value' });
      expect(logEntry.error).toBeUndefined();
    });

    it('should handle log entry with error', () => {
      const testError = new Error('test error');
      testLogger.error('error message', testError, { extra: 'data' });
      
      const logs = testLogger.getLogs();
      const logEntry = logs[0];
      
      expect(logEntry.level).toBe(LogLevel.ERROR);
      expect(logEntry.message).toBe('error message');
      expect(logEntry.error).toBe(testError);
      expect(logEntry.context).toEqual({ extra: 'data' });
    });
  });

  describe('LogLevel enum', () => {
    it('should have correct numeric values', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
    });

    it('should filter correctly based on numeric values', () => {
      const debugLogger = new Logger({ level: LogLevel.DEBUG, enableConsole: false });
      const warnLogger = new Logger({ level: LogLevel.WARN, enableConsole: false });
      
      debugLogger.debug('debug');
      debugLogger.info('info');
      debugLogger.warn('warn');
      debugLogger.error('error');
      
      warnLogger.debug('debug');
      warnLogger.info('info');
      warnLogger.warn('warn');
      warnLogger.error('error');
      
      expect(debugLogger.getLogs()).toHaveLength(4);
      expect(warnLogger.getLogs()).toHaveLength(2);
    });
  });
});