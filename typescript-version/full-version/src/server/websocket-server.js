const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

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
  console.log('User connected:', socket.id);

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

      console.log(`User ${userId} joined with rooms:`, userRooms.map(r => r.id));
    } catch (error) {
      console.error('Error joining user:', error);
    }
  });

  // Send message
  socket.on('sendMessage', async (data) => {
    try {
      const { roomId, message, senderId } = data;

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

      console.log(`Message sent in room ${roomId} by user ${senderId}`);

      // Update unread message count for recipient
      try {
        // For now, just log that we would update the count
        console.log(`🔄 Обновление счетчика для получателя - функция отключена`);
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
      console.log('🔍 getOrCreateRoom called with:', data);
      const { user1Id, user2Id } = data;

      console.log('🔎 Searching for existing room...');
      let room = await prisma.chatRoom.findFirst({
        where: {
          OR: [
            { user1Id: user1Id, user2Id: user2Id },
            { user1Id: user2Id, user2Id: user1Id }
          ]
        }
      });

      if (!room) {
        console.log('🏗️ Room not found, creating new room...');
        room = await prisma.chatRoom.create({
          data: {
            user1Id: user1Id,
            user2Id: user2Id
          }
        });
        console.log('✅ New room created:', room.id);

        // Join both users to the new room
        const socket1 = activeUsers.get(user1Id);
        const socket2 = activeUsers.get(user2Id);

        if (socket1) {
          io.sockets.sockets.get(socket1)?.join(`room_${room.id}`);
          console.log(`👥 User ${user1Id} joined room_${room.id}`);
        }
        if (socket2) {
          io.sockets.sockets.get(socket2)?.join(`room_${room.id}`);
          console.log(`👥 User ${user2Id} joined room_${room.id}`);
        }
      } else {
        console.log('📁 Existing room found:', room.id);
      }

      // Get messages for the room
      console.log('💬 Fetching messages for room:', room.id);
      const messages = await prisma.message.findMany({
        where: { roomId: room.id },
        include: { sender: true },
        orderBy: { createdAt: 'asc' }
      });
      console.log(`📨 Found ${messages.length} messages in room`);

      const responseData = { room, messages };
      console.log('📤 Sending roomData:', { roomId: room.id, messageCount: messages.length });
      socket.emit('roomData', responseData);
    } catch (error) {
      console.error('❌ Error getting/creating room:', error);
    }
  });

  // Mark messages as read
  socket.on('markMessagesRead', async (data) => {
    try {
      const { roomId, userId } = data;

      console.log(`📖 [START] Marking messages as read in room ${roomId} for user ${userId}`);

      // First, get ALL messages in the room to debug
      const allMessages = await prisma.message.findMany({
        where: { roomId: roomId },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      console.log(`📖 [DEBUG] ALL messages in room (last 10):`, allMessages.map(m => ({
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

      console.log(`📖 [BEFORE] Messages to update (${messagesToUpdateBefore.length}):`, messagesToUpdateBefore.map(m => ({
        id: m.id,
        senderId: m.senderId,
        readAt: m.readAt,
        content: m.content?.substring(0, 20) + '...'
      })));

      if (messagesToUpdateBefore.length === 0) {
        console.log(`📖 [SKIP] No messages to update - all messages are already read or sent by user`);
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

      console.log(`📖 [RESULT] Update result:`, result);
      console.log(`📖 [RESULT] Marked ${result.count} messages as read`);

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

        console.log(`📖 [VERIFICATION] Updated messages:`, updatedMessages.map(m => ({
          id: m.id,
          senderId: m.senderId,
          readAt: m.readAt,
          content: m.content?.substring(0, 20) + '...'
        })));

        // Check if all messages now have readAt set
        const allUpdated = updatedMessages.every(m => m.readAt !== null);
        console.log(`📖 [VERIFICATION] All messages updated successfully: ${allUpdated}`);
      }

      // Notify other users in the room that messages were read
      socket.to(`room_${roomId}`).emit('messagesRead', {
        roomId: roomId,
        readerId: userId,
        count: result.count
      });

      console.log(`📖 [END] markMessagesRead completed successfully`);

    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
      socket.emit('error', { message: 'Failed to mark messages as read' });
    }
  });

  // Test ping event
  socket.on('ping', (data, callback) => {
    console.log('🏓 Ping received:', data);
    if (callback) {
      callback({ pong: true, timestamp: Date.now() });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      console.log('User disconnected:', socket.userId);
    }
  });
});

  const PORT = process.env.PORT || 3000;

  server.listen(PORT, () => {
    console.log(`Next.js + Socket.IO server running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await prisma.$disconnect();
    server.close(() => {
      console.log('Process terminated');
    });
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await prisma.$disconnect();
    server.close(() => {
      console.log('Process terminated');
    });
  });
});