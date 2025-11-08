// @ts-nocheck
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { ExtendedError } from 'socket.io';
import { rateLimitLogger } from '../../logger';
import { TypedSocket, RateLimitConfig } from '../types/common';

// Import logger for direct use
import logger from '../../logger';

// Глобальный rate limiter для чата
export const chatRateLimiter = new RateLimiterMemory({
  keyPrefix: 'socket_chat',
  points: 10, // 10 сообщений
  duration: 60 * 60, // за час
});

// Rate limiter для уведомлений (более мягкий)
const notificationRateLimiter = new RateLimiterMemory({
  keyPrefix: 'socket_notification',
  points: 30, // 30 уведомлений
  duration: 60 * 60, // за час
});

// Middleware для rate limiting чата
export const rateLimitChat = async (
  socket: TypedSocket,
  next: (err?: ExtendedError) => void
) => {
  try {
    if (!socket.data?.authenticated) {
      return next(new Error('Not authenticated'));
    }

    const userId = socket.data.user.id;

    const rateLimitResult = await chatRateLimiter.consume(userId);

    rateLimitLogger.limitApplied(userId, socket.handshake.address, rateLimitResult.remainingPoints, new Date(Date.now() + rateLimitResult.msBeforeNext));

    next();
  } catch (rejRes) {
    if (rejRes instanceof Error) {
      logger.warn('Chat rate limit error', {
        userId: socket.data?.user?.id,
        socketId: socket.id,
        error: rejRes.message
      });
      return next(new Error('Rate limit error'));
    }

    // Rate limit exceeded
    const rateLimitError = rejRes as any;
    const retryAfter = Math.ceil(rateLimitError.msBeforeNext / 1000);

    logger.warn('Chat rate limit exceeded', {
      userId: socket.data?.user?.id,
      socketId: socket.id,
      retryAfter,
      blockedUntil: new Date(Date.now() + rateLimitError.msBeforeNext).toISOString()
    });

    // Эмитим событие превышения лимита
    socket.emit('rateLimitExceeded', {
      error: 'Rate limit exceeded',
      retryAfter,
      blockedUntil: new Date(Date.now() + rateLimitError.msBeforeNext).toISOString()
    });

    return next(new Error('Rate limit exceeded'));
  }
};

// Middleware для rate limiting уведомлений
export const rateLimitNotification = async (
  socket: TypedSocket,
  next: (err?: ExtendedError) => void
) => {
  try {
    if (!socket.data?.authenticated) {
      return next(new Error('Not authenticated'));
    }

    const userId = socket.data.user.id;

    const rateLimitResult = await notificationRateLimiter.consume(userId);

    logger.debug('Notification rate limit check', {
      userId,
      socketId: socket.id,
      remainingPoints: rateLimitResult.remainingPoints,
      msBeforeNext: rateLimitResult.msBeforeNext
    });

    next();
  } catch (rejRes) {
    if (rejRes instanceof Error) {
      logger.warn('Notification rate limit error', {
        userId: socket.data?.user?.id,
        socketId: socket.id,
        error: rejRes.message
      });
      return next(new Error('Rate limit error'));
    }

    // Rate limit exceeded - для уведомлений просто логируем, не блокируем
    const rateLimitError = rejRes as any;
    logger.warn('Notification rate limit exceeded', {
      userId: socket.data?.user?.id,
      socketId: socket.id,
      retryAfter: Math.ceil(rateLimitError.msBeforeNext / 1000)
    });

    // Для уведомлений не эмитим ошибку, просто продолжаем
    next();
  }
};

// Универсальный rate limiter
export const createRateLimiter = (config: RateLimitConfig) => {
  return new RateLimiterMemory({
    keyPrefix: config.keyPrefix || 'socket',
    points: config.points,
    duration: config.duration,
    blockDuration: config.blockDuration
  });
};

// Middleware с кастомным rate limiter
export const rateLimitCustom = (limiter: RateLimiterMemory, eventName: string) => {
  return async (socket: TypedSocket, next: (err?: ExtendedError) => void) => {
    try {
      if (!socket.data?.authenticated) {
        return next(new Error('Not authenticated'));
      }

      const userId = socket.data.user.id;
      const rateLimitResult = await limiter.consume(userId);

      logger.debug(`${eventName} rate limit check`, {
        userId,
        socketId: socket.id,
        remainingPoints: rateLimitResult.remainingPoints,
        msBeforeNext: rateLimitResult.msBeforeNext
      });

      next();
    } catch (rejRes) {
      if (rejRes instanceof Error) {
        logger.warn(`${eventName} rate limit error`, {
          userId: socket.data?.user?.id,
          socketId: socket.id,
          error: rejRes.message
        });
        return next(new Error('Rate limit error'));
      }

      const rateLimitError = rejRes as any;
      logger.warn(`${eventName} rate limit exceeded`, {
        userId: socket.data?.user?.id,
        socketId: socket.id,
        retryAfter: Math.ceil(rateLimitError.msBeforeNext / 1000)
      });

      return next(new Error('Rate limit exceeded'));
    }
  };
};

// Получение статистики rate limiting
export const getRateLimitStats = async () => {
  // Получаем статистику из rate limiter'ов
  // Это может быть полезно для мониторинга
  return {
    chat: {
      points: chatRateLimiter.points,
      duration: chatRateLimiter.duration
    },
    notification: {
      points: notificationRateLimiter.points,
      duration: notificationRateLimiter.duration
    }
  };
};