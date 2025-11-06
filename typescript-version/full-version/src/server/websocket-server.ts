import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { PrismaClient, Message, ChatRoom } from '@prisma/client';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { socketLogger, rateLimitLogger, databaseLogger } from '../lib/logger';
import logger from '@/lib/logger'


const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

// Store active users
const activeUsers = new Map<string, string>();

// Types for socket events
interface SendMessageData {
  roomId: string;
  message: string;
  senderId: string;
}

interface GetOrCreateRoomData {
  user1Id: string;
  user2Id: string;
}

interface MarkMessagesReadData {
  roomId: string;
  userId: string;
}

interface RoomDataResponse {
  room: ChatRoom;
  messages: (Message & { sender: any })[];
}

interface RateLimitExceededData {
  error: string;
  retryAfter: number;
  blockedUntil: string;
}

interface MessagesReadData {
  roomId: string;
  readerId: string;
  count: number;
}

interface ReceiveMessageData {
  id: string;
  content: string;
  senderId: string;
  sender: any;
  roomId: string;
  readAt: Date | null;
  createdAt: Date;
}

interface PingCallback {
  (response: { pong: boolean; timestamp: number }): void;
}

// Extend Socket interface to include userId
declare module 'socket.io' {
  interface Socket {
    userId?: string;
  }
}

