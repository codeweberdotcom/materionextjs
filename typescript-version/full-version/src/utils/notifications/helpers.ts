import type { ThemeColor } from '@core/types'
import type { CustomAvatarProps } from '@core/components/mui/Avatar'
import type { Notification, NotificationStatus } from '@/types/apps/notificationTypes'

const THEME_COLORS: ThemeColor[] = ['primary', 'secondary', 'error', 'warning', 'info', 'success']

export const isThemeColor = (value: unknown): value is ThemeColor =>
  typeof value === 'string' && THEME_COLORS.includes(value as ThemeColor)

const AVATAR_SKINS: CustomAvatarProps['skin'][] = ['filled', 'light', 'light-static']

export const isAvatarSkin = (value: unknown): value is CustomAvatarProps['skin'] =>
  typeof value === 'string' && AVATAR_SKINS.includes(value as CustomAvatarProps['skin'])

export const normalizeThemeColor = (color?: string): ThemeColor | undefined => {
  if (!color) return undefined

  return isThemeColor(color) ? color : undefined
}

export const normalizeAvatarSkin = (skin?: string): CustomAvatarProps['skin'] | undefined => {
  if (!skin) return undefined

  return isAvatarSkin(skin) ? skin : undefined
}

export const formatNotificationTimestamp = (timestamp?: string): string | undefined => {
  if (!timestamp) return undefined

  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) return undefined

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

export const isStoreNotification = (value: unknown): value is Notification =>
  typeof value === 'object' && value !== null && 'status' in value && 'id' in value

export const deriveNotificationStatus = (notification: Notification | { read?: boolean }): NotificationStatus => {
  if (isStoreNotification(notification)) {
    return notification.status
  }

  return notification.read ? 'read' : 'unread'
}

export const isVirtualNotification = (notification: Pick<Notification, 'id'> | { id?: string }): boolean =>
  Boolean(notification.id?.startsWith('virtual-'))
