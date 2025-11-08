import { Server, Namespace } from 'socket.io';
import logger from '../../../logger';
import { TypedSocket } from '../../types/common';
import { ChatEvents, ChatEmitEvents, ChatMessage, ChatRoom } from '../../types/chat';
import { authenticateSocket, requirePermission, requireRole } from '../../middleware/auth';
import { chatRateLimiter } from '../../middleware/rateLimit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Хранилище активных пользователей (in-memory)
const activeUsers = new Map<string, string>(); // userId -> socketId
const onlineUsers = new Map<string, { socketId: string; connectedAt: Date }>(); // userId -> { socketId, connectedAt }

/**
 * Обновление статуса пользователя онлайн/оффлайн
 */
const updateUserOnlineStatus = async (userId: string, isOnline: boolean) => {
  try {
    if (isOnline) {
      // Пользователь онлайн - очищаем last_seen
      await prisma.user.update({
        where: { id: userId },
        data: { lastSeen: null }
      });
      logger.debug('User status updated to online', { userId });
    } else {
      // Пользователь оффлайн - устанавливаем last_seen
      await prisma.user.update({
        where: { id: userId },
        data: { lastSeen: new Date() }
      });
      logger.debug('User status updated to offline', { userId });
    }
  } catch (error) {
    logger.error('Failed to update user online status', {
      userId,
      isOnline,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Инициализация namespace для чата
 */
export const initializeChatNamespace = (io: Server): Namespace => {
  const chatNamespace = io.of('/chat');

  logger.info('Initializing chat namespace');

  // Middleware для чата
  chatNamespace.use(authenticateSocket);
  chatNamespace.use(requirePermission('send_message'));

  // Обработка подключения к namespace чата
  chatNamespace.on('connection', async (socket: TypedSocket) => {
    const userId = socket.data.user.id;
    const userRole = socket.data.user.role;

    logger.info('User connected to chat namespace', {
      socketId: socket.id,
      userId,
      userRole
    });

    // Добавляем пользователя в активные
    activeUsers.set(userId, socket.id);
    onlineUsers.set(userId, { socketId: socket.id, connectedAt: new Date() });

    // Обновляем статус пользователя как онлайн
    await updateUserOnlineStatus(userId, true);

    // Присоединяемся к личной комнате пользователя
    socket.join(`user_${userId}`);

    // Получаем комнаты пользователя и присоединяемся к ним
    joinUserRooms(socket, userId);

    // Регистрируем обработчики событий
    registerChatEventHandlers(socket);

    // Обработка отключения
    socket.on('disconnect', async () => {
      logger.info('User disconnected from chat namespace', {
        socketId: socket.id,
        userId
      });
      activeUsers.delete(userId);
      onlineUsers.delete(userId);

      // Обновляем статус пользователя как оффлайн
      await updateUserOnlineStatus(userId, false);
    });

    // Отправляем подтверждение подключения
    socket.emit('connected', { userId, status: 'connected' });
  });

  return chatNamespace;
};

/**
 * Присоединение пользователя к его комнатам
 */
const joinUserRooms = async (socket: TypedSocket, userId: string) => {
  try {
    const userRooms = await prisma.chatRoom.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      }
    });

    userRooms.forEach(room => {
      socket.join(`room_${room.id}`);
      logger.debug('User joined room', { userId, roomId: room.id, socketId: socket.id });
    });

    logger.info('User joined rooms', {
      userId,
      roomCount: userRooms.length,
      rooms: userRooms.map(r => r.id)
    });
  } catch (error) {
    logger.error('Failed to join user rooms', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Регистрация обработчиков событий чата
 */
const registerChatEventHandlers = (socket: TypedSocket) => {
  const userId = socket.data.user.id;

  // Отправка сообщения
  socket.on('sendMessage', async (data: { roomId: string; message: string; senderId: string; clientId?: string }) => {
    try {
      logger.info('Processing sendMessage', { userId, roomId: data.roomId, socketId: socket.id, connected: socket.connected });

      // Проверяем rate limit (временно отключен для тестирования)
      /*
      try {
        await chatRateLimiter.consume(userId);
        logger.debug('Rate limit check passed for sendMessage', { userId });
      } catch (rejRes) {
        const rateLimitError = rejRes as any;
        const retryAfter = Math.ceil(rateLimitError.msBeforeNext / 1000);

        logger.warn('Chat rate limit exceeded for sendMessage', {
          userId,
          socketId: socket.id,
          retryAfter,
          blockedUntil: new Date(Date.now() + rateLimitError.msBeforeNext).toISOString()
        });

        socket.emit('rateLimitExceeded', {
          error: 'Rate limit exceeded',
          retryAfter,
          blockedUntil: new Date(Date.now() + rateLimitError.msBeforeNext).toISOString()
        });
        return;
      }
      */

      // Валидация данных
      if (!data.roomId || !data.message || !data.senderId) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      if (data.message.length > 1000) {
        socket.emit('error', { message: 'Message too long' });
        return;
      }

      // Проверяем, что пользователь в комнате
      const room = await prisma.chatRoom.findFirst({
        where: {
          id: data.roomId,
          OR: [
            { user1Id: userId },
            { user2Id: userId }
          ]
        }
      });

      if (!room) {
        socket.emit('error', { message: 'Access denied to room' });
        return;
      }

      // Сохраняем сообщение в БД
      const newMessage = await prisma.message.create({
        data: {
          content: data.message,
          senderId: data.senderId,
          roomId: data.roomId
        },
        include: {
          sender: true
        }
      });

      // Отправляем сообщение в комнату
      const messageData: ChatMessage = {
        id: newMessage.id,
        content: newMessage.content,
        senderId: newMessage.senderId,
        sender: {
          id: newMessage.sender.id,
          name: newMessage.sender.name || undefined,
          email: newMessage.sender.email
        },
        roomId: newMessage.roomId,
        readAt: newMessage.readAt?.toISOString(),
        createdAt: newMessage.createdAt.toISOString(),
        clientId: data.clientId // Передаем clientId обратно для дедупликации оптимистичных сообщений
      };

      console.log('📤 [CHAT] Emitting receiveMessage to room:', {
        roomId: data.roomId,
        messageId: messageData.id,
        content: messageData.content,
        senderId: messageData.senderId
      });

      // Отправляем сообщение всем участникам комнаты, включая отправителя
      socket.nsp.to(`room_${data.roomId}`).emit('receiveMessage', messageData);

      logger.info('Message sent successfully', {
        messageId: newMessage.id,
        roomId: data.roomId,
        senderId: data.senderId
      });

    } catch (error) {
      logger.error('Failed to send message', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Создание или получение комнаты
  socket.on('getOrCreateRoom', async (data: { user1Id: string; user2Id: string }) => {
    try {
      logger.debug('Processing getOrCreateRoom', { userId, user1Id: data.user1Id, user2Id: data.user2Id });

      // Проверяем, что текущий пользователь участвует в комнате
      if (data.user1Id !== userId && data.user2Id !== userId) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Ищем существующую комнату
      let room = await prisma.chatRoom.findFirst({
        where: {
          OR: [
            { user1Id: data.user1Id, user2Id: data.user2Id },
            { user1Id: data.user2Id, user2Id: data.user1Id }
          ]
        }
      });

      // Создаем комнату, если не существует
      if (!room) {
        room = await prisma.chatRoom.create({
          data: {
            user1Id: data.user1Id,
            user2Id: data.user2Id
          }
        });

        logger.info('Created new chat room', { roomId: room.id, user1Id: data.user1Id, user2Id: data.user2Id });
      }

      // Получаем сообщения комнаты
      const messages = await prisma.message.findMany({
        where: { roomId: room.id },
        include: { sender: true },
        orderBy: { createdAt: 'asc' },
        take: 50 // Ограничиваем количество сообщений
      });

      const roomData = {
        room: {
          id: room.id,
          user1Id: room.user1Id,
          user2Id: room.user2Id,
          createdAt: room.createdAt.toISOString(),
          updatedAt: room.updatedAt.toISOString()
        },
        messages: messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          senderId: msg.senderId,
          sender: msg.sender,
          roomId: msg.roomId,
          readAt: msg.readAt,
          createdAt: msg.createdAt.toISOString()
        }))
      };

      socket.emit('roomData', roomData);

      // Присоединяем пользователей к комнате через основной io
      const io = socket.nsp.server;
      const socket1 = activeUsers.get(data.user1Id);
      const socket2 = activeUsers.get(data.user2Id);

      if (socket1) {
        io.of('/chat').sockets.get(socket1)?.join(`room_${room.id}`);
      }
      if (socket2) {
        io.of('/chat').sockets.get(socket2)?.join(`room_${room.id}`);
      }

    } catch (error) {
      logger.error('Failed to get/create room', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      socket.emit('error', { message: 'Failed to get/create room' });
    }
  });

  // Отметка сообщений как прочитанные
  socket.on('markMessagesRead', async (data: { roomId: string; userId: string }) => {
    try {
      logger.debug('Processing markMessagesRead', { userId, roomId: data.roomId });

      // Проверяем доступ к комнате
      const room = await prisma.chatRoom.findFirst({
        where: {
          id: data.roomId,
          OR: [
            { user1Id: userId },
            { user2Id: userId }
          ]
        }
      });

      if (!room) {
        socket.emit('error', { message: 'Access denied to room' });
        return;
      }

      // Отмечаем сообщения как прочитанные
      const result = await prisma.message.updateMany({
        where: {
          roomId: data.roomId,
          senderId: {
            not: userId // Сообщения не от текущего пользователя
          },
          readAt: null
        },
        data: {
          readAt: new Date()
        }
      });

      // Уведомляем других пользователей в комнате
      socket.to(`room_${data.roomId}`).emit('messagesRead', {
        roomId: data.roomId,
        readerId: userId,
        count: result.count
      });

      logger.info('Messages marked as read', {
        userId,
        roomId: data.roomId,
        count: result.count
      });

    } catch (error) {
      logger.error('Failed to mark messages as read', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      socket.emit('error', { message: 'Failed to mark messages as read' });
    }
  });

  // Ping для поддержания соединения и обновления lastSeen
  socket.on('ping', async (data, callback) => {
    try {
      // Обновляем lastSeen при каждом ping
      await prisma.user.update({
        where: { id: userId },
        data: { lastSeen: new Date() }
      });

      if (callback) {
        callback({ pong: true, timestamp: Date.now() });
      }
    } catch (error) {
      logger.error('Failed to update lastSeen on ping', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      if (callback) {
        callback({ pong: false, error: 'Failed to update status' });
      }
    }
  });
};

// Получение активных пользователей чата
export const getActiveChatUsers = () => {
  return Array.from(activeUsers.entries()).map(([userId, socketId]) => ({
    userId,
    socketId
  }));
};

// Получение статусов онлайн пользователей на основе lastSeen
export const getOnlineUsers = async () => {
  // Получаем всех пользователей из базы данных
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      isActive: true,
      email: true,
      country: true,
      image: true,
      name: true,
      language: true,
      currency: true,
      roleId: true,
      password: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      lastSeen: true
    }
  });

  // Создаем Map статусов для всех пользователей
  const userStatuses: { [userId: string]: { isOnline: boolean; lastSeen?: string } } = {};
  const now = new Date();

  for (const user of allUsers) {
    // Определяем онлайн статус:
    // - Если lastSeen = null, пользователь онлайн (подключен к сокетам)
    // - Если lastSeen обновлялся менее 30 секунд назад, пользователь онлайн
    // - Иначе оффлайн
    const isOnline = !user.lastSeen || (now.getTime() - user.lastSeen.getTime()) < (30 * 1000);
    const lastSeen = user.lastSeen ? user.lastSeen.toISOString() : undefined;
    userStatuses[user.id] = { isOnline: !!isOnline, lastSeen };
  }

  return userStatuses;
};

// Отправка уведомления в комнату чата
export const sendToChatRoom = (roomId: string, event: string, data: any) => {
  const chatNamespace = (global as any).io?.of('/chat');
  if (chatNamespace) {
    chatNamespace.to(`room_${roomId}`).emit(event, data);
    logger.debug('Sent to chat room', { roomId, event });
  }
};
