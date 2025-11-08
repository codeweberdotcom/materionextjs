import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { LOG_CONFIG, LOG_MODULES, LogModule } from './config';
import { jsonFormatter, consoleFormatter } from './formatters';

// Create transports
const createTransports = () => {
  const transports: winston.transport[] = [];

  // Console transport for development
  if (LOG_CONFIG.isDevelopment) {
    transports.push(new winston.transports.Console({
      format: consoleFormatter,
    }));
  }

  // File transports for all modules
  Object.values(LOG_MODULES).forEach(filename => {
    transports.push(new DailyRotateFile({
      filename: `${filename}`,
      dirname: LOG_CONFIG.dir,
      datePattern: 'YYYY-MM-DD',
      maxSize: LOG_CONFIG.maxSize,
      maxFiles: LOG_CONFIG.maxFiles,
      format: jsonFormatter,
    }));
  });

  return transports;
};

// Create base logger instance
const logger = winston.createLogger({
  level: LOG_CONFIG.level,
  format: jsonFormatter,
  transports: createTransports(),
});

// Create module-specific loggers
const createModuleLogger = (module: LogModule) => {
  return {
    info: (message: string, meta?: any) => logger.info(message, { module, ...meta }),
    warn: (message: string, meta?: any) => logger.warn(message, { module, ...meta }),
    error: (message: string, meta?: any) => logger.error(message, { module, ...meta }),
    debug: (message: string, meta?: any) => logger.debug(message, { module, ...meta }),
  };
};

// Socket logger
export const socketLogger = {
  connection: (socketId: string, userId?: string, ip?: string, userAgent?: string) =>
    logger.info('Socket connection established', { module: 'socket', socketId, userId, ip, userAgent }),

  disconnection: (socketId: string, userId?: string) =>
    logger.info('Socket disconnection', { module: 'socket', socketId, userId }),

  joinRoom: (socketId: string, userId: string, room: string) =>
    logger.info('User joined room', { module: 'socket', socketId, userId, room }),

  leaveRoom: (socketId: string, userId: string, room: string) =>
    logger.info('User left room', { module: 'socket', socketId, userId, room }),

  message: (socketId: string, userId: string, roomId: string, messageLength: number) =>
    logger.info('Message sent', { module: 'socket', socketId, userId, roomId, messageLength }),

  error: (message: string, meta?: any) =>
    logger.error(message, { module: 'socket', ...meta }),

  debug: (message: string, meta?: any) =>
    logger.debug(message, { module: 'socket', ...meta }),
};

// Auth logger
export const authLogger = {
  login: (userId: string, ip: string, userAgent: string) =>
    logger.info('User login', { module: 'auth', userId, ip, userAgent }),

  logout: (userId: string) =>
    logger.info('User logout', { module: 'auth', userId }),

  failedLogin: (email: string, ip: string, reason: string) =>
    logger.warn('Failed login attempt', { module: 'auth', email, ip, reason }),

  sessionExpired: (userId: string) =>
    logger.info('Session expired', { module: 'auth', userId }),

  error: (message: string, meta?: any) =>
    logger.error(message, { module: 'auth', ...meta }),
};

// Rate limit logger
export const rateLimitLogger = {
  limitApplied: (userId: string, ip: string, remainingPoints: number, resetTime: Date) =>
    logger.info('Rate limit applied', { module: 'rateLimit', userId, ip, remainingPoints, resetTime }),

  limitExceeded: (userId: string, ip: string, socketId: string, msBeforeNext: number) =>
    logger.warn('Rate limit exceeded', { module: 'rateLimit', userId, ip, socketId, msBeforeNext }),

  error: (message: string, meta?: any) =>
    logger.error(message, { module: 'rateLimit', ...meta }),
};

// Database logger
export const databaseLogger = {
  queryExecuted: (query: string, duration: number, userId?: string) =>
    logger.info('Database query executed', { module: 'database', query, duration, userId }),

  connectionError: (error: string) =>
    logger.error('Database connection error', { module: 'database', error }),

  migrationError: (migration: string, error: string) =>
    logger.error('Database migration error', { module: 'database', migration, error }),

  error: (message: string, meta?: any) =>
    logger.error(message, { module: 'database', ...meta }),
};

// Notifications logger
export const notificationsLogger = {
  sent: (userId: string, type: string, channel: string) =>
    logger.info('Notification sent', { module: 'notifications', userId, type, channel }),

  failed: (userId: string, type: string, error: string) =>
    logger.error('Notification failed', { module: 'notifications', userId, type, error }),

  error: (message: string, meta?: any) =>
    logger.error(message, { module: 'notifications', ...meta }),
};

// Export logger instance for direct use
export default logger;