app.prepare().then(() => {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: ["http://localhost:3000"],
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket: Socket) => {
    socketLogger.connection(socket.id, socket.userId || null, socket.handshake.address, socket.handshake.headers['user-agent'] || '');

    // User joins
    socket.on('join', async (userId: string) => {
      try {
        socket.userId = userId;
        activeUsers.set(userId, socket.id);

        // Join user's personal room
        socket.join(`user_${userId}`);

        // Get user's rooms and join them
        const userRooms = await prisma.chatRoom.findMany({
          where: {
            OR: [
              { user1Id: userId },
              { user2Id: userId }
            ]
          }
        });

        userRooms.forEach((room: ChatRoom) => {
          socket.join(`room_${room.id}`);
        });

        socketLogger.joinRoom(socket.id, userId, `user_${userId}`);
      } catch (error) {
        socketLogger.error('Error joining user', { userId, socketId: socket.id, error: (error as Error).message });
      }
    });

    // Send message
    socket.on('sendMessage', async (data: SendMessageData) => {
      try {
        const { roomId, message, senderId } = data;

        socketLogger.message(socket.id, senderId, roomId, message.length);

        // Check rate limit using rate-limiter-flexible
        try {
          socketLogger.debug('Checking rate limit for user', { userId: senderId, socketId: socket.id });

          // Create rate limiter instance for chat messages
          const chatLimiter = new RateLimiterMemory({
            keyPrefix: 'chat',
            points: 10, // Number of messages
            duration: 60 * 60, // Per hour (in seconds)
          });

          // Consume a point for this message
          const rateLimitResult = await chatLimiter.consume(senderId);

          rateLimitLogger.limitApplied(senderId, socket.handshake.address, rateLimitResult.remainingPoints, new Date(Date.now() + rateLimitResult.msBeforeNext));
        } catch (rejRes: unknown) {
          if (rejRes instanceof Error) {
            rateLimitLogger.error('Rate limit check error', { userId: senderId, error: rejRes.message });
          } else {
            const rateLimitError = rejRes as { msBeforeNext: number };
            rateLimitLogger.limitExceeded(senderId, socket.handshake.address, socket.id, rateLimitError.msBeforeNext);

            socket.emit('rateLimitExceeded', {
              error: 'Rate limit exceeded',
              retryAfter: Math.ceil(rateLimitError.msBeforeNext / 1000),
              blockedUntil: new Date(Date.now() + rateLimitError.msBeforeNext).toISOString()
            } as RateLimitExceededData);
            return;
          }
        }

        // Save message to database
        const newMessage = await prisma.message.create({
          data: {
            content: message,
            senderId: senderId,
            roomId: roomId
          },
          include: {
            sender: true
          }
        });

        // Emit to room
        io.to(`room_${roomId}`).emit('receiveMessage', {
          id: newMessage.id,
          content: newMessage.content,
          senderId: newMessage.senderId,
          sender: newMessage.sender || {},
          roomId: newMessage.roomId,
          readAt: newMessage.readAt,
          createdAt: newMessage.createdAt
        } as ReceiveMessageData);

        databaseLogger.queryExecuted('INSERT INTO Message', Date.now() - Date.now(), senderId);
      } catch (error) {
        socketLogger.error('Error sending message', { socketId: socket.id, userId: data.senderId, roomId: data.roomId, error: (error as Error).message });
      }
    });

    // Create or get room between two users
    socket.on('getOrCreateRoom', async (data: GetOrCreateRoomData) => {
      try {
        // getOrCreateRoom called
        const { user1Id, user2Id } = data;

        // Searching for existing room
        let room = await prisma.chatRoom.findFirst({
          where: {
            OR: [
              { user1Id: user1Id, user2Id: user2Id },
              { user1Id: user2Id, user2Id: user1Id }
            ]
          }
        });

        if (!room) {
          // Room not found, creating new room
          room = await prisma.chatRoom.create({
            data: {
              user1Id: user1Id,
              user2Id: user2Id
            }
          });
          // New room created

          // Join both users to the new room
          const socket1 = activeUsers.get(user1Id);
          const socket2 = activeUsers.get(user2Id);

          if (socket1) {
            io.sockets.sockets.get(socket1)?.join(`room_${room.id}`);
            socketLogger.joinRoom(socket1, user1Id, `room_${room.id}`);
          }
          if (socket2) {
            io.sockets.sockets.get(socket2)?.join(`room_${room.id}`);
            socketLogger.joinRoom(socket2, user2Id, `room_${room.id}`);
          }
        } else {
          // Existing room found
        }

        // Get messages for the room
        // Fetching messages for room
        const messages = await prisma.message.findMany({
          where: { roomId: room.id },
          include: { sender: true },
          orderBy: { createdAt: 'asc' }
        });
        // Messages found

        const responseData: RoomDataResponse = { room, messages };
        // Sending roomData
        socket.emit('roomData', responseData);
      } catch (error) {
        console.error('❌ Error getting/creating room:', error);
      }
    });

    // Mark messages as read
    socket.on('markMessagesRead', async (data: MarkMessagesReadData) => {
      try {
        const { roomId, userId } = data;

        // Marking messages as read

        // First, get ALL messages in the room to debug
        const allMessages = await prisma.message.findMany({
          where: { roomId: roomId },
          orderBy: { createdAt: 'desc' },
          take: 10
        });

        // Messages in room
        logger.info(allMessages.map(m => ({
          id: m.id,
          senderId: m.senderId,
          readAt: m.readAt,
          content: m.content?.substring(0, 20)
        })));

        // Find messages that should be updated (not sent by current user and unread)
        const messagesToUpdateBefore = await prisma.message.findMany({
          where: {
            roomId: roomId,
            senderId: {
              not: userId // Messages not sent by current user
            },
            readAt: null // Only unread messages
          },
          select: {
            id: true,
            senderId: true,
            readAt: true,
            content: true
          },
          orderBy: { createdAt: 'desc' }
        });

        // Messages to update
        logger.info(messagesToUpdateBefore.map(m => ({
          id: m.id,
          senderId: m.senderId,
          readAt: m.readAt,
          content: m.content?.substring(0, 20) + '...'
        })));

        if (messagesToUpdateBefore.length === 0) {
          // No messages to update
          socket.to(`room_${roomId}`).emit('messagesRead', {
            roomId: roomId,
            readerId: userId,
            count: 0
          } as MessagesReadData);
          return;
        }

        // Update messages as read in database
        const currentTime = new Date();
        logger.info(`📖 [UPDATE] Current time for update: ${currentTime.toISOString()}`);

        const result = await prisma.message.updateMany({
          where: {
            roomId: roomId,
            senderId: {
              not: userId // Messages not sent by current user
            },
            readAt: null // Only unread messages
          },
          data: {
            readAt: currentTime
          }
        });

        // Update result
        // Messages marked as read

        // Verify the update worked
        if (result.count > 0) {
          const updatedMessages = await prisma.message.findMany({
            where: {
              id: {
                in: messagesToUpdateBefore.map(m => m.id)
              }
            },
            select: {
              id: true,
              readAt: true,
              senderId: true,
              content: true
            }
          });

          // Updated messages
          logger.info(updatedMessages.map(m => ({
            id: m.id,
            senderId: m.senderId,
            readAt: m.readAt,
            content: m.content?.substring(0, 20) + '...'
          })));

          // Check if all messages now have readAt set
          const allUpdated = updatedMessages.every(m => m.readAt !== null);
          // All messages updated
        }

        // Notify other users in the room that messages were read
        socket.to(`room_${roomId}`).emit('messagesRead', {
          roomId: roomId,
          readerId: userId,
          count: result.count
        } as MessagesReadData);

        // markMessagesRead completed

      } catch (error) {
        console.error('❌ Error marking messages as read:', error);
        socket.emit('error', { message: 'Failed to mark messages as read' });
      }
    });

    // Test ping event
    socket.on('ping', (data: any, callback: PingCallback) => {
      // Ping received
      if (callback && typeof callback === 'function') {
        callback({ pong: true, timestamp: Date.now() });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        activeUsers.delete(socket.userId);
        socketLogger.disconnection(socket.id, socket.userId);
      }
    });
  });

  const PORT = process.env.PORT || 3000;

  server.listen(PORT, () => {
    // Server running
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    // SIGTERM received
    await prisma.$disconnect();
    server.close(() => {
      // Process terminated
    });
  });

  process.on('SIGINT', async () => {
    // SIGINT received
    await prisma.$disconnect();
    server.close(() => {
      // Process terminated
    });
  });
});