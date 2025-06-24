type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogContext {
  sourceId?: string;
  videoId?: string;
  userId?: string;
  operation?: string;
  [key: string]: any;
}

class Logger {
  private isDev = process.env.NODE_ENV !== 'production';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? JSON.stringify(context) : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${contextStr}`;
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage('error', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  info(message: string, context?: LogContext): void {
    if (this.isDev) {
      console.log(this.formatMessage('info', message, context));
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDev) {
      console.log(this.formatMessage('debug', message, context));
    }
  }

  // Production-safe transcription logging
  transcriptionStep(step: string, sourceId: string, details?: any): void {
    const context = { sourceId, step, ...details };
    if (this.isDev) {
      console.log(`🎯 ${step}`, context);
    } else {
      // In production, only log errors and critical steps
      if (step.includes('error') || step.includes('failed')) {
        this.error(`Transcription ${step}`, context);
      }
    }
  }
}

export const logger = new Logger();