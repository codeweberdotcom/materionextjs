export type NotificationStatus = 'unread' | 'read' | 'archived' | 'deleted'

export type NotificationType =
  | 'system'
  | 'user'
  | 'security'
  | 'marketing'
  | 'info'
  | 'chat'
  | 'feature'
  | 'update'

export interface Notification {
  id: string
  title: string
  message: string
  subtitle?: string
  type: NotificationType
  status: NotificationStatus
  createdAt: string
  updatedAt: string
  userId?: string
  readAt?: string | null
  avatarImage?: string
  avatarIcon?: string
  avatarText?: string
  avatarColor?: string
  avatarSkin?: string
  metadata?: Record<string, any>
}

export interface NotificationFilters {
  status?: NotificationStatus | 'all'
  type?: NotificationType | 'all'
}

export interface NotificationState {
  notifications: Notification[]
  filteredNotifications: Notification[]
  currentNotificationId?: string
  loading: boolean
  filters: NotificationFilters
}
