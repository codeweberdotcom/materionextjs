import { User } from './common';

// Уведомление
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
  metadata?: Record<string, any>;
}

// Типы уведомлений
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'chat' | 'system';

// Статусы уведомлений
export type NotificationStatus = 'unread' | 'read' | 'archived' | 'deleted';

// События уведомлений (входящие)
export interface NotificationEvents {
  markAsRead: (data: MarkAsReadData) => void;
  markAllAsRead: (userId: string) => void;
  deleteNotification: (data: DeleteNotificationData) => void;
  ping: (data: any, callback: (response: { pong: boolean; timestamp: number }) => void) => void;
}

// События уведомлений (исходящие)
export interface NotificationEmitEvents {
  newNotification: (notification: Notification) => void;
  notificationUpdate: (data: NotificationUpdateData) => void;
  notificationsRead: (data: NotificationsReadData) => void;
  notificationDeleted: (data: NotificationDeletedData) => void;
  error: (error: ErrorData) => void;
}

// Данные для отметки прочитанным
export interface MarkAsReadData {
  notificationId: string;
  userId: string;
}

// Данные для удаления уведомления
export interface DeleteNotificationData {
  notificationId: string;
  userId: string;
}

// Обновление уведомления
export interface NotificationUpdateData {
  notificationId: string;
  updates: Partial<Notification>;
  userId: string;
}

// Данные о прочтении уведомлений
export interface NotificationsReadData {
  userId: string;
  count: number;
  notificationIds: string[];
}

// Удаление уведомления
export interface NotificationDeletedData {
  notificationId: string;
  userId: string;
}

// Общие данные ошибки
export interface ErrorData {
  message: string;
  code?: string;
}

// Состояние уведомлений для клиента
export interface NotificationState {
  notifications: Notification[];
  loading: boolean;
  unreadCount: number;
  error?: string;
}

// Фильтры уведомлений
export interface NotificationFilters {
  status?: NotificationStatus;
  type?: NotificationType;
  limit?: number;
  offset?: number;
}

// Конфигурация уведомлений
export interface NotificationConfig {
  maxNotificationsPerUser: number;
  cleanupInterval: number; // в днях
  realTimeEnabled: boolean;
  batchSize: number;
}

// Создание уведомления
export interface CreateNotificationData {
  title: string;
  message: string;
  type: NotificationType;
  userId: string;
  metadata?: Record<string, any>;
}

// Массовое создание уведомлений
export interface BulkCreateNotificationsData {
  notifications: CreateNotificationData[];
  targetUsers?: string[]; // Если не указано, то для всех пользователей
}