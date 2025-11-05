import { Server, Namespace } from 'socket.io';
import logger from '../../../logger';
import { TypedSocket } from '../../types/common';
import { NotificationEvents, NotificationEmitEvents, Notification } from '../../types/notifications';
import { requirePermission } from '../../middleware/auth';
import { rateLimitNotification } from '../../middleware/rateLimit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Хранилище активных пользователей (in-memory)
const activeUsers = new Map<string, string>(); // userId -> socketId

/**
 * Инициализация namespace для уведомлений
 */
export const initializeNotificationNamespace = (io: Server): Namespace => {
  const notificationNamespace = io.of('/notifications');

  logger.info('Initializing notification namespace');

  // Middleware для уведомлений
  notificationNamespace.use(requirePermission('send_notification'));

  // Rate limiting для уведомлений (более мягкий)
  notificationNamespace.use(rateLimitNotification);

  // Обработка подключения к namespace уведомлений
  notificationNamespace.on('connection', (socket: TypedSocket) => {
    const userId = socket.data.user.id;
    const userRole = socket.data.user.role;

    logger.info('User connected to notification namespace', {
      socketId: socket.id,
      userId,
      userRole
    });

    // Добавляем пользователя в активные
    activeUsers.set(userId, socket.id);

    // Присоединяемся к личной комнате пользователя
    socket.join(`user_${userId}`);

    // Регистрируем обработчики событий
    registerNotificationEventHandlers(socket);

    // Обработка отключения
    socket.on('disconnect', () => {
      logger.info('User disconnected from notification namespace', {
        socketId: socket.id,
        userId
      });
      activeUsers.delete(userId);
    });
  });

  return notificationNamespace;
};

/**
 * Регистрация обработчиков событий уведомлений
 */
const registerNotificationEventHandlers = (socket: TypedSocket) => {
  const userId = socket.data.user.id;

  // Отметка уведомления как прочитанное
  socket.on('markAsRead', async (data: { notificationId: string; userId: string }) => {
    try {
      logger.debug('Processing markAsRead', { userId, notificationId: data.notificationId });

      // Проверяем, что уведомление принадлежит пользователю
      if (data.userId !== userId) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Обновляем статус уведомления
      const updatedNotification = await prisma.notification.updateMany({
        where: {
          id: data.notificationId,
          userId: userId
        },
        data: {
          status: 'read'
        }
      });

      if (updatedNotification.count === 0) {
        socket.emit('error', { message: 'Notification not found' });
        return;
      }

      // Получаем обновленное уведомление
      const notification = await prisma.notification.findUnique({
        where: { id: data.notificationId }
      });

      if (notification) {
        // Уведомляем пользователя об обновлении
        socket.emit('notificationUpdate', {
          notificationId: data.notificationId,
          updates: {
            status: 'read',
            readAt: new Date().toISOString()
          },
          userId
        });

        logger.info('Notification marked as read', {
          notificationId: data.notificationId,
          userId
        });
      }

    } catch (error) {
      logger.error('Failed to mark notification as read', {
        userId,
        notificationId: data.notificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      socket.emit('error', { message: 'Failed to mark notification as read' });
    }
  });

  // Отметка всех уведомлений как прочитанные
  socket.on('markAllAsRead', async (userIdParam: string) => {
    try {
      logger.debug('Processing markAllAsRead', { userId, userIdParam });

      // Проверяем, что пользователь обновляет свои уведомления
      if (userIdParam !== userId) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Обновляем все непрочитанные уведомления пользователя
      const result = await prisma.notification.updateMany({
        where: {
          userId: userId,
          status: 'unread'
        },
        data: {
          status: 'read'
        }
      });

      // Уведомляем пользователя
      socket.emit('notificationsRead', {
        userId,
        count: result.count,
        notificationIds: [] // Можно получить IDs если нужно
      });

      logger.info('All notifications marked as read', {
        userId,
        count: result.count
      });

    } catch (error) {
      logger.error('Failed to mark all notifications as read', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      socket.emit('error', { message: 'Failed to mark all notifications as read' });
    }
  });

  // Удаление уведомления
  socket.on('deleteNotification', async (data: { notificationId: string; userId: string }) => {
    try {
      logger.debug('Processing deleteNotification', { userId, notificationId: data.notificationId });

      // Проверяем, что уведомление принадлежит пользователю
      if (data.userId !== userId) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Удаляем уведомление
      const deletedNotification = await prisma.notification.deleteMany({
        where: {
          id: data.notificationId,
          userId: userId
        }
      });

      if (deletedNotification.count === 0) {
        socket.emit('error', { message: 'Notification not found' });
        return;
      }

      // Уведомляем пользователя об удалении
      socket.emit('notificationDeleted', {
        notificationId: data.notificationId,
        userId
      });

      logger.info('Notification deleted', {
        notificationId: data.notificationId,
        userId
      });

    } catch (error) {
      logger.error('Failed to delete notification', {
        userId,
        notificationId: data.notificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      socket.emit('error', { message: 'Failed to delete notification' });
    }
  });

  // Ping для поддержания соединения
  socket.on('ping', (data, callback) => {
    if (callback) {
      callback({ pong: true, timestamp: Date.now() });
    }
  });
};

/**
 * Отправка уведомления пользователю
 */
export const sendNotificationToUser = async (
  userId: string,
  notificationData: {
    title: string;
    message: string;
    type?: string;
    metadata?: any;
  }
): Promise<boolean> => {
  try {
    // Создаем уведомление в БД
    const notification = await prisma.notification.create({
      data: {
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type || 'info',
        status: 'unread',
        userId: userId
      }
    });

    // Отправляем через Socket.IO если пользователь онлайн
    const socketId = activeUsers.get(userId);
    if (socketId) {
      const io = (global as any).io;
      if (io) {
        const notificationPayload: Notification = {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type as any,
          status: notification.status as any,
          userId: notification.userId,
          createdAt: notification.createdAt.toISOString(),
          updatedAt: notification.updatedAt.toISOString(),
          readAt: undefined, // В схеме Prisma нет readAt
          metadata: {} // В схеме Prisma нет metadata
        };

        io.of('/notifications').to(`user_${userId}`).emit('newNotification', notificationPayload);

        logger.info('Notification sent to online user', {
          notificationId: notification.id,
          userId,
          socketId
        });
      }
    } else {
      logger.debug('User not online, notification stored in DB', {
        notificationId: notification.id,
        userId
      });
    }

    return true;
  } catch (error) {
    logger.error('Failed to send notification', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
};

/**
 * Получение активных пользователей уведомлений
 */
export const getActiveNotificationUsers = () => {
  return Array.from(activeUsers.entries()).map(([userId, socketId]) => ({
    userId,
    socketId
  }));
};

/**
 * Массовое создание уведомлений
 */
export const createBulkNotifications = async (
  notifications: Array<{
    title: string;
    message: string;
    type?: string;
    userId: string;
    metadata?: any;
  }>
): Promise<boolean> => {
  try {
    // Создаем уведомления в БД
    const createdNotifications = await prisma.notification.createMany({
      data: notifications.map(n => ({
        title: n.title,
        message: n.message,
        type: n.type || 'info',
        status: 'unread',
        userId: n.userId,
        metadata: n.metadata || {}
      }))
    });

    // Группируем по пользователям и отправляем
    const notificationsByUser = notifications.reduce((acc, notification, index) => {
      if (!acc[notification.userId]) {
        acc[notification.userId] = [];
      }
      acc[notification.userId].push({ ...notification, index });
      return acc;
    }, {} as Record<string, any[]>);

    // Отправляем уведомления онлайн пользователям
    const io = (global as any).io;
    if (io) {
      for (const [userId, userNotifications] of Object.entries(notificationsByUser)) {
        const socketId = activeUsers.get(userId);
        if (socketId) {
          // Отправляем каждое уведомление
          for (const notification of userNotifications) {
            const notificationPayload: Notification = {
              id: `temp_${Date.now()}_${Math.random()}`, // Временный ID
              title: notification.title,
              message: notification.message,
              type: notification.type as any || 'info',
              status: 'unread',
              userId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              metadata: notification.metadata
            };

            io.of('/notifications').to(`user_${userId}`).emit('newNotification', notificationPayload);
          }
        }
      }
    }

    logger.info('Bulk notifications created', {
      count: notifications.length,
      usersCount: Object.keys(notificationsByUser).length
    });

    return true;
  } catch (error) {
    logger.error('Failed to create bulk notifications', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
};