import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import logger from '../logger';
import { authenticateSocket } from './middleware/auth';
import { errorHandler, handleDisconnect, heartbeat } from './middleware/errorHandler';

// Импорты namespaces
import { initializeChatNamespace } from './namespaces/chat';
import { initializeNotificationNamespace } from './namespaces/notifications';

// Глобальная переменная для хранения io instance
let io: Server | null = null;

// Активные пользователи (in-memory cache)
type ActiveUserInfo = {
  socketId: string
  connectedAt: Date
  lastActivity: Date
  role?: string
};

const activeUsers = new Map<string, ActiveUserInfo>();

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
 */
export const initializeSocketServer = (httpServer: HTTPServer): Server => {
  if (io) {
    logger.warn('Socket.IO server already initialized');
    return io;
  }

  // Создаем Socket.IO сервер
  io = new Server(httpServer, {
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
  });

  logger.info('Socket.IO server initialized', {
    cors: io._opts?.cors,
    pingTimeout: io._opts?.pingTimeout,
    pingInterval: io._opts?.pingInterval
  });

  // Глобальные middleware
  setupGlobalMiddleware();

  // Инициализация namespaces
  initializeNamespaces();

  // Обработка подключений
  io.on('connection', handleConnection);

  // Graceful shutdown
  setupGracefulShutdown();

  return io;
};

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
 * Обработка нового подключения
 */
const handleConnection = (socket: Socket) => {
  metrics.activeConnections++;
  metrics.totalConnections++;

  const userId = (socket.data as { user?: { id?: string } }).user?.id ?? (socket as Socket & { userId?: string }).userId
  const userRole = (socket.data as { user?: { role?: string } }).user?.role

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
    });
  }

  // Обработка отключения
  socket.on('disconnect', (reason) => {
    metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);

    if (userId) {
      activeUsers.delete(userId);
    }

    handleDisconnect(reason, socket as Socket & { userId?: string });
  });

  // Ping для поддержания соединения
  socket.on('ping', (data, callback) => {
    if (callback) {
      callback({ pong: true, timestamp: Date.now() });
    }
  });
};

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
  return io;
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
  const uptime = Date.now() - metrics.startTime;
  return {
    ...metrics,
    uptime,
    activeUsers: activeUsers.size
  };
};

/**
 * Отправка уведомления пользователю
 */
export const sendNotificationToUser = <TPayload>(userId: string, event: string, data: TPayload) => {
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
    io.to(userData.socketId).emit(event, data);
    logger.debug('Notification sent to user', { userId, event, socketId: userData.socketId });
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
export const sendMessageToRoom = <TPayload>(roomId: string, event: string, data: TPayload) => {
  if (!io) {
    logger.warn('Socket.IO server not initialized');
    return false;
  }

  try {
    io.to(`room_${roomId}`).emit(event, data);
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
