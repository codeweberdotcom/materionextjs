import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useSocket = (userId: string | null) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Create socket connection
    const newSocket = io('http://localhost:3000', {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join', userId);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Начинаем периодический ping каждые 30 секунд для обновления lastSeen
    const pingInterval = setInterval(() => {
      if (newSocket.connected) {
        console.log('Sending ping to update lastSeen');
        newSocket.emit('ping');
      } else {
        console.log('Socket not connected, skipping ping');
      }
    }, 30000); // 30 секунд

    // Cleanup on unmount
    return () => {
      clearInterval(pingInterval);
      newSocket.close();
      setSocket(null);
      setIsConnected(false);
    };
  }, [userId]);

  return { socket, isConnected };
};
