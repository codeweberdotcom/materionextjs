// Notification Status
export type NotificationStatus = 'unread' | 'read' | 'trash'

// Notification Type
export type NotificationType = 'system' | 'user' | 'security' | 'marketing' | 'info'

// Notification Interface
export interface Notification {
  id: string
  title: string
  message: string
  type: NotificationType
  status: NotificationStatus
  createdAt: string
  updatedAt: string
  userId?: string
  metadata?: Record<string, any>
}

// Notification State for Redux
export interface NotificationState {
  notifications: Notification[]
  filteredNotifications: Notification[]
  currentNotificationId?: string
  clearedNotifications: Set<string>
}