/**
 * Простой логгер для Socket.IO
 * В продакшене можно заменить на Winston или другой продвинутый логгер
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  userId?: string;
  socketId?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }

    return `${prefix} ${message}`;
  }

  debug(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: any): void {
    console.info(this.formatMessage('info', message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message: string, data?: any): void {
    console.error(this.formatMessage('error', message, data));
  }

  // Специальный метод для логирования Socket.IO событий
  socketEvent(event: string, socketId: string, userId?: string, data?: any): void {
    this.debug(`Socket event: ${event}`, {
      socketId,
      userId,
      ...data
    });
  }

  // Логирование подключений/отключений
  connection(action: 'connect' | 'disconnect', socketId: string, userId?: string, reason?: string): void {
    const message = `Socket ${action}: ${socketId}${userId ? ` (user: ${userId})` : ''}${reason ? ` (${reason})` : ''}`;
    this.info(message);
  }

  // Логирование ошибок аутентификации
  authError(socketId: string, error: string, ip?: string): void {
    this.warn('Authentication failed', {
      socketId,
      error,
      ip
    });
  }

  // Логирование rate limiting
  rateLimit(userId: string, action: string, blocked: boolean): void {
    if (blocked) {
      this.warn('Rate limit exceeded', { userId, action });
    } else {
      this.debug('Rate limit check passed', { userId, action });
    }
  }
}

const logger = new Logger();

export default logger;