import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthProvider';

export const useSocketNew = () => {
  const [chatSocket, setChatSocket] = useState<Socket | null>(null);
  const [notificationSocket, setNotificationSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, session } = useAuth();

  const userId = user?.id;

  useEffect(() => {
    if (!user?.id) return;

    // Получаем JWT токен из session
    const token = (session as any)?.accessToken || '';

    // Создаем подключение к namespace чата
    const newChatSocket = io('/chat', {
      transports: ['websocket', 'polling'],
      auth: {
        token: token
      }
    });

    // Создаем подключение к namespace уведомлений
    const newNotificationSocket = io('/notifications', {
      transports: ['websocket', 'polling'],
      auth: {
        token: token
      }
    });

    // Обработчики для чата
    newChatSocket.on('connect', () => {
      console.log('Connected to chat namespace');
      setIsConnected(true);
    });

    newChatSocket.on('disconnect', () => {
      console.log('Disconnected from chat namespace');
      setIsConnected(false);
    });

    // Обработчики для уведомлений
    newNotificationSocket.on('connect', () => {
      console.log('Connected to notifications namespace');
    });

    newNotificationSocket.on('disconnect', () => {
      console.log('Disconnected from notifications namespace');
    });

    // Обработка ошибок
    const handleError = (error: any) => {
      console.error('Socket error:', error);
    };

    newChatSocket.on('error', handleError);
    newNotificationSocket.on('error', handleError);

    setChatSocket(newChatSocket);
    setNotificationSocket(newNotificationSocket);

    // Cleanup
    return () => {
      newChatSocket.close();
      newNotificationSocket.close();
      setChatSocket(null);
      setNotificationSocket(null);
      setIsConnected(false);
    };
  }, [user?.id]);

  return {
    chatSocket,
    notificationSocket,
    isConnected
  };
};
