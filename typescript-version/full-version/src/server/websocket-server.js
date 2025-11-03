const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const prisma = new PrismaClient();

// Store active users
const activeUsers = new Map();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000"],
      methods: ["GET", "POST"]
    }
  });

io.on('connection', (socket) => {
  // User connected

  // User joins
  socket.on('join', async (userId) => {
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

      userRooms.forEach(room => {
        socket.join(`room_${room.id}`);
      });

      // User joined with rooms
    } catch (error) {
      console.error('Error joining user:', error);
    }
  });

  // Send message
  socket.on('sendMessage', async (data) => {
    try {
      const { roomId, message, senderId } = data;

      console.log('📨 [SOCKET] sendMessage received:', { roomId, senderId, messageLength: message.length });

      // Check rate limit using rate-limiter-flexible
      try {
        console.log('🔍 [SOCKET] Checking rate limit for user:', senderId);

        // Create rate limiter instance for chat messages
        const chatLimiter = new RateLimiterMemory({
          keyPrefix: 'chat',
          points: 10, // Number of messages
          duration: 60 * 60, // Per hour (in seconds)
        });

        // Consume a point for this message
        const rateLimitResult = await chatLimiter.consume(senderId);

        console.log('✅ [SOCKET] Rate limit check passed for user:', senderId, {
          remainingPoints: rateLimitResult.remainingPoints,
          msBeforeNext: rateLimitResult.msBeforeNext
        });
      } catch (rejRes) {
        if (rejRes instanceof Error) {
          console.log('❌ [SOCKET] Rate limit check error:', rejRes.message);
        } else {
          console.log('❌ [SOCKET] Rate limit exceeded for user:', senderId, {
            msBeforeNext: rejRes.msBeforeNext
          });

          socket.emit('rateLimitExceeded', {
            error: 'Rate limit exceeded',
            retryAfter: Math.ceil(rejRes.msBeforeNext / 1000),
            blockedUntil: new Date(Date.now() + rejRes.msBeforeNext).toISOString()
          });
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
        sender: newMessage.sender,
        roomId: newMessage.roomId,
        readAt: newMessage.readAt,
        createdAt: newMessage.createdAt
      });

      // Message sent

      // Update unread message count for recipient
      try {
        // For now, just log that we would update the count
        // Counter update disabled
      } catch (error) {
        console.error(`❌ Ошибка обновления счетчика:`, error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  });

  // Create or get room between two users
  socket.on('getOrCreateRoom', async (data) => {
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
          // User joined room
        }
        if (socket2) {
          io.sockets.sockets.get(socket2)?.join(`room_${room.id}`);
          // User joined room
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

      const responseData = { room, messages };
      // Sending roomData
      socket.emit('roomData', responseData);
    } catch (error) {
      console.error('❌ Error getting/creating room:', error);
    }
  });

  // Mark messages as read
  socket.on('markMessagesRead', async (data) => {
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
      console.log(allMessages.map(m => ({
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
      console.log(messagesToUpdateBefore.map(m => ({
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
        });
        return;
      }

      // Update messages as read in database
      const currentTime = new Date();
      console.log(`📖 [UPDATE] Current time for update: ${currentTime.toISOString()}`);

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
        console.log(updatedMessages.map(m => ({
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
      });

      // markMessagesRead completed

    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
      socket.emit('error', { message: 'Failed to mark messages as read' });
    }
  });

  // Test ping event
  socket.on('ping', (data, callback) => {
    // Ping received
    if (callback) {
      callback({ pong: true, timestamp: Date.now() });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      // User disconnected
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