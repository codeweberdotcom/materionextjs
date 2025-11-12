import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'

export type QueuedMessageStatus = 'pending' | 'sending' | 'failed'

export type QueuedMessage = {
  clientId: string
  roomId: string
  content: string
  createdAt: string
  status: QueuedMessageStatus
  attempts: number
  lastError?: string
}

type ChatQueueState = {
  messages: Record<string, QueuedMessage>
}

const initialState: ChatQueueState = {
  messages: {}
}

type EnqueuePayload = {
  clientId?: string
  roomId: string
  content: string
  status?: QueuedMessageStatus
  createdAt?: string
}

const chatQueueSlice = createSlice({
  name: 'chatQueue',
  initialState,
  reducers: {
    enqueueMessage: (state, action: PayloadAction<EnqueuePayload>) => {
      const clientId = action.payload.clientId || nanoid()
      state.messages[clientId] = {
        clientId,
        createdAt: action.payload.createdAt || new Date().toISOString(),
        attempts: 0,
        ...action.payload,
        status: action.payload.status ?? 'pending'
      }
    },
    upsertMessage: (state, action: PayloadAction<QueuedMessage>) => {
      state.messages[action.payload.clientId] = action.payload
    },
    markMessageSending: (state, action: PayloadAction<{ clientId: string }>) => {
      const message = state.messages[action.payload.clientId]
      if (message) {
        message.status = 'sending'
        message.attempts += 1
        message.lastError = undefined
      }
    },
    markMessageFailed: (state, action: PayloadAction<{ clientId: string; error?: string }>) => {
      const message = state.messages[action.payload.clientId]
      if (message) {
        message.status = 'failed'
        message.lastError = action.payload.error
      }
    },
    markMessageDelivered: (state, action: PayloadAction<{ clientId: string }>) => {
      delete state.messages[action.payload.clientId]
    },
    clearRoomMessages: (state, action: PayloadAction<{ roomId: string }>) => {
      Object.keys(state.messages).forEach(clientId => {
        if (state.messages[clientId]?.roomId === action.payload.roomId) {
          delete state.messages[clientId]
        }
      })
    }
  }
})

export const {
  enqueueMessage,
  upsertMessage,
  markMessageSending,
  markMessageFailed,
  markMessageDelivered,
  clearRoomMessages
} = chatQueueSlice.actions

export default chatQueueSlice.reducer
