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

interface NotificationsLoggerMethods {
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
  const noop = () => {}
  logger = {
    info: (message: string | LoggerData, meta?: LoggerData) =>
      typeof message === 'string' ? console.log(`[INFO] ${message}`, meta) : console.log('[INFO]', message, meta),
    warn: (message: string | LoggerData, meta?: LoggerData) =>
      typeof message === 'string' ? console.warn(`[WARN] ${message}`, meta) : console.warn('[WARN]', message, meta),
    error: (message: string | LoggerData, meta?: LoggerData) => {
      if (typeof message === 'string') {
        console.error(`[ERROR] ${message}`, meta)
      } else {
        try {
          console.error('[ERROR]', JSON.stringify(message, null, 2), meta)
        } catch (e) {
          console.error('[ERROR] [Non-serializable object]', message, meta)
        }
      }
    },
    debug: (message: string | LoggerData, meta?: LoggerData) =>
      typeof message === 'string' ? console.debug(`[DEBUG] ${message}`, meta) : console.debug('[DEBUG]', message, meta),
    close: noop,
    add: noop,
    remove: noop,
    clear: noop,
    log: noop,
    profile: noop,
    configure: noop,
    emit: noop,
    end: noop,
    rejections: noop,
    exceptions: noop,
    transports: []
  } as unknown as winston.Logger
}

const emitLog = (level: 'info' | 'warn' | 'error' | 'debug', message: string | LoggerData, meta?: LoggerData) => {
  const normalizedMessage = typeof message === 'string' ? message : safeStringify(message)

  switch (level) {
    case 'info':
      logger.info(normalizedMessage, meta)
      break
    case 'warn':
      logger.warn(normalizedMessage, meta)
      break
    case 'error':
      logger.error(normalizedMessage, meta)
      break
    case 'debug':
      logger.debug(normalizedMessage, meta)
      break
  }
}

const safeStringify = (obj: any): string => {
  try {
    return JSON.stringify(obj)
  } catch (e) {
    return '[Non-serializable object]'
  }
}

const logInfo = (message: string | LoggerData, meta?: LoggerData) => emitLog('info', message, meta)
const logWarn = (message: string | LoggerData, meta?: LoggerData) => emitLog('warn', message, meta)
const logError = (message: string | LoggerData, meta?: LoggerData) => emitLog('error', message, meta)
const logDebug = (message: string | LoggerData, meta?: LoggerData) => emitLog('debug', message, meta)

export const socketLogger: SocketLoggerMethods = {
  connection: (socketId, userId, ip, userAgent) =>
    logInfo('Socket connection established', { socketId, userId, ip, userAgent }),
  disconnection: (socketId, userId) => logInfo('Socket disconnection', { socketId, userId }),
  joinRoom: (socketId, userId, room) => logInfo('User joined room', { socketId, userId, room }),
  message: (socketId, userId, roomId, messageLength) => logInfo('Message sent', { socketId, userId, roomId, messageLength }),
  error: (message, meta) => logError(message, meta),
  debug: (message, meta) => logDebug(message, meta)
}

export const rateLimitLogger: RateLimitLoggerMethods = {
  limitApplied: (userId, ip, remainingPoints, resetTime) => logInfo('Rate limit applied', { userId, ip, remainingPoints, resetTime }),
  limitExceeded: (userId, ip, socketId, msBeforeNext) => logWarn('Rate limit exceeded', { userId, ip, socketId, msBeforeNext }),
  error: (message, meta) => logError(message, meta)
}

export const databaseLogger: DatabaseLoggerMethods = {
  queryExecuted: (query, duration, userId) => logInfo('Database query executed', { query, duration, userId }),
  error: (message, meta) => logError(message, meta)
}

export const authLogger: AuthLoggerMethods = {
  info: (message, meta) => logInfo(message, meta),
  warn: (message, meta) => logWarn(message, meta),
  error: (message, meta) => logError(message, meta),
  debug: (message, meta) => logDebug(message, meta)
}

export const notificationsLogger: NotificationsLoggerMethods = {
  info: (message, meta) => logInfo(message, meta),
  warn: (message, meta) => logWarn(message, meta),
  error: (message, meta) => logError(message, meta),
  debug: (message, meta) => logDebug(message, meta)
}

export default logger
