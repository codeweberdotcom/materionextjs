import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';
import { useSession } from 'next-auth/react';
import { useDispatch } from 'react-redux';
import { sendMsg } from '@/redux-store/slices/chat';

interface Message {
  id: string;
  content: string;
  senderId: string;
  sender: {
    id: string;
    name?: string;
    email: string;
  };
  roomId: string;
  readAt?: string;
  createdAt: string;
}

interface ChatRoom {
  id: string;
  user1Id: string;
  user2Id: string;
}

export const useChat = (otherUserId?: string) => {
  const { data: session } = useSession();
  const { socket, isConnected } = useSocket(session?.user?.id || null);
  const dispatch = useDispatch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(false);


  // Initialize room when otherUserId is provided
  useEffect(() => {
    if (socket && isConnected && otherUserId && session?.user?.id) {
      socket.emit('getOrCreateRoom', {
        user1Id: session.user.id,
        user2Id: otherUserId
      });
    }
  }, [socket, isConnected, otherUserId, session?.user?.id]);

  // Listen for room data
  useEffect(() => {
    if (!socket) return;

    const handleRoomData = (data: { room: ChatRoom; messages: Message[] }) => {
      console.log('🏠 handleRoomData вызван с данными:', {
        room: data.room,
        messagesCount: data.messages.length,
        messages: data.messages.map(m => ({ content: m.content, senderId: m.senderId, readAt: m.readAt }))
      });

      setRoom(data.room);

      // Preserve readAt status from current messages
      setMessages(prevMessages => {
        const currentReadStatus = new Map();
        prevMessages.forEach(msg => {
          if (msg.readAt) {
            currentReadStatus.set(msg.id, msg.readAt);
            console.log(`📖 [PRESERVE] Сохраняем readAt для ${msg.id}:`, msg.readAt);
          }
        });

        const mergedMessages = data.messages.map(msg => {
          const preservedReadAt = currentReadStatus.get(msg.id);
          const result = {
            ...msg,
            readAt: preservedReadAt || msg.readAt
          };

          if (preservedReadAt) {
            console.log(`📖 [MERGE] Применяем сохраненный readAt для ${msg.id}:`, preservedReadAt);
          }

          return result;
        });

        console.log('📖 [MERGE] Слито сообщений:', {
          previousCount: prevMessages.length,
          newCount: data.messages.length,
          mergedCount: mergedMessages.length,
          preservedReadStatus: currentReadStatus.size,
          mergedMessagesReadAt: mergedMessages.map(m => ({ id: m.id, readAt: m.readAt }))
        });

        return mergedMessages;
      });

      setLoading(false);

      // Update Redux store with messages from database
      if (session?.user?.id && data.messages.length > 0) {
        console.log('💾 Загрузка сообщений из базы в Redux store');
        data.messages.forEach((message, index) => {
          const receiverId = session.user.id === message.senderId
            ? (data.room.user1Id === session.user.id ? data.room.user2Id : data.room.user1Id)
            : message.senderId;

          console.log(`📝 Сообщение ${index + 1}:`, {
            content: message.content,
            senderId: message.senderId,
            receiverId: receiverId,
            readAt: message.readAt
          });

          dispatch(sendMsg({
            message: message.content,
            senderId: message.senderId,
            receiverId: receiverId
          }));
        });
      } else {
        console.log('⚠️ Нет сообщений для загрузки или сессия не найдена');
      }
    };

    const handleReceiveMessage = (message: Message) => {
      console.log('📨 handleReceiveMessage вызван с сообщением:', {
        content: message.content,
        senderId: message.senderId,
        roomId: message.roomId
      });

      setMessages(prev => [...prev, message]);

      // Update Redux store for sidebar display
      if (session?.user?.id) {
        console.log('🔄 Обновление Redux store для входящего сообщения');
        dispatch(sendMsg({
          message: message.content,
          senderId: message.senderId,
          receiverId: session.user.id
        }));
      }
    };

    const handleMessagesRead = (data: { roomId: string; readerId: string; count: number }) => {
      console.log('📖 handleMessagesRead вызван:', data);

      // Update local messages to mark them as read
      setMessages(prev => prev.map(msg =>
        msg.roomId === data.roomId && msg.senderId !== data.readerId
          ? { ...msg, readAt: new Date().toISOString() }
          : msg
      ));
    };

    socket.on('roomData', handleRoomData);
    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('messagesRead', handleMessagesRead);

    return () => {
      socket.off('roomData', handleRoomData);
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('messagesRead', handleMessagesRead);
    };
  }, [socket]);

  // Auto-mark messages as read when room is loaded
  useEffect(() => {
    if (room?.id && session?.user?.id && messages.length > 0) {
      console.log('🏠 [AUTO MARK] Комната загружена, автоматически отмечаем сообщения как прочитанные');
      markMessagesAsRead();
    }
  }, [room?.id, session?.user?.id, messages.length]);

  const sendMessage = (content: string) => {
    if (!socket || !room || !session?.user?.id) return;

    console.log('📤 Отправка сообщения:', {
      roomId: room.id,
      message: content,
      senderId: session.user.id,
      otherUserId: otherUserId
    });

    socket.emit('sendMessage', {
      roomId: room.id,
      message: content,
      senderId: session.user.id
    });

    // Update Redux store for sidebar display
    console.log('🔄 Обновление Redux store для отправленного сообщения');
    dispatch(sendMsg({
      message: content,
      senderId: session.user.id,
      receiverId: otherUserId || ''
    }));
  };

  const markMessagesAsRead = () => {
    console.log('📖 [START] markMessagesAsRead вызвана');
    console.log('📖 [DATA] room:', room);
    console.log('📖 [DATA] session:', session);
    console.log('📖 [DATA] socket:', socket);
    console.log('📖 [DATA] socket.connected:', socket?.connected);
    console.log('📖 [DATA] socket.id:', socket?.id);

    console.log('📖 Отметка сообщений как прочитанные:', {
      roomId: room?.id,
      userId: session?.user?.id,
      socketConnected: socket?.connected,
      socketExists: !!socket,
      roomExists: !!room,
      sessionExists: !!session,
      sessionUserExists: !!session?.user
    });

    if (!socket || !socket.connected) {
      console.log('⚠️ [CONDITION FAILED] Socket не подключен, пропускаем markMessagesRead');
      console.log('⚠️ [DETAILS] socket:', !!socket, 'connected:', socket?.connected);
      return;
    }

    if (!room?.id || !session?.user?.id) {
      console.log('⚠️ [CONDITION FAILED] Недостаточно данных для markMessagesRead:', {
        roomId: room?.id,
        userId: session?.user?.id,
        roomExists: !!room,
        sessionUserExists: !!session?.user
      });
      return;
    }

    console.log('📖 [CONDITIONS MET] Все условия выполнены для отправки');
    console.log('📖 Отправка markMessagesRead на сервер');

    // Immediately update local messages as read
    console.log('📖 [LOCAL UPDATE] Обновление локальных сообщений');
    const beforeUpdate = messages.length;
    setMessages(prev => {
      const updated = prev.map(msg => {
        const shouldUpdate = msg.roomId === room.id && msg.senderId !== session.user.id && !msg.readAt;
        if (shouldUpdate) {
          console.log('📖 [LOCAL UPDATE] Обновляем сообщение:', {
            id: msg.id,
            senderId: msg.senderId,
            readAt: msg.readAt,
            newReadAt: new Date().toISOString()
          });
        }
        return shouldUpdate
          ? { ...msg, readAt: new Date().toISOString() }
          : msg;
      });
      const afterUpdate = updated.filter(msg => msg.readAt).length;
      console.log('📖 [LOCAL UPDATE] Результат:', {
        before: beforeUpdate,
        after: afterUpdate,
        updated: afterUpdate - (messages.filter(msg => msg.readAt).length)
      });
      return updated;
    });

    const emitData = {
      roomId: room.id,
      userId: session.user.id
    };

    console.log('📖 [EMIT DATA]:', emitData);

    try {
      const emitResult = socket.emit('markMessagesRead', emitData);
      console.log('📖 [EMIT RESULT]:', emitResult);
      console.log('📖 [AFTER EMIT] Сообщение отправлено на сервер');

      // Add timeout to check if server received the event
      setTimeout(() => {
        console.log('📖 [TIMEOUT CHECK] Проверяем, получил ли сервер событие...');
        // Try to emit a test event to verify connection
        socket.emit('ping', { timestamp: Date.now() }, (pong: any) => {
          console.log('📖 [PING PONG] Соединение активно:', pong);
        });
      }, 1000);

    } catch (error) {
      console.error('📖 [EMIT ERROR]:', error);
    }

    console.log('📖 [END] markMessagesAsRead завершена');
  };

  return {
    messages,
    room,
    sendMessage,
    markMessagesAsRead,
    isConnected,
    loading
  };
};