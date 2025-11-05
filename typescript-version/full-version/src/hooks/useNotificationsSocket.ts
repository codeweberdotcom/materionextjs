import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';

export const useNotificationsSocket = (userId: string | null) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    if (!userId || !session) return;

    // Получаем JWT токен из сессии NextAuth
    const token = session?.accessToken;

    if (!token) {
      console.warn('[useNotificationsSocket] No JWT token available in session');
      return;
    }

    console.log('[useNotificationsSocket] Using token for notifications namespace:', token.substring(0, 50) + '...');

    // Create socket connection with JWT authentication to /notifications namespace
    const newSocket = io('http://localhost:3000/notifications', {
      transports: ['websocket', 'polling'],
      auth: {
        token: token
      }
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      console.log('[useNotificationsSocket] Connected to Socket.IO notifications server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[useNotificationsSocket] Disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[useNotificationsSocket] Connection error:', error.message);
    });

    // Cleanup on unmount
    return () => {
      console.log('[useNotificationsSocket] Cleaning up socket connection');
      newSocket.close();
      setSocket(null);
      setIsConnected(false);
    };
  }, [userId, session]);

  return { socket, isConnected };
};