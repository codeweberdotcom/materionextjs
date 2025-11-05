import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useDispatch } from 'react-redux';
import { sendMsg } from '@/redux-store/slices/chat';
import { useSocketNew } from './useSocketNew';
import type { ChatMessage, ChatRoom } from '../lib/sockets/types/chat';

export const useChatNew = (otherUserId?: string) => {
  const { data: session } = useSession();
  const { chatSocket, isConnected } = useSocketNew();
  const dispatch = useDispatch();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRoomLoading, setIsRoomLoading] = useState(false);
  const [rateLimitData, setRateLimitData] = useState<{ retryAfter: number; blockedUntil: number } | null>(null);

  // Инициализация комнаты при наличии otherUserId
  useEffect(() => {
    if (chatSocket && isConnected && otherUserId && session?.user?.id) {
      setIsRoomLoading(true);
      chatSocket.emit('getOrCreateRoom', {
        user1Id: session.user.id,
        user2Id: otherUserId
      });
    }
  }, [chatSocket, isConnected, otherUserId, session?.user?.id]);

  // Обработка событий чата
  useEffect(() => {
    if (!chatSocket) return;

    // Обработка данных комнаты
    const handleRoomData = (data: { room: ChatRoom; messages: ChatMessage[] }) => {
      setRoom(data.room);

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

        return mergedMessages;
      });

      setLoading(false);
      setIsRoomLoading(false);

      // Обновляем Redux store
      if (session?.user?.id && data.messages.length > 0) {
        data.messages.forEach((message) => {
          const receiverId = session.user.id === message.senderId
            ? (data.room.user1Id === session.user.id ? data.room.user2Id : data.room.user1Id)
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
      setMessages(prev => [...prev, message]);

      // Обновляем Redux store
      if (session?.user?.id) {
        dispatch(sendMsg({
          message: message.content,
          senderId: message.senderId,
          receiverId: session.user.id
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
  }, [chatSocket, session?.user?.id, dispatch]);

  // Автоматическая отметка сообщений как прочитанные
  useEffect(() => {
    if (room?.id && session?.user?.id && messages.length > 0) {
      markMessagesAsRead();
    }
  }, [room?.id, session?.user?.id, messages.length]);

  // Отправка сообщения
  const sendMessage = async (content: string) => {
    if (!chatSocket || !room || !session?.user?.id) return;

    try {
      // Проверяем rate limit через API
      const response = await fetch('/api/chat/messages/check-rate-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
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
          throw new Error('Rate limit exceeded');
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Rate limit check failed');
        }
      }

      // Отправляем сообщение
      chatSocket.emit('sendMessage', {
        roomId: room.id,
        message: content,
        senderId: session.user.id
      });

      // Обновляем Redux store
      dispatch(sendMsg({
        message: content,
        senderId: session.user.id,
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

    if (!room?.id || !session?.user?.id) {
      return;
    }

    // Обновляем локальное состояние
    setMessages(prev => {
      const updated = prev.map(msg => {
        const shouldUpdate = msg.roomId === room.id && msg.senderId !== session.user.id && !msg.readAt;
        return shouldUpdate
          ? { ...msg, readAt: new Date().toISOString() }
          : msg;
      });
      return updated;
    });

    // Отправляем на сервер
    const emitData = {
      roomId: room.id,
      userId: session.user.id
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
    isConnected,
    loading,
    isRoomLoading,
    rateLimitData,
    setRateLimitData
  };
};