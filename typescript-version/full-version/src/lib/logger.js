// CommonJS adapter for Winston loggers
// This allows JavaScript files to import TypeScript loggers

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Simple logger implementation for backward compatibility
class SimpleLogger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (data) {
      return `${prefix} ${message} ${JSON.stringify(data)}`;
    }

    return `${prefix} ${message}`;
  }

  debug(message, data) {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, data));
    }
  }

  info(message, data) {
    console.info(this.formatMessage('info', message, data));
  }

  warn(message, data) {
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message, data) {
    console.error(this.formatMessage('error', message, data));
  }

  // Socket-specific methods
  connection(socketId, userId, ip, userAgent) {
    this.info('Socket connection established', { socketId, userId, ip, userAgent });
  }

  disconnection(socketId, userId) {
    this.info('Socket disconnection', { socketId, userId });
  }

  joinRoom(socketId, userId, room) {
    this.info('User joined room', { socketId, userId, room });
  }

  message(socketId, userId, roomId, messageLength) {
    this.info('Message sent', { socketId, userId, roomId, messageLength });
  }
}

// Create logger instances
const logger = new SimpleLogger();

const socketLogger = {
  connection: (socketId, userId, ip, userAgent) => logger.connection(socketId, userId, ip, userAgent),
  disconnection: (socketId, userId) => logger.disconnection(socketId, userId),
  joinRoom: (socketId, userId, room) => logger.joinRoom(socketId, userId, room),
  message: (socketId, userId, roomId, messageLength) => logger.message(socketId, userId, roomId, messageLength),
  error: (message, meta) => logger.error(message, meta),
  debug: (message, meta) => logger.debug(message, meta),
};

const rateLimitLogger = {
  limitApplied: (userId, ip, remainingPoints, resetTime) =>
    logger.info('Rate limit applied', { userId, ip, remainingPoints, resetTime }),
  limitExceeded: (userId, ip, socketId, msBeforeNext) =>
    logger.warn('Rate limit exceeded', { userId, ip, socketId, msBeforeNext }),
  error: (message, meta) => logger.error(message, meta),
};

const databaseLogger = {
  queryExecuted: (query, duration, userId) =>
    logger.info('Database query executed', { query, duration, userId }),
  error: (message, meta) => logger.error(message, meta),
};

module.exports = {
  socketLogger,
  rateLimitLogger,
  databaseLogger,
  default: logger
};