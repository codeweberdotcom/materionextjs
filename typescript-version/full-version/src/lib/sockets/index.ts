import { Server as HTTPServer } from 'http'
import { Server } from 'socket.io'
import logger from '../logger'
import { websocketConnections } from '../metrics'
import { serviceConfigResolver } from '../config'
import { authenticateSocket } from './middleware/auth'
import { errorHandler, handleDisconnect, heartbeat } from './middleware/errorHandler'
import { initializeChatNamespace } from './namespaces/chat'
import { initializeNotificationNamespace } from './namespaces/notifications'
import type { ClientToServerEvents, ServerToClientEvents, TypedIOServer, TypedSocket } from './types/common'

// Глобальная переменная для хранения io instance
let io: TypedIOServer | null = null

// Активные пользователи (in-memory cache)
type ActiveUserInfo = {
  socketId: string
  connectedAt: Date
  lastActivity: Date
  role?: string
};

const activeUsers = new Map<string, ActiveUserInfo>()

// Метрики для мониторинга
const metrics = {
  activeConnections: 0,
  messagesPerSecond: 0,
  averageResponseTime: 0,
  failedConnections: 0,
  totalConnections: 0,
  totalMessages: 0,
  startTime: Date.now()
};

/**
 * Инициализация Socket.IO сервера
 * Поддерживает опциональный Redis адаптер для масштабирования
 */
export const initializeSocketServer = async (httpServer: HTTPServer): Promise<TypedIOServer> => {
  if (io) {
    logger.warn('Socket.IO server already initialized')
    return io
  }

  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL || false
        : ["http://localhost:3000"],
      methods: ["GET", "POST"],
      credentials: true
    },
    // Настройки для production
    pingTimeout: 60000,    // 60 секунд
    pingInterval: 25000,   // 25 секунд
    upgradeTimeout: 10000, // 10 секунд
    maxHttpBufferSize: 1e6, // 1MB
    allowEIO3: true,       // Поддержка Socket.IO v2 клиентов
    transports: ['websocket', 'polling']
  })

  // Опционально: добавляем Redis адаптер для масштабирования
  await setupRedisAdapter(io)

  globalThis.io = io

  logger.info('Socket.IO server initialized', {
    cors: io._opts?.cors,
    pingTimeout: io._opts?.pingTimeout,
    pingInterval: io._opts?.pingInterval,
    redisAdapter: io._opts?.adapter ? 'enabled' : 'disabled'
  })

  // Глобальные middleware
  setupGlobalMiddleware();

  // Инициализация namespaces
  initializeNamespaces();

  // Обработка подключений
  io.on('connection', handleConnection);

  // Инициализируем метрику Prometheus с текущим значением (0 при старте)
  websocketConnections.set({ environment: process.env.NODE_ENV || 'development' }, 0)

  // Graceful shutdown
  setupGracefulShutdown()

  return io!
}

/**
 * Настройка Redis адаптера для Socket.IO (опционально, для масштабирования)
 */
async function setupRedisAdapter(ioServer: TypedIOServer): Promise<void> {
  try {
    // Получаем конфигурацию Redis через ServiceConfigResolver
    // Приоритет: Admin (БД) → ENV (.env) → Default (Docker)
    const redisConfig = await serviceConfigResolver.getConfig('redis')

    if (!redisConfig.url) {
      logger.info('[Socket.IO] Redis not configured, using in-memory adapter (single server mode)')
      return
    }

    // Динамический импорт адаптера
    const { createAdapter } = await import('@socket.io/redis-adapter')
    const Redis = (await import('ioredis')).default

    // Создаем два клиента (pub/sub для Redis адаптера)
    // ioredis v5 подключается автоматически (lazy connect)
    const pubClient = new Redis(redisConfig.url, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      lazyConnect: true,
      ...(redisConfig.tls ? { tls: { rejectUnauthorized: false } } : {})
    })

    const subClient = pubClient.duplicate()

    // Обработка ошибок
    pubClient.on('error', (error) => {
      logger.error('[Socket.IO Redis Adapter] Pub client error', { error: error.message })
    })

    subClient.on('error', (error) => {
      logger.error('[Socket.IO Redis Adapter] Sub client error', { error: error.message })
    })

    // Подключаемся (явно, так как lazyConnect: true)
    await Promise.all([
      pubClient.connect().catch(err => {
        logger.error('[Socket.IO Redis Adapter] Failed to connect pub client', { error: err.message })
        throw err
      }),
      subClient.connect().catch(err => {
        logger.error('[Socket.IO Redis Adapter] Failed to connect sub client', { error: err.message })
        throw err
      })
    ])

    // Устанавливаем адаптер
    ioServer.adapter(createAdapter(pubClient, subClient))

    logger.info('[Socket.IO] Redis adapter enabled for scaling', {
      source: redisConfig.source,
      host: redisConfig.host,
      port: redisConfig.port
    })
  } catch (error) {
    logger.warn('[Socket.IO] Failed to setup Redis adapter, using in-memory adapter', {
      error: error instanceof Error ? error.message : String(error)
    })
    // Продолжаем без Redis адаптера (single server mode)
  }
}

/**
 * Настройка глобального middleware
 */
const setupGlobalMiddleware = () => {
  if (!io) return;

  // Аутентификация для корневого namespace
  io.of('/').use(authenticateSocket);

  // Обработка ошибок (уберем пока, чтобы не было ошибок типизации)
  // io.use(errorHandler);

  // Heartbeat для всех подключений
  io.of('/').use(heartbeat);

  logger.info('Global middleware configured');
};

/**
 * Инициализация namespaces
 */
const initializeNamespaces = () => {
  if (!io) return;

  try {
    // Инициализируем namespace для чата
    initializeChatNamespace(io);

    // Инициализируем namespace для уведомлений
    initializeNotificationNamespace(io);

    logger.info('Namespaces initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize namespaces', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
};

/**
 * Синхронизация метрик с реальным количеством соединений
 */
const syncMetrics = () => {
  if (!io) return
  
  const realConnections = getTotalConnections()
  metrics.activeConnections = realConnections
  
  const environment = process.env.NODE_ENV || 'development'
  websocketConnections.set({ environment }, realConnections)
  
  logger.debug('Metrics synced', {
    realConnections,
    metricsActiveConnections: metrics.activeConnections
  })
}

/**
 * Обработка нового подключения
 */
const handleConnection = (socket: TypedSocket) => {
  metrics.totalConnections++

  // Синхронизируем метрики с реальным количеством
  syncMetrics()

  const userId = socket.data.user?.id ?? socket.userId
  const userRole = socket.data.user?.role

  logger.info('New socket connection', {
    socketId: socket.id,
    userId,
    userRole,
    totalConnections: metrics.totalConnections,
    activeConnections: metrics.activeConnections,
    ip: socket.handshake.address
  });

  // Добавляем пользователя в активные
  if (userId) {
    activeUsers.set(userId, {
      socketId: socket.id,
      connectedAt: new Date(),
      lastActivity: new Date(),
      role: userRole
    })
  }

  // Обработка отключения
  socket.on('disconnect', reason => {
    // Синхронизируем метрики с реальным количеством (после отключения)
    syncMetrics()

    if (userId) {
      activeUsers.delete(userId)
    }

    handleDisconnect(reason, socket)
  })

  // Ping для поддержания соединения
  socket.on('ping', (_data, callback) => {
    callback?.({ pong: true, timestamp: Date.now() })
  })
}

/**
 * Graceful shutdown
 */
const setupGracefulShutdown = () => {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down Socket.IO server gracefully`);

    if (io) {
      // Отключаем все соединения
      io.disconnectSockets(true);

      // Закрываем сервер
      io.close(() => {
        logger.info('Socket.IO server closed');
      });
    }

    // Очищаем активных пользователей
    activeUsers.clear();

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

/**
 * Получение экземпляра Socket.IO
 */
export const getSocketServer = (): Server | null => {
  // Сначала проверяем модульную переменную
  if (io) return io
  
  // Fallback на globalThis (для случаев, когда модуль перезагружен)
  if (typeof globalThis !== 'undefined' && globalThis.io) {
    io = globalThis.io as TypedIOServer
    return io
  }
  
  return null
};

/**
 * Получение общего количества соединений во всех namespaces
 */
export const getTotalConnections = (): number => {
  const server = getSocketServer()
  if (!server) return 0
  
  let total = 0
  // Подсчет во всех namespaces
  server._nsps.forEach((nsp) => {
    total += nsp.sockets.size
  })
  
  return total
};

/**
 * Получение активных пользователей
 */
export const getActiveUsers = () => {
  return Array.from(activeUsers.entries()).map(([userId, data]) => ({
    userId,
    ...data
  }));
};

/**
 * Получение метрик
 */
export const getSocketMetrics = () => {
  // Синхронизируем метрики перед возвратом
  syncMetrics()
  
  const uptime = Date.now() - metrics.startTime;
  return {
    ...metrics,
    uptime,
    activeUsers: activeUsers.size,
    totalConnectionsFromServer: getTotalConnections() // Реальное количество из Socket.IO
  };
};

/**
 * Отправка уведомления пользователю
 */
export const sendNotificationToUser = <TEvent extends keyof ServerToClientEvents>(
  userId: string,
  event: TEvent,
  ...args: Parameters<ServerToClientEvents[TEvent]>
) => {
  if (!io) {
    logger.warn('Socket.IO server not initialized');
    return false;
  }

  const userData = activeUsers.get(userId);
  if (!userData) {
    logger.debug('User not connected, skipping notification', { userId, event });
    return false;
  }

  try {
    io.to(userData.socketId).emit(event, ...args)
    logger.debug('Notification sent to user', { userId, event, socketId: userData.socketId })
    return true;
  } catch (error) {
    logger.error('Failed to send notification to user', {
      userId,
      event,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
};

/**
 * Отправка сообщения в комнату
 */
export const sendMessageToRoom = <TEvent extends keyof ServerToClientEvents>(
  roomId: string,
  event: TEvent,
  ...args: Parameters<ServerToClientEvents[TEvent]>
) => {
  if (!io) {
    logger.warn('Socket.IO server not initialized');
    return false;
  }

  try {
    io.to(`room_${roomId}`).emit(event, ...args)
    metrics.totalMessages++;
    logger.debug('Message sent to room', { roomId, event });
    return true;
  } catch (error) {
    logger.error('Failed to send message to room', {
      roomId,
      event,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
};

// Экспорт для использования в других модулях
export { activeUsers, metrics };
