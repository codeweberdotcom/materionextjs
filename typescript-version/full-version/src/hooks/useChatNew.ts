import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthProvider';
import { useDispatch } from 'react-redux';
import { sendMsg } from '@/redux-store/slices/chat';
import { useSocketNew } from './useSocketNew';
import type { ChatMessage, ChatRoom } from '../lib/sockets/types/chat';

export const useChatNew = (otherUserId?: string) => {
  const { user, session } = useAuth();
  const { chatSocket, isConnected } = useSocketNew();
  const dispatch = useDispatch();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRoomLoading, setIsRoomLoading] = useState(false);
  const [rateLimitData, setRateLimitData] = useState<{ retryAfter: number; blockedUntil: number } | null>(null);
  const [currentOtherUserId, setCurrentOtherUserId] = useState<string | undefined>(otherUserId);

  // Инициализация комнаты при наличии currentOtherUserId
  useEffect(() => {
    console.log('🔍 [useChatNew] Room init effect:', {
      hasChatSocket: !!chatSocket,
      isConnected,
      currentOtherUserId,
      userId: user?.id,
      isRoomLoading
    });

    if (chatSocket && isConnected && currentOtherUserId && user?.id) {
      console.log('📡 [useChatNew] Emitting getOrCreateRoom:', {
        user1Id: user?.id,
        user2Id: currentOtherUserId
      });

      setIsRoomLoading(true);
      chatSocket.emit('getOrCreateRoom', {
        user1Id: user?.id,
        user2Id: currentOtherUserId
      });
    }
  }, [chatSocket, isConnected, currentOtherUserId, user?.id]);

  // Обработка событий чата
  useEffect(() => {
    if (!chatSocket) return;

    // Обработка данных комнаты
    const handleRoomData = async (data: { room: ChatRoom; messages: ChatMessage[] }) => {
      console.log('📨 [useChatNew] Received roomData:', {
        room: data.room,
        messagesCount: data.messages.length,
        messages: data.messages.map(m => ({ id: m.id, content: m.content?.substring(0, 50) }))
      });

      setRoom(data.room);

      // HTTP запрос для тестирования - получаем последние сообщения через API
      try {
        const response = await fetch(`/api/chat/last-messages?roomId=${data.room.id}&limit=50`);
        if (response.ok) {
          const apiMessages = await response.json();
          console.log('📡 [useChatNew] API last-messages loaded:', apiMessages.length);
        }
      } catch (error) {
        console.warn('📡 [useChatNew] API last-messages failed:', error);
      }

      // Сохраняем статус прочтения
      setMessages(prevMessages => {
        const currentReadStatus = new Map();
        prevMessages.forEach(msg => {
          if (msg.readAt) {
            currentReadStatus.set(msg.id, msg.readAt);
          }
        });

        const mergedMessages = data.messages.map(msg => ({
          ...msg,
          readAt: currentReadStatus.get(msg.id) || msg.readAt
        }));

        console.log('💾 [useChatNew] Messages updated:', mergedMessages.length);
        return mergedMessages;
      });

      setLoading(false);
      setIsRoomLoading(false);

      console.log('✅ [useChatNew] Room loaded successfully:', {
        roomId: data.room.id,
        isRoomLoading: false
      });

      // Обновляем Redux store
      if (user?.id && data.messages.length > 0) {
        data.messages.forEach((message) => {
          const receiverId = user?.id === message.senderId
            ? (data.room.user1Id === user?.id ? data.room.user2Id : data.room.user1Id)
            : message.senderId;

          dispatch(sendMsg({
            message: message.content,
            senderId: message.senderId,
            receiverId: receiverId
          }));
        });
      }
    };

    // Обработка входящих сообщений
    const handleReceiveMessage = (message: ChatMessage) => {
      console.log('📨 [useChatNew] Received message:', {
        messageId: message.id,
        content: message.content,
        senderId: message.senderId,
        roomId: message.roomId
      });

      setMessages(prev => [...prev, message]);

      // Обновляем Redux store
      if (user?.id) {
        dispatch(sendMsg({
          message: message.content,
          senderId: message.senderId,
          receiverId: user?.id
        }));
      }
    };

    // Обработка rate limit
    const handleRateLimitExceeded = (data: any) => {
      setRateLimitData({
        retryAfter: data.retryAfter || 300,
        blockedUntil: data.blockedUntil || Date.now() + 300000
      });
    };

    // Обработка отметки сообщений как прочитанные
    const handleMessagesRead = (data: { roomId: string; readerId: string; count: number }) => {
      setMessages(prev => prev.map(msg =>
        msg.roomId === data.roomId && msg.senderId !== data.readerId
          ? { ...msg, readAt: new Date().toISOString() }
          : msg
      ));
    };

    // Регистрируем обработчики
    chatSocket.on('roomData', handleRoomData);
    chatSocket.on('receiveMessage', handleReceiveMessage);
    chatSocket.on('messagesRead', handleMessagesRead);
    chatSocket.on('rateLimitExceeded', handleRateLimitExceeded);

    // Cleanup
    return () => {
      chatSocket.off('roomData', handleRoomData);
      chatSocket.off('receiveMessage', handleReceiveMessage);
      chatSocket.off('messagesRead', handleMessagesRead);
      chatSocket.off('rateLimitExceeded', handleRateLimitExceeded);
    };
  }, [chatSocket, user?.id, dispatch]);

  // Автоматическая отметка сообщений как прочитанные
  useEffect(() => {
    if (room?.id && user?.id && messages.length > 0) {
      markMessagesAsRead();
    }
  }, [room?.id, user?.id, messages.length]);

  // Инициализация комнаты с новым пользователем
  const initializeRoom = (userId: string) => {
    console.log('🔄 [useChatNew] Initializing room for user:', userId);
    setCurrentOtherUserId(userId);
  };

  // Отправка сообщения
  const sendMessage = async (content: string) => {
    if (!chatSocket || !room || !user?.id) return;

    try {
      // Проверяем rate limit через API
      const response = await fetch('/api/chat/messages/check-rate-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          module: 'chat'
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errorData = await response.json();
          setRateLimitData({
            retryAfter: errorData.retryAfter || 300,
            blockedUntil: new Date(errorData.blockedUntil).getTime()
          });
          // Don't throw error, just set rate limit data
          return;
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Rate limit check failed');
        }
      }

      // Отправляем сообщение
      chatSocket.emit('sendMessage', {
        roomId: room.id,
        message: content,
        senderId: user?.id
      });

      // Обновляем Redux store
      dispatch(sendMsg({
        message: content,
        senderId: user?.id,
        receiverId: otherUserId || ''
      }));

    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  // Отметка сообщений как прочитанные
  const markMessagesAsRead = () => {
    if (!chatSocket || !chatSocket.connected) {
      return;
    }

    if (!room?.id || !user?.id) {
      return;
    }

    // Обновляем локальное состояние
    setMessages(prev => {
      const updated = prev.map(msg => {
        const shouldUpdate = msg.roomId === room.id && msg.senderId !== user?.id && !msg.readAt;
        return shouldUpdate
          ? { ...msg, readAt: new Date().toISOString() }
          : msg;
      });
      return updated;
    });

    // Отправляем на сервер
    const emitData = {
      roomId: room.id,
      userId: user?.id
    };

    try {
      chatSocket.emit('markMessagesRead', emitData);
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  return {
    messages,
    room,
    sendMessage,
    markMessagesAsRead,
    initializeRoom,
    isConnected,
    loading,
    isRoomLoading,
    rateLimitData
  };
};
