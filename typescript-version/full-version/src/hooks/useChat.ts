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
  const [isRoomLoading, setIsRoomLoading] = useState(false);
  const [rateLimitData, setRateLimitData] = useState<{ retryAfter: number; blockedUntil: number } | null>(null);


  // Initialize room when otherUserId is provided
  useEffect(() => {
    if (socket && isConnected && otherUserId && session?.user?.id) {
      setIsRoomLoading(true);
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

    const handleReceiveMessage = (message: Message) => {

      setMessages(prev => [...prev, message]);

      // Update Redux store for sidebar display
      if (session?.user?.id) {
        dispatch(sendMsg({
          message: message.content,
          senderId: message.senderId,
          receiverId: session.user.id
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
    if (room?.id && session?.user?.id && messages.length > 0) {
      markMessagesAsRead();
    }
  }, [room?.id, session?.user?.id, messages.length]);

  const sendMessage = async (content: string) => {
    if (!socket || !room || !session?.user?.id) return;

    try {
      // Check rate limit before sending
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
          // Handle rate limit exceeded - set UI state
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

      // Send message if rate limit check passed
      socket.emit('sendMessage', {
        roomId: room.id,
        message: content,
        senderId: session.user.id
      });

      // Update Redux store for sidebar display
      dispatch(sendMsg({
        message: content,
        senderId: session.user.id,
        receiverId: otherUserId || ''
      }));
    } catch (error) {
      throw error;
    }
  };

  const markMessagesAsRead = () => {
    if (!socket || !socket.connected) {
      return;
    }

    if (!room?.id || !session?.user?.id) {
      return;
    }

    // Immediately update local messages as read
    setMessages(prev => {
      const updated = prev.map(msg => {
        const shouldUpdate = msg.roomId === room.id && msg.senderId !== session.user.id && !msg.readAt;
        return shouldUpdate
          ? { ...msg, readAt: new Date().toISOString() }
          : msg;
      });
      return updated;
    });

    const emitData = {
      roomId: room.id,
      userId: session.user.id
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