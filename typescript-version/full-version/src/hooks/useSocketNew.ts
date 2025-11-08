import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthProvider';

export const useSocketNew = () => {
  const [chatSocket, setChatSocket] = useState<Socket | null>(null);
  const [notificationSocket, setNotificationSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user?.id) {
      // Cleanup if user is not available
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setIsConnected(false);
      setChatSocket(null);
      setNotificationSocket(null);
      return;
    }

    // Получаем токен из API endpoint
    const getToken = async () => {
      try {
        const response = await fetch('/api/auth/session-token');
        if (response.ok) {
          const data = await response.json();
          return data.token;
        } else {
          console.error('Failed to get session token:', response.status);
          return '';
        }
      } catch (error) {
        console.error('Error fetching session token:', error);
        return '';
      }
    };

    const initializeSockets = async () => {
      const token = await getToken();
      console.log('useSocketNew finalToken:', token ? 'present' : 'empty');

      if (!token) {
        console.error('No token received, cannot connect to sockets');
        return;
      }

      // Создаем подключение к namespace чата
      const newChatSocket = io('/chat', {
        transports: ['websocket', 'polling'],
        auth: {
          token: token
        },
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      // Создаем подключение к namespace уведомлений
      const newNotificationSocket = io('/notifications', {
        transports: ['websocket', 'polling'],
        auth: {
          token: token
        },
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      // Обработчики для чата
      newChatSocket.on('connect', () => {
        console.log('Connected to chat namespace, socket id:', newChatSocket.id);
        setIsConnected(true);
      });

      newChatSocket.on('disconnect', (reason) => {
        console.log('Disconnected from chat namespace, reason:', reason);
        setIsConnected(false);
      });

      newChatSocket.on('connect_error', (error) => {
        console.error('Chat socket connect error:', error);
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

      // Начинаем периодический ping каждые 30 секунд для обновления lastSeen
      const pingInterval = setInterval(() => {
        if (newChatSocket.connected) {
          console.log('Sending ping to update lastSeen');
          newChatSocket.emit('ping');
        } else {
          console.log('Socket not connected, skipping ping');
        }
      }, 30000); // 30 секунд

      // Store cleanup function
      cleanupRef.current = () => {
        console.log('Cleaning up sockets');
        clearInterval(pingInterval);
        newChatSocket.close();
        newNotificationSocket.close();
        setChatSocket(null);
        setNotificationSocket(null);
        setIsConnected(false);
      };
    };

    initializeSockets();

    // Cleanup function for useEffect
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [user?.id]);

  return {
    chatSocket,
    notificationSocket,
    isConnected
  };
};
