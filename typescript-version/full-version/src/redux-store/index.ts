// Third-party Imports
import { configureStore } from '@reduxjs/toolkit'
import { enableMapSet } from 'immer'

// Enable MapSet plugin for Immer to support Set objects in Redux state
enableMapSet()

// Slice Imports
import chatReducer from '@/redux-store/slices/chat'
import calendarReducer from '@/redux-store/slices/calendar'
import kanbanReducer from '@/redux-store/slices/kanban'
import emailReducer from '@/redux-store/slices/email'
import notificationsReducer from '@/redux-store/slices/notifications'

export const store = configureStore({
  reducer: {
    chatReducer,
    calendarReducer,
    kanbanReducer,
    emailReducer,
    notificationsReducer
  },
  middleware: getDefaultMiddleware => getDefaultMiddleware({ serializableCheck: false })
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
