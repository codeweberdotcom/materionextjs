import { createSlice } from '@reduxjs/toolkit'

import type { Notification, NotificationFilters, NotificationState } from '@/types/apps/notificationTypes'

const sortNotifications = (notifications: Notification[]) =>
  [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

const applyFilters = (notifications: Notification[], filters: NotificationFilters) => {
  return notifications.filter(notification => {
    const matchesStatus =
      !filters.status || filters.status === 'all' ? true : notification.status === filters.status
    const matchesType =
      !filters.type || filters.type === 'all' ? true : notification.type === filters.type
    return matchesStatus && matchesType
  })
}

const initialState: NotificationState = {
  notifications: [],
  filteredNotifications: [],
  currentNotificationId: undefined,
  loading: false,
  filters: {
    status: 'all',
    type: 'all'
  }
}

export const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload
    },
    setNotifications: (state, action) => {
      state.notifications = sortNotifications(action.payload)
      state.filteredNotifications = applyFilters(state.notifications, state.filters)
    },
    filterNotifications: (state, action) => {
      state.filters = {
        ...state.filters,
        ...action.payload
      }
      state.filteredNotifications = applyFilters(state.notifications, state.filters)
    },
    upsertNotification: (state, action) => {
      const notification = action.payload as Notification
      const existingIndex = state.notifications.findIndex(item => item.id === notification.id)

      if (existingIndex > -1) {
        state.notifications[existingIndex] = { ...state.notifications[existingIndex], ...notification }
      } else {
        state.notifications.unshift(notification)
      }

      state.notifications = sortNotifications(state.notifications)
      state.filteredNotifications = applyFilters(state.notifications, state.filters)
    },
    updateNotification: (state, action) => {
      const { notificationId, updates } = action.payload
      state.notifications = state.notifications.map(notification =>
        notification.id === notificationId ? { ...notification, ...updates } : notification
      )
      state.filteredNotifications = applyFilters(state.notifications, state.filters)
    },
    deleteNotification: (state, action) => {
      const { notificationId } = action.payload
      state.notifications = state.notifications.filter(notification => notification.id !== notificationId)
      state.filteredNotifications = applyFilters(state.notifications, state.filters)
    },
    markAllAsRead: state => {
      state.notifications = state.notifications.map(notification => ({
        ...notification,
        status: 'read',
        readAt: notification.readAt || new Date().toISOString()
      }))
      state.filteredNotifications = applyFilters(state.notifications, state.filters)
    },
    setCurrentNotification: (state, action) => {
      state.currentNotificationId = action.payload
    },
    navigateNotifications: (state, action) => {
      const { type } = action.payload
      if (!state.currentNotificationId) return

      const currentIndex = state.notifications.findIndex(
        notification => notification.id === state.currentNotificationId
      )

      if (currentIndex === -1) {
        state.currentNotificationId = undefined
        return
      }

      if (type === 'next' && currentIndex < state.notifications.length - 1) {
        state.currentNotificationId = state.notifications[currentIndex + 1].id
      } else if (type === 'prev' && currentIndex > 0) {
        state.currentNotificationId = state.notifications[currentIndex - 1].id
      }
    }
  }
})

export const {
  setLoading,
  setNotifications,
  filterNotifications,
  upsertNotification,
  updateNotification,
  deleteNotification,
  markAllAsRead,
  setCurrentNotification,
  navigateNotifications
} = notificationsSlice.actions

export default notificationsSlice.reducer
