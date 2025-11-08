import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';
import { useAuth } from '@/contexts/AuthProvider';
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
  clientId?: string;
  isOptimistic?: boolean;
}

interface ChatRoom {
  id: string;
  user1Id: string;
  user2Id: string;
}

export const useChat = (otherUserId?: string) => {
  const { user, session } = useAuth();
  const { socket, isConnected } = useSocket(user?.id || null);
  const dispatch = useDispatch();
  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRoomLoading, setIsRoomLoading] = useState(false);
  const [rateLimitData, setRateLimitData] = useState<{ retryAfter: number; blockedUntil: number } | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Map<string, Message>>(new Map());


  // Initialize room when otherUserId is provided
  useEffect(() => {
    if (socket && isConnected && otherUserId && user?.id) {
      setIsRoomLoading(true);
      socket.emit('getOrCreateRoom', {
        user1Id: user?.id,
        user2Id: otherUserId
      });
    }
  }, [socket, isConnected, otherUserId, user?.id]);

  // Listen for room data
  useEffect(() => {
    if (!socket) return;

    const handleRoomData = (data: { room: ChatRoom; messages: Message[] }) => {
      setRoom(data.room);

      // Preserve readAt status from current messages
      setMessages(prevMessages => {
        const currentReadStatus = new Map();
        prevMessages.forEach(msg => {
          if (msg.readAt) {
            currentReadStatus.set(msg.id, msg.readAt);
          }
        });

        const mergedMessages = data.messages.map(msg => {
          const preservedReadAt = currentReadStatus.get(msg.id);
          const result = {
            ...msg,
            readAt: preservedReadAt || msg.readAt
          };

          return result;
        });

        return mergedMessages;
      });

      setLoading(false);
      setIsRoomLoading(false);

      // Update Redux store with messages from database
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

    const handleReceiveMessage = (message: Message) => {
      // Check if this message replaces an optimistic one
      if (message.clientId && optimisticMessages.has(message.clientId)) {
        // Replace optimistic message with real one
        setMessages(prev => prev.map(msg =>
          msg.clientId === message.clientId ? message : msg
        ));
        setOptimisticMessages(prev => {
          const newMap = new Map(prev);
          newMap.delete(message.clientId!);
          return newMap;
        });
      } else {
        // Add new message normally
        setMessages(prev => [...prev, message]);
      }

      // Update Redux store for sidebar display
      if (user?.id) {
        dispatch(sendMsg({
          message: message.content,
          senderId: message.senderId,
          receiverId: user?.id
        }));
      }
    };

    const handleRateLimitExceeded = (data: any) => {
      setRateLimitData({
        retryAfter: data.retryAfter || 300,
        blockedUntil: data.blockedUntil || Date.now() + 300000
      });
    };

    const handleMessagesRead = (data: { roomId: string; readerId: string; count: number }) => {
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
    socket.on('rateLimitExceeded', handleRateLimitExceeded);

    return () => {
      socket.off('roomData', handleRoomData);
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('messagesRead', handleMessagesRead);
      socket.off('rateLimitExceeded', handleRateLimitExceeded);
    };
  }, [socket]);

  // Auto-mark messages as read when room is loaded
  useEffect(() => {
    if (room?.id && user?.id && messages.length > 0) {
      markMessagesAsRead();
    }
  }, [room?.id, user?.id, messages.length]);

  // Add optimistic message
  const addOptimisticMessage = (content: string) => {
    if (!user?.id || !room) return null;

    const clientId = `optimistic-${Date.now()}-${Math.random()}`;
    const optimisticMessage: Message = {
      id: clientId,
      content,
      senderId: user.id,
      sender: {
        id: user.id,
        name: user.name || '',
        email: user.email
      },
      roomId: room.id,
      createdAt: new Date().toISOString(),
      clientId,
      isOptimistic: true
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setOptimisticMessages(prev => new Map(prev.set(clientId, optimisticMessage)));

    return clientId;
  };

  // Remove optimistic message on error
  const removeOptimisticMessage = (clientId: string) => {
    setMessages(prev => prev.filter(msg => msg.clientId !== clientId));
    setOptimisticMessages(prev => {
      const newMap = new Map(prev);
      newMap.delete(clientId);
      return newMap;
    });
  };

  const sendMessage = async (content: string) => {
    if (!socket || !room || !user?.id) return;

    // Add optimistic message immediately
    const clientId = addOptimisticMessage(content);

    try {
      // Check rate limit before sending
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
          // Handle rate limit exceeded - set UI state and remove optimistic message
          const errorData = await response.json();
          setRateLimitData({
            retryAfter: errorData.retryAfter || 300,
            blockedUntil: new Date(errorData.blockedUntil).getTime()
          });
          if (clientId) removeOptimisticMessage(clientId);
          throw new Error('Rate limit exceeded');
        } else {
          const errorData = await response.json();
          if (clientId) removeOptimisticMessage(clientId);
          throw new Error(errorData.error || 'Rate limit check failed');
        }
      }

      // Send message if rate limit check passed
      socket.emit('sendMessage', {
        roomId: room.id,
        message: content,
        senderId: user?.id,
        clientId // Pass clientId to server for deduplication
      });

      // Update Redux store for sidebar display
      dispatch(sendMsg({
        message: content,
        senderId: user?.id,
        receiverId: otherUserId || ''
      }));
    } catch (error) {
      // Remove optimistic message on error
      if (clientId) removeOptimisticMessage(clientId);
      throw error;
    }
  };

  const markMessagesAsRead = () => {
    if (!socket || !socket.connected) {
      return;
    }

    if (!room?.id || !user?.id) {
      return;
    }

    // Immediately update local messages as read
    setMessages(prev => {
      const updated = prev.map(msg => {
        const shouldUpdate = msg.roomId === room.id && msg.senderId !== user?.id && !msg.readAt;
        return shouldUpdate
          ? { ...msg, readAt: new Date().toISOString() }
          : msg;
      });
      return updated;
    });

    const emitData = {
      roomId: room.id,
      userId: user?.id
    };

    try {
      socket.emit('markMessagesRead', emitData);
    } catch (error) {
      // Error handling
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
