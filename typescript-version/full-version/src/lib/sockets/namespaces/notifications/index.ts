import { Server, Namespace } from 'socket.io'
import logger from '../../../logger'
import { TypedSocket } from '../../types/common'
import {
  NotificationEvents,
  NotificationEmitEvents,
  Notification,
  NotificationMetadata
} from '../../types/notifications'
import { authenticateSocket, requirePermission } from '../../middleware/auth'
import { rateLimitNotification } from '../../middleware/rateLimit'
import { PrismaClient } from '@prisma/client'
import { parseNotificationMetadata, serializeNotificationMetadata } from '@/utils/notifications/metadata'

const prisma = new PrismaClient()

// Хранилище активных пользователей (in-memory)
const activeUsers = new Map<string, string>() // userId -> socketId

const legacyEventMap: Partial<Record<keyof NotificationEmitEvents, string>> = {
  newNotification: 'new-notification',
  notificationUpdate: 'notification-update',
  notificationDeleted: 'notification-deleted',
  notificationsRead: 'notifications-read'
}

type NotificationEventPayload<T extends keyof NotificationEmitEvents> = Parameters<
  NotificationEmitEvents[T]
>[0]

const emitNotificationEvent = <T extends keyof NotificationEmitEvents>(
  userId: string,
  event: T,
  payload: NotificationEventPayload<T>
) => {
  const io = (global as typeof globalThis & { io?: Server }).io

  if (!io) {
    logger.warn('Socket.IO server not initialized when emitting notification event', {
      event,
      userId
    })
    return
  }

  const namespace = io.of('/notifications')
  namespace.to(`user_${userId}`).emit(event, payload)

  const legacyEvent = legacyEventMap[event]
  if (legacyEvent) {
    namespace.to(`user_${userId}`).emit(legacyEvent, payload)
  }
}

const toNotificationPayload = (notification: {
  id: string
  title: string
  message: string
  type: string
  status: string
  userId: string
  createdAt: Date
  updatedAt: Date
  readAt: Date | null
  metadata: unknown
  avatarImage?: string | null
  avatarIcon?: string | null
  avatarText?: string | null
  avatarColor?: string | null
  avatarSkin?: string | null
}): Notification => ({
  id: notification.id,
  title: notification.title,
  message: notification.message,
  type: notification.type as Notification['type'],
  status: notification.status as Notification['status'],
  userId: notification.userId,
  createdAt: notification.createdAt.toISOString(),
  updatedAt: notification.updatedAt.toISOString(),
  readAt: notification.readAt ? notification.readAt.toISOString() : undefined,
  metadata: parseNotificationMetadata(notification.metadata) as NotificationMetadata,
  avatarImage: notification.avatarImage || undefined,
  avatarIcon: notification.avatarIcon || undefined,
  avatarText: notification.avatarText || undefined,
  avatarColor: notification.avatarColor || undefined,
  avatarSkin: notification.avatarSkin || undefined
})

/**
 * Инициализация namespace для уведомлений
 */
export const initializeNotificationNamespace = (io: Server): Namespace => {
  const notificationNamespace = io.of('/notifications');

  logger.info('Initializing notification namespace');

  // Middleware для уведомлений
  notificationNamespace.use(authenticateSocket);
  notificationNamespace.use(requirePermission('receive_notifications'));

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
      logger.debug('Processing markAsRead', { userId, notificationId: data.notificationId })

      if (data.userId !== userId) {
        socket.emit('error', { message: 'Access denied' })
        return
      }

      const notification = await prisma.notification.findFirst({
        where: {
          id: data.notificationId,
          userId
        }
      })

      if (!notification) {
        socket.emit('error', { message: 'Notification not found' })
        return
      }

      const readAt = notification.readAt ?? new Date()
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'read',
          readAt
        }
      })

      emitNotificationEvent(userId, 'notificationUpdate', {
        notificationId: data.notificationId,
        updates: {
          status: 'read',
          readAt: readAt.toISOString()
        },
        userId
      })

      logger.info('Notification marked as read', {
        notificationId: data.notificationId,
        userId
      })
    } catch (error) {
      logger.error('Failed to mark notification as read', {
        userId,
        notificationId: data.notificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      socket.emit('error', { message: 'Failed to mark notification as read' })
    }
  })

  // Отметка всех уведомлений как прочитанные
  socket.on('markAllAsRead', async (userIdParam: string) => {
    try {
      logger.debug('Processing markAllAsRead', { userId, userIdParam })

      if (userIdParam !== userId) {
        socket.emit('error', { message: 'Access denied' })
        return
      }

      const unreadNotifications = await prisma.notification.findMany({
        where: {
          userId,
          status: 'unread'
        },
        select: { id: true }
      })

      if (unreadNotifications.length === 0) {
        emitNotificationEvent(userId, 'notificationsRead', {
          userId,
          count: 0,
          notificationIds: []
        })
        return
      }

      await prisma.notification.updateMany({
        where: {
          id: {
            in: unreadNotifications.map(notification => notification.id)
          }
        },
        data: {
          status: 'read',
          readAt: new Date()
        }
      })

      const notificationIds = unreadNotifications.map(notification => notification.id)

      emitNotificationEvent(userId, 'notificationsRead', {
        userId,
        count: notificationIds.length,
        notificationIds
      })

      logger.info('All notifications marked as read', {
        userId,
        count: notificationIds.length
      })
    } catch (error) {
      logger.error('Failed to mark all notifications as read', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      socket.emit('error', { message: 'Failed to mark all notifications as read' })
    }
  })

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

      emitNotificationEvent(userId, 'notificationDeleted', {
        notificationId: data.notificationId,
        userId
      })

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
        userId: userId,
        metadata: serializeNotificationMetadata(notificationData.metadata)
      }
    });

    emitNotificationEvent(userId, 'newNotification', toNotificationPayload(notification))

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
    title: string
    message: string
    type?: string
    userId: string
    metadata?: any
  }>
): Promise<boolean> => {
  try {
    const createdNotifications = await prisma.$transaction(
      notifications.map(notification =>
        prisma.notification.create({
          data: {
            title: notification.title,
            message: notification.message,
            type: notification.type || 'info',
            status: 'unread',
            userId: notification.userId,
            metadata: serializeNotificationMetadata(notification.metadata)
          }
        })
      )
    )

    createdNotifications.forEach(notification => {
      emitNotificationEvent(notification.userId, 'newNotification', toNotificationPayload(notification))
    })

    logger.info('Bulk notifications created', {
      count: notifications.length,
      usersCount: new Set(notifications.map(notification => notification.userId)).size
    })

    return true
  } catch (error) {
    logger.error('Failed to create bulk notifications', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}
