// Third-party Imports
import { createSlice } from '@reduxjs/toolkit'

// Type Imports
import type { Notification, NotificationState } from '@/types/apps/notificationTypes'

// Constants
const initialState: NotificationState = {
  notifications: [],
  filteredNotifications: [],
  currentNotificationId: undefined,
  clearedNotifications: new Set<string>()
}

export const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Set all notifications
    setNotifications: (state, action) => {
      state.notifications = action.payload
    },

    // Filter notifications based on status and type (similar to email filterEmails)
    filterNotifications: (state, action) => {
      const { notifications, status, type } = action.payload

      state.filteredNotifications = notifications.filter((notification: Notification) => {
        // Apply both filters if they are specified (not undefined)
        let matches = true

        if (status) {
          matches = matches && notification.status === status
        }

        if (type) {
          matches = matches && notification.type === type
        }

        return matches
      })
    },

    // Update notification status (read/unread/trash)
    updateNotificationStatus: (state, action) => {
      const { notificationId, status } = action.payload

      state.notifications = state.notifications.map(notification => {
        return notification.id === notificationId ? { ...notification, status } : notification
      })
    },

    // Delete notification
    deleteNotification: (state, action) => {
      const { notificationId } = action.payload

      state.notifications = state.notifications.filter(notification => notification.id !== notificationId)
    },

    // Mark all notifications as read
    markAllAsRead: (state) => {
      state.notifications = state.notifications.map(notification => ({
        ...notification,
        status: 'read'
      }))
    },

    // Add new notification
    addNotification: (state, action) => {
      state.notifications.unshift(action.payload)
    },

    // Update existing notification
    updateNotification: (state, action) => {
      const { notificationId, updates } = action.payload

      state.notifications = state.notifications.map(notification => {
        return notification.id === notificationId ? { ...notification, ...updates } : notification
      })
    },

    // Set current notification for details view
    setCurrentNotification: (state, action) => {
      state.currentNotificationId = action.payload
    },

    // Navigate between notifications
    navigateNotifications: (state, action) => {
      const { type, notifications, currentNotificationId } = action.payload

      const currentIndex = notifications.findIndex((notification: Notification) => notification.id === currentNotificationId)

      if (type === 'next' && currentIndex < notifications.length - 1) {
        state.currentNotificationId = notifications[currentIndex + 1].id
      } else if (type === 'prev' && currentIndex > 0) {
        state.currentNotificationId = notifications[currentIndex - 1].id
      }
    },

    // Add notification IDs to cleared set
    addClearedNotifications: (state, action) => {
      const { notificationIds } = action.payload
      notificationIds.forEach((id: string) => state.clearedNotifications.add(id))
    },

    // Clear all cleared notifications (for new session)
    clearClearedNotifications: (state) => {
      state.clearedNotifications.clear()
    }
  }
})

export const {
  setNotifications,
  filterNotifications,
  updateNotificationStatus,
  deleteNotification,
  markAllAsRead,
  addNotification,
  updateNotification,
  setCurrentNotification,
  navigateNotifications,
  addClearedNotifications,
  clearClearedNotifications
} = notificationsSlice.actions

export default notificationsSlice.reducer