import { Socket } from 'socket.io';

// Роли пользователей
export type UserRole = 'admin' | 'user' | 'moderator' | 'guest';

// Разрешения
export type Permission = 'send_message' | 'send_notification' | 'moderate_chat' | 'view_admin_panel';

// Пользователь с ролями и разрешениями
export interface User {
  id: string;
  role: UserRole;
  permissions: Permission[];
  name?: string;
  email?: string;
}

// Данные сокета
export interface SocketData {
  user: User;
  authenticated: boolean;
  connectedAt: Date;
  lastActivity: Date;
}

// Активные пользователи (in-memory cache)
export interface ActiveUser {
  userId: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
  rooms: string[];
}

// Элемент очереди сообщений
export interface MessageQueueItem {
  id: string;
  event: string;
  data: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

// Общий ответ API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// Расширенный Socket с типизацией
export interface TypedSocket extends Socket {
  data: SocketData;
  userId?: string;
}

// Конфигурация rate limiting
export interface RateLimitConfig {
  keyPrefix?: string;  // Префикс ключа
  points: number;      // Количество запросов
  duration: number;    // Период в секундах
  blockDuration?: number; // Блокировка в секундах
}

// События для логирования
export interface LogEvent {
  event: string;
  userId?: string;
  socketId?: string;
  data?: any;
  timestamp: Date;
  correlationId?: string;
}

// Метрики для мониторинга
export interface SocketMetrics {
  activeConnections: number;
  messagesPerSecond: number;
  averageResponseTime: number;
  failedConnections: number;
  queueSize: number;
  memoryUsage: number;
}