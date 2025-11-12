// Third-party Imports
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { enableMapSet } from 'immer'
import { persistReducer, persistStore } from 'redux-persist'
import localforage from 'localforage'

// Enable MapSet plugin for Immer to support Set objects in Redux state
enableMapSet()

localforage.config({
  name: 'materio-nextjs',
  storeName: 'redux_persist'
})

// Slice Imports
import chatReducer from '@/redux-store/slices/chat'
import calendarReducer from '@/redux-store/slices/calendar'
import kanbanReducer from '@/redux-store/slices/kanban'
import emailReducer from '@/redux-store/slices/email'
import notificationsReducer from '@/redux-store/slices/notifications'
import chatQueueReducer from '@/redux-store/slices/chatQueue'

const rootReducer = combineReducers({
  chatReducer,
  calendarReducer,
  kanbanReducer,
  emailReducer,
  notificationsReducer,
  chatQueue: chatQueueReducer
})

const persistConfig = {
  key: 'root',
  version: 1,
  storage: localforage,
  whitelist: ['chatQueue']
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware => getDefaultMiddleware({
    serializableCheck: false
  })
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof rootReducer>
export type AppDispatch = typeof store.dispatch
