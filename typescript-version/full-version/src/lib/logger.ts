// TypeScript logger implementation with conditional client/server support
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// Types for logger methods
interface LoggerData {
  [key: string]: any;
}

interface SocketLoggerMethods {
  connection(socketId: string, userId: string | null, ip: string, userAgent: string): void;
  disconnection(socketId: string, userId: string | null): void;
  joinRoom(socketId: string, userId: string | null, room: string): void;
  message(socketId: string, userId: string | null, roomId: string, messageLength: number): void;
  error(message: string | LoggerData, meta?: LoggerData): void;
  debug(message: string | LoggerData, meta?: LoggerData): void;
}

interface RateLimitLoggerMethods {
  limitApplied(userId: string, ip: string, remainingPoints: number, resetTime: number): void;
  limitExceeded(userId: string, ip: string, socketId: string, msBeforeNext: number): void;
  error(message: string | LoggerData, meta?: LoggerData): void;
}

interface DatabaseLoggerMethods {
  queryExecuted(query: string, duration: number, userId: string | null): void;
  error(message: string | LoggerData, meta?: LoggerData): void;
}

interface AuthLoggerMethods {
  info(message: string | LoggerData, meta?: LoggerData): void;
  warn(message: string | LoggerData, meta?: LoggerData): void;
  error(message: string | LoggerData, meta?: LoggerData): void;
  debug(message: string | LoggerData, meta?: LoggerData): void;
}

// Check if running on client side
const isClient = typeof window !== 'undefined';

// Configure Winston logger (server-side only)
let logger: winston.Logger;

if (!isClient) {
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'materio-nextjs' },
    transports: [
      // Console transport for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),

      // Daily rotate file for all logs
      new DailyRotateFile({
        filename: 'logs/application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d'
      }),

      // Separate error log
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '30d'
      })
    ]
  });
} else {
  // Client-side logger using console
  logger = {
    info: (message: string | LoggerData, meta?: LoggerData) => {
      if (typeof message === 'string') {
        console.log(`[INFO] ${message}`, meta)
      } else {
        console.log('[INFO]', message, meta)
      }
    },
    warn: (message: string | LoggerData, meta?: LoggerData) => {
      if (typeof message === 'string') {
        console.warn(`[WARN] ${message}`, meta)
      } else {
        console.warn('[WARN]', message, meta)
      }
    },
    error: (message: string | LoggerData, meta?: LoggerData) => {
      if (typeof message === 'string') {
        console.error(`[ERROR] ${message}`, meta)
      } else {
        console.error('[ERROR]', JSON.stringify(message, null, 2), meta)
      }
    },
    debug: (message: string | LoggerData, meta?: LoggerData) => {
      if (typeof message === 'string') {
        console.debug(`[DEBUG] ${message}`, meta)
      } else {
        console.debug('[DEBUG]', message, meta)
      }
    },
  } as any;
}

// Socket-specific logger methods
export const socketLogger: SocketLoggerMethods = {
  connection: (socketId: string, userId: string | null, ip: string, userAgent: string) =>
    logger.info('Socket connection established', { socketId, userId, ip, userAgent }),
  disconnection: (socketId: string, userId: string | null) =>
    logger.info('Socket disconnection', { socketId, userId }),
  joinRoom: (socketId: string, userId: string | null, room: string) =>
    logger.info('User joined room', { socketId, userId, room }),
  message: (socketId: string, userId: string | null, roomId: string, messageLength: number) =>
    logger.info('Message sent', { socketId, userId, roomId, messageLength }),
  error: (message: string, meta?: LoggerData) => logger.error(message, meta),
  debug: (message: string, meta?: LoggerData) => logger.debug(message, meta),
};

export const rateLimitLogger: RateLimitLoggerMethods = {
  limitApplied: (userId: string, ip: string, remainingPoints: number, resetTime: number) =>
    logger.info('Rate limit applied', { userId, ip, remainingPoints, resetTime }),
  limitExceeded: (userId: string, ip: string, socketId: string, msBeforeNext: number) =>
    logger.warn('Rate limit exceeded', { userId, ip, socketId, msBeforeNext }),
  error: (message: string, meta?: LoggerData) => logger.error(message, meta),
};

export const databaseLogger: DatabaseLoggerMethods = {
  queryExecuted: (query: string, duration: number, userId: string | null) =>
    logger.info('Database query executed', { query, duration, userId }),
  error: (message: string, meta?: LoggerData) => logger.error(message, meta),
};

// Auth logger methods
export const authLogger: AuthLoggerMethods = {
  info: (message: string, meta?: LoggerData) => logger.info(message, meta),
  warn: (message: string, meta?: LoggerData) => logger.warn(message, meta),
  error: (message: string, meta?: LoggerData) => logger.error(message, meta),
  debug: (message: string, meta?: LoggerData) => logger.debug(message, meta),
};

export default logger;
