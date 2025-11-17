import type { Server, Socket } from 'socket.io'
import type { ChatEvents, ChatEmitEvents } from './chat'
import type { NotificationEvents, NotificationEmitEvents, NotificationLegacyEmitEvents } from './notifications'

// Роли пользователей
export type UserRole = 'admin' | 'user' | 'moderator' | 'guest'

// Разрешения
export type Permission =
  | 'send_message'
  | 'send_notification'
  | 'moderate_chat'
  | 'view_admin_panel'
  | 'receive_notifications'

export type UserPermissions = Permission[] | 'all'

// Пользователь с ролями и разрешениями
export interface User {
  id: string
  role: UserRole
  permissions: UserPermissions
  name?: string
  email?: string
}

// Данные сокета
export interface SocketData {
  user: User
  authenticated: boolean
  connectedAt: Date
  lastActivity: Date
}

// Активные пользователи (in-memory cache)
export interface ActiveUser {
  userId: string
  socketId: string
  connectedAt: Date
  lastActivity: Date
  rooms: string[]
}

// Элемент очереди сообщений
export interface MessageQueueItem<TPayload = unknown> {
  id: string;
  event: string;
  data: TPayload;
  timestamp: number;
  retries: number;
  maxRetries: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// Расширенный Socket с типизацией
type InterServerEvents = Record<string, never>
type CoreServerEvents = {
  ping: (payload: { timestamp: number }) => void
}
export type ClientToServerEvents = ChatEvents & NotificationEvents
export type ServerToClientEvents = ChatEmitEvents & NotificationEmitEvents & NotificationLegacyEmitEvents & CoreServerEvents
export interface TypedSocket
  extends Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
  userId?: string
}
export type TypedIOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

// Конфигурация rate limiting
export interface RateLimitConfig {
  keyPrefix?: string;  // Префикс ключа
  points: number;      // Количество запросов
  duration: number;    // Период в секундах
  blockDuration?: number; // Блокировка в секундах
}

// События для логирования
export interface LogEvent<TData = unknown> {
  event: string;
  userId?: string;
  socketId?: string;
  data?: TData;
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

declare global {
  // eslint-disable-next-line no-var
  var io: TypedIOServer | undefined
}

export {}
