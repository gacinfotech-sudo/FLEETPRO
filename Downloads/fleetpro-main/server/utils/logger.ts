import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, '../../logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  context?: string;
}

class Logger {
  private logFile: string;
  private errorLogFile: string;
  private maxLogSize = 10 * 1024 * 1024; // 10MB

  constructor() {
    const date = new Date().toISOString().split('T')[0];
    this.logFile = path.join(logsDir, `app-${date}.log`);
    this.errorLogFile = path.join(logsDir, `error-${date}.log`);
  }

  private rotateLogIfNeeded(filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        if (stats.size > this.maxLogSize) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backup = `${filePath}.${timestamp}`;
          fs.renameSync(filePath, backup);
        }
      }
    } catch (error) {
      console.error('Error rotating log file:', error);
    }
  }

  private formatEntry(entry: LogEntry): string {
    let line = `[${entry.timestamp}] [${entry.level}]`;
    if (entry.context) {
      line += ` [${entry.context}]`;
    }
    line += ` ${entry.message}`;
    if (entry.data) {
      line += ` ${JSON.stringify(entry.data)}`;
    }
    return line;
  }

  private write(level: LogLevel, message: string, data?: any, context?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context
    };

    const formatted = this.formatEntry(entry);

    // Console output
    const color = this.getColorCode(level);
    console.log(`${color}${formatted}\x1b[0m`);

    // File output
    const targetFile = level === LogLevel.ERROR || level === LogLevel.CRITICAL
      ? this.errorLogFile
      : this.logFile;

    this.rotateLogIfNeeded(targetFile);

    try {
      fs.appendFileSync(targetFile, formatted + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private getColorCode(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '\x1b[36m'; // Cyan
      case LogLevel.INFO: return '\x1b[32m';  // Green
      case LogLevel.WARN: return '\x1b[33m';  // Yellow
      case LogLevel.ERROR: return '\x1b[31m'; // Red
      case LogLevel.CRITICAL: return '\x1b[35m'; // Magenta
      default: return '\x1b[0m';
    }
  }

  debug(message: string, data?: any, context?: string) {
    this.write(LogLevel.DEBUG, message, data, context);
  }

  info(message: string, data?: any, context?: string) {
    this.write(LogLevel.INFO, message, data, context);
  }

  warn(message: string, data?: any, context?: string) {
    this.write(LogLevel.WARN, message, data, context);
  }

  error(message: string, data?: any, context?: string) {
    this.write(LogLevel.ERROR, message, data, context);
  }

  critical(message: string, data?: any, context?: string) {
    this.write(LogLevel.CRITICAL, message, data, context);
  }

  // Log API requests
  logApiRequest(method: string, path: string, statusCode: number, duration: number, userId?: string) {
    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;
    const message = `${method} ${path} ${statusCode} in ${duration}ms`;
    this.write(level, message, { userId }, 'API');
  }

  // Log database operations
  logDbOperation(operation: string, collection: string, duration: number, success: boolean, error?: string) {
    const level = success ? LogLevel.DEBUG : LogLevel.ERROR;
    const message = `${operation} on ${collection} in ${duration}ms`;
    this.write(level, message, { success, error }, 'DB');
  }

  // Log authentication events
  logAuth(action: string, userId: string, success: boolean, reason?: string) {
    const level = success ? LogLevel.INFO : LogLevel.WARN;
    const message = `${action} for user ${userId}`;
    this.write(level, message, { success, reason }, 'AUTH');
  }

  // Log security events
  logSecurity(event: string, data?: any, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM') {
    const level = severity === 'CRITICAL' ? LogLevel.CRITICAL : severity === 'HIGH' ? LogLevel.ERROR : LogLevel.WARN;
    this.write(level, event, data, 'SECURITY');
  }

  // Get logs from file
  getRecentLogs(lines: number = 100): string {
    try {
      if (!fs.existsSync(this.logFile)) return '';
      const content = fs.readFileSync(this.logFile, 'utf-8');
      return content.split('\n').slice(-lines).join('\n');
    } catch (error) {
      return `Error reading logs: ${error}`;
    }
  }

  // Get error logs
  getErrorLogs(lines: number = 100): string {
    try {
      if (!fs.existsSync(this.errorLogFile)) return '';
      const content = fs.readFileSync(this.errorLogFile, 'utf-8');
      return content.split('\n').slice(-lines).join('\n');
    } catch (error) {
      return `Error reading error logs: ${error}`;
    }
  }
}

export const logger = new Logger();
