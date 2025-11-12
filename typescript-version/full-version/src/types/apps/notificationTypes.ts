export const NOTIFICATION_STATUSES = ['unread', 'read', 'archived', 'deleted'] as const

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

export const NOTIFICATION_TYPES = [
  'system',
  'user',
  'security',
  'marketing',
  'info',
  'chat',
  'feature',
  'update',
  'error'
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const isNotificationStatus = (value: unknown): value is NotificationStatus =>
  typeof value === 'string' && (NOTIFICATION_STATUSES as readonly string[]).includes(value)

export const isNotificationType = (value: unknown): value is NotificationType =>
  typeof value === 'string' && (NOTIFICATION_TYPES as readonly string[]).includes(value)

export type NotificationStatusFilter = NotificationStatus | 'all'
export type NotificationTypeFilter = NotificationType | 'all'

export const toNotificationStatusFilter = (value?: string): NotificationStatusFilter | undefined => {
  if (!value) return undefined

  if (value === 'all' || isNotificationStatus(value)) {
    return value as NotificationStatusFilter
  }

  return undefined
}

export const toNotificationTypeFilter = (value?: string): NotificationTypeFilter | undefined => {
  if (!value) return undefined

  if (value === 'all' || isNotificationType(value)) {
    return value as NotificationTypeFilter
  }

  return undefined
}

export interface NotificationApiResponse {
  id: string
  title: string
  message: string
  subtitle?: string | null
  type: string
  status: string
  createdAt: string
  updatedAt: string
  userId?: string | null
  readAt?: string | null
  avatarImage?: string | null
  avatarIcon?: string | null
  avatarText?: string | null
  avatarColor?: string | null
  avatarSkin?: string | null
  metadata?: unknown
}

export interface NotificationUpdatePayload {
  notificationId?: string
  id?: string
  updates?: Partial<Notification>
  read?: boolean
}

export interface NotificationDeletePayload {
  notificationId?: string
  id?: string
}

export interface NotificationSocketReadPayload {
  userId: string
}

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
  metadata?: NotificationMetadata
}

export type NotificationMetadata =
  | ChatNotificationMetadata
  | SystemNotificationMetadata
  | ReminderNotificationMetadata
  | { [key: string]: unknown }

export interface ChatNotificationMetadata {
  chatId: string
  preview?: string
  participants?: string[]
}

export interface SystemNotificationMetadata {
  severity?: 'info' | 'warning' | 'critical'
  actionUrl?: string
}

export interface ReminderNotificationMetadata {
  dueDate?: string
  recurring?: boolean
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
