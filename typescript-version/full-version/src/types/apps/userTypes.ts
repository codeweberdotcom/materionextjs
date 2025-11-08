// Type Imports
import type { ThemeColor } from '@core/types'

export type UsersType = {
  id: string | number // Accept both string (database ID) and number (display ID)
  role: string
  email: string
  status: string
  avatar: string
  company: string
  country: string
  contact: string
  fullName: string
  username: string
  currentPlan: string
  isActive: boolean
  avatarColor?: ThemeColor
  isOnline?: boolean
  lastSeen?: string
}
