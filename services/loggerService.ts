/**
 * Centralized Logging Service
 * Replaces scattered console.log statements with structured logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  userId?: string;
  sessionId?: string;
}

export class LoggerService {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs in memory
  private currentLogLevel: LogLevel = 'info';

  constructor() {
    // Set log level based on environment
    if (typeof window !== 'undefined') {
      this.currentLogLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'warn';
    }
  }

  /**
   * Set the minimum log level to display
   */
  setLogLevel(level: LogLevel) {
    this.currentLogLevel = level;
  }

  /**
   * Get current log level
   */
  getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }

  /**
   * Check if a log level should be processed
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.currentLogLevel);
  }

  /**
   * Core logging function
   */
  private log(level: LogLevel, category: string, message: string, data?: any) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data,
    };

    // Add to in-memory logs
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest log
    }

    // Console output with formatting
    const timestamp = entry.timestamp.toISOString().slice(11, 23);
    const emoji = this.getLevelEmoji(level);
    const categoryFormatted = `[${category}]`;
    
    const consoleMessage = `${timestamp} ${emoji} ${categoryFormatted} ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(consoleMessage, data || '');
        break;
      case 'info':
        console.info(consoleMessage, data || '');
        break;
      case 'warn':
        console.warn(consoleMessage, data || '');
        break;
      case 'error':
        console.error(consoleMessage, data || '');
        break;
    }
  }

  /**
   * Get emoji for log level
   */
  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case 'debug': return '🔍';
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      default: return '📝';
    }
  }

  /**
   * Debug level logging
   */
  debug(category: string, message: string, data?: any) {
    this.log('debug', category, message, data);
  }

  /**
   * Info level logging
   */
  info(category: string, message: string, data?: any) {
    this.log('info', category, message, data);
  }

  /**
   * Warning level logging
   */
  warn(category: string, message: string, data?: any) {
    this.log('warn', category, message, data);
  }

  /**
   * Error level logging
   */
  error(category: string, message: string, data?: any) {
    this.log('error', category, message, data);
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by category
   */
  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Category-specific logger functions
   */
  
  // Authentication logging
  auth = {
    debug: (message: string, data?: any) => this.debug('AUTH', message, data),
    info: (message: string, data?: any) => this.info('AUTH', message, data),
    warn: (message: string, data?: any) => this.warn('AUTH', message, data),
    error: (message: string, data?: any) => this.error('AUTH', message, data),
  };

  // Google Drive API logging
  drive = {
    debug: (message: string, data?: any) => this.debug('DRIVE', message, data),
    info: (message: string, data?: any) => this.info('DRIVE', message, data),
    warn: (message: string, data?: any) => this.warn('DRIVE', message, data),
    error: (message: string, data?: any) => this.error('DRIVE', message, data),
  };

  // Template processing logging
  template = {
    debug: (message: string, data?: any) => this.debug('TEMPLATE', message, data),
    info: (message: string, data?: any) => this.info('TEMPLATE', message, data),
    warn: (message: string, data?: any) => this.warn('TEMPLATE', message, data),
    error: (message: string, data?: any) => this.error('TEMPLATE', message, data),
  };

  // Database operations logging
  db = {
    debug: (message: string, data?: any) => this.debug('DATABASE', message, data),
    info: (message: string, data?: any) => this.info('DATABASE', message, data),
    warn: (message: string, data?: any) => this.warn('DATABASE', message, data),
    error: (message: string, data?: any) => this.error('DATABASE', message, data),
  };

  // UI/UX logging
  ui = {
    debug: (message: string, data?: any) => this.debug('UI', message, data),
    info: (message: string, data?: any) => this.info('UI', message, data),
    warn: (message: string, data?: any) => this.warn('UI', message, data),
    error: (message: string, data?: any) => this.error('UI', message, data),
  };

  // Performance logging
  perf = {
    debug: (message: string, data?: any) => this.debug('PERF', message, data),
    info: (message: string, data?: any) => this.info('PERF', message, data),
    warn: (message: string, data?: any) => this.warn('PERF', message, data),
    error: (message: string, data?: any) => this.error('PERF', message, data),
  };
}

// Export singleton instance
export const logger = new LoggerService();

// Export convenience functions for backward compatibility
export const log = logger.info.bind(logger);
export const logError = logger.error.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logDebug = logger.debug.bind(logger);