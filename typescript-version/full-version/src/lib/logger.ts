import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import path from 'path'

interface LoggerData {
  [key: string]: any
}

interface SocketLoggerMethods {
  connection(socketId: string, userId: string | null, ip: string, userAgent: string): void
  disconnection(socketId: string, userId: string | null): void
  joinRoom(socketId: string, userId: string | null, room: string): void
  message(socketId: string, userId: string | null, roomId: string, messageLength: number): void
  error(message: string | LoggerData, meta?: LoggerData): void
  debug(message: string | LoggerData, meta?: LoggerData): void
}

interface RateLimitLoggerMethods {
  limitApplied(userId: string, ip: string, remainingPoints: number, resetTime: number): void
  limitExceeded(userId: string, ip: string, socketId: string, msBeforeNext: number): void
  error(message: string | LoggerData, meta?: LoggerData): void
}

interface DatabaseLoggerMethods {
  queryExecuted(query: string, duration: number, userId: string | null): void
  error(message: string | LoggerData, meta?: LoggerData): void
}

interface AuthLoggerMethods {
  info(message: string | LoggerData, meta?: LoggerData): void
  warn(message: string | LoggerData, meta?: LoggerData): void
  error(message: string | LoggerData, meta?: LoggerData): void
  debug(message: string | LoggerData, meta?: LoggerData): void
}

const isClient = typeof window !== 'undefined'
let logger: winston.Logger

if (!isClient) {
  const logsDir = path.join(process.cwd(), 'logs')

  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
    defaultMeta: { service: 'materio-nextjs' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple())
      }),
      new DailyRotateFile({
        dirname: logsDir,
        filename: 'application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d'
      }),
      new DailyRotateFile({
        dirname: logsDir,
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '30d'
      })
    ]
  })
} else {
  logger = {
    info: (message: string | LoggerData, meta?: LoggerData) =>
      typeof message === 'string' ? console.log(`[INFO] ${message}`, meta) : console.log('[INFO]', message, meta),
    warn: (message: string | LoggerData, meta?: LoggerData) =>
      typeof message === 'string' ? console.warn(`[WARN] ${message}`, meta) : console.warn('[WARN]', message, meta),
    error: (message: string | LoggerData, meta?: LoggerData) =>
      typeof message === 'string' ? console.error(`[ERROR] ${message}`, meta) : console.error('[ERROR]', JSON.stringify(message, null, 2), meta),
    debug: (message: string | LoggerData, meta?: LoggerData) =>
      typeof message === 'string' ? console.debug(`[DEBUG] ${message}`, meta) : console.debug('[DEBUG]', message, meta)
  } as any
}

export const socketLogger: SocketLoggerMethods = {
  connection: (socketId, userId, ip, userAgent) =>
    logger.info('Socket connection established', { socketId, userId, ip, userAgent }),
  disconnection: (socketId, userId) => logger.info('Socket disconnection', { socketId, userId }),
  joinRoom: (socketId, userId, room) => logger.info('User joined room', { socketId, userId, room }),
  message: (socketId, userId, roomId, messageLength) => logger.info('Message sent', { socketId, userId, roomId, messageLength }),
  error: (message, meta) => logger.error(message, meta),
  debug: (message, meta) => logger.debug(message, meta)
}

export const rateLimitLogger: RateLimitLoggerMethods = {
  limitApplied: (userId, ip, remainingPoints, resetTime) => logger.info('Rate limit applied', { userId, ip, remainingPoints, resetTime }),
  limitExceeded: (userId, ip, socketId, msBeforeNext) => logger.warn('Rate limit exceeded', { userId, ip, socketId, msBeforeNext }),
  error: (message, meta) => logger.error(message, meta)
}

export const databaseLogger: DatabaseLoggerMethods = {
  queryExecuted: (query, duration, userId) => logger.info('Database query executed', { query, duration, userId }),
  error: (message, meta) => logger.error(message, meta)
}

export const authLogger: AuthLoggerMethods = {
  info: (message, meta) => logger.info(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  error: (message, meta) => logger.error(message, meta),
  debug: (message, meta) => logger.debug(message, meta)
}

export default logger
