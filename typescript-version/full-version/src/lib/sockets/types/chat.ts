import { User } from './common';

// Сообщение чата
export interface ChatMessage {
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
  clientId?: string; // Для дедупликации
  isOptimistic?: boolean; // Для оптимистичных обновлений
}

// Комната чата
export interface ChatRoom {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: string;
  updatedAt: string;
}

// События чата (входящие)
export interface ChatEvents {
  join: (userId: string) => void;
  sendMessage: (data: SendMessageData) => void;
  getOrCreateRoom: (data: GetOrCreateRoomData) => void;
  markMessagesRead: (data: MarkMessagesReadData) => void;
  ping: (data: any, callback: (response: { pong: boolean; timestamp: number }) => void) => void;
}

// События чата (исходящие)
export interface ChatEmitEvents {
  receiveMessage: (message: ChatMessage) => void;
  roomData: (data: RoomData) => void;
  messagesRead: (data: MessagesReadData) => void;
  rateLimitExceeded: (data: RateLimitExceededData) => void;
  error: (error: ErrorData) => void;
}

// Данные для отправки сообщения
export interface SendMessageData {
  roomId: string;
  message: string;
  senderId: string;
}

// Данные для создания/получения комнаты
export interface GetOrCreateRoomData {
  user1Id: string;
  user2Id: string;
}

// Данные для отметки сообщений прочитанными
export interface MarkMessagesReadData {
  roomId: string;
  userId: string;
}

// Данные комнаты
export interface RoomData {
  room: ChatRoom;
  messages: ChatMessage[];
}

// Данные о прочтении сообщений
export interface MessagesReadData {
  roomId: string;
  readerId: string;
  count: number;
}

// Данные превышения rate limit
export interface RateLimitExceededData {
  error: string;
  retryAfter: number;
  blockedUntil: string;
}

// Общие данные ошибки
export interface ErrorData {
  message: string;
  code?: string;
}

// Состояние чата для клиента
export interface ChatState {
  messages: ChatMessage[];
  room: ChatRoom | null;
  loading: boolean;
  isRoomLoading: boolean;
  rateLimitData: RateLimitData | null;
  isConnected: boolean;
}

// Данные rate limit для UI
export interface RateLimitData {
  retryAfter: number;
  blockedUntil: number;
}

// Конфигурация чата
export interface ChatConfig {
  maxMessageLength: number;
  rateLimit: {
    points: number;
    duration: number;
  };
  maxQueueSize: number;
  heartbeatInterval: number;
}