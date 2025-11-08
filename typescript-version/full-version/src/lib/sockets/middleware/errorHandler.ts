import { ExtendedError } from 'socket.io';
import logger from '../../logger';
import { TypedSocket } from '../types/common';

// Middleware для централизованной обработки ошибок
export const errorHandler = (
  error: ExtendedError,
  socket: TypedSocket,
  next: (err?: ExtendedError) => void
) => {
  const errorMessage = error.message || 'Unknown error';
  const errorCode = (error as any).code || 'INTERNAL_ERROR';

  logger.error('Socket error occurred', {
    socketId: socket.id,
    userId: socket.userId,
    error: errorMessage,
    code: errorCode,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Эмитим ошибку клиенту
  socket.emit('error', {
    message: errorMessage,
    code: errorCode,
    timestamp: new Date().toISOString()
  });

  // Для критичных ошибок отключаем сокет
  if (errorCode === 'AUTHENTICATION_FAILED' || errorCode === 'INVALID_TOKEN') {
    logger.warn('Disconnecting socket due to critical error', {
      socketId: socket.id,
      userId: socket.userId,
      errorCode
    });
    socket.disconnect(true);
  }

  // Продолжаем выполнение, чтобы не прерывать поток
  next(error);
};

// Middleware для логирования всех событий
export const eventLogger = (eventName: string) => {
  return (socket: TypedSocket, ...args: any[]) => {
    logger.debug(`Socket event: ${eventName}`, {
      socketId: socket.id,
      userId: socket.userId,
      eventName,
      argsCount: args.length,
      timestamp: new Date().toISOString()
    });
  };
};

// Middleware для валидации данных
export const validateData = (schema: any) => {
  return (socket: TypedSocket, data: any, next: (err?: ExtendedError) => void) => {
    try {
      // Здесь можно добавить валидацию с помощью Joi, Yup и т.д.
      // Пока просто базовая проверка
      if (!data || typeof data !== 'object') {
        return next(new Error('Invalid data format'));
      }

      // Обновляем время активности
      if (socket.data) {
        socket.data.lastActivity = new Date();
      }

      next();
    } catch (error) {
      logger.warn('Data validation failed', {
        socketId: socket.id,
        userId: socket.userId,
        error: error instanceof Error ? error.message : 'Validation error'
      });
      next(new Error('Data validation failed'));
    }
  };
};

// Middleware для обработки отключений
export const handleDisconnect = (reason: string, socket: TypedSocket) => {
  logger.info('Socket disconnected', {
    socketId: socket.id,
    userId: socket.userId,
    reason,
    connectedAt: socket.data?.connectedAt,
    lastActivity: socket.data?.lastActivity,
    connectionDuration: socket.data ?
      Date.now() - socket.data.connectedAt.getTime() : null
  });

  // Здесь можно добавить логику очистки ресурсов
  // Например, удаление из активных пользователей, выход из комнат и т.д.
};

// Middleware для heartbeat проверки
export const heartbeat = (socket: TypedSocket, next: (err?: ExtendedError) => void) => {
  let heartbeatInterval: NodeJS.Timeout;

  // Устанавливаем интервал heartbeat
  const startHeartbeat = () => {
    heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const lastActivity = socket.data?.lastActivity?.getTime() || 0;
      const timeSinceLastActivity = now - lastActivity;

      // Если нет активности более 30 минут, отключаем
      if (timeSinceLastActivity > 30 * 60 * 1000) {
        logger.warn('Socket disconnected due to inactivity', {
          socketId: socket.id,
          userId: socket.userId,
          timeSinceLastActivity
        });
        socket.disconnect(true);
        return;
      }

      // Отправляем ping
      socket.emit('ping', { timestamp: now });
    }, 5 * 60 * 1000); // Каждые 5 минут
  };

  // Останавливаем heartbeat при отключении
  socket.on('disconnect', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
  });

  // Запускаем heartbeat
  startHeartbeat();

  next();
};

// Утилита для создания кастомных ошибок
export class SocketError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string = 'INTERNAL_ERROR', statusCode: number = 500) {
    super(message);
    this.name = 'SocketError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Фабрика для создания типичных ошибок
export const createError = {
  authentication: (message: string = 'Authentication failed') =>
    new SocketError(message, 'AUTHENTICATION_FAILED', 401),

  authorization: (message: string = 'Insufficient permissions') =>
    new SocketError(message, 'AUTHORIZATION_FAILED', 403),

  validation: (message: string = 'Invalid data') =>
    new SocketError(message, 'VALIDATION_FAILED', 400),

  rateLimit: (message: string = 'Rate limit exceeded') =>
    new SocketError(message, 'RATE_LIMIT_EXCEEDED', 429),

  notFound: (message: string = 'Resource not found') =>
    new SocketError(message, 'NOT_FOUND', 404),

  internal: (message: string = 'Internal server error') =>
    new SocketError(message, 'INTERNAL_ERROR', 500)
};