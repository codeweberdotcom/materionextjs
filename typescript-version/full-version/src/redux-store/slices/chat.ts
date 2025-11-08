// Third-party Imports
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

// Type Imports
import type { StatusType, ContactType, ChatDataType } from '@/types/apps/chatTypes'

// Data Imports
import { db } from '@/fake-db/apps/chat'

// Define initial state type
type ChatState = Omit<ChatDataType, 'contacts'> & {
  contacts: ContactType[]
}

// Fetch users from database
export const fetchUsers = createAsyncThunk('chat/fetchUsers', async () => {
  try {
    const response = await fetch('/api/users')
    if (!response.ok) {
      throw new Error('Failed to fetch users')
    }
    const users = await response.json()

    // Transform database users to chat contacts format
    const contacts: ContactType[] = users.map((user: any) => ({
      id: user.id, // Keep as string (CUID from database)
      fullName: user.name || user.email,
      role: user.role?.name || 'User',
      about: user.email,
      avatar: user.image || undefined,
      avatarColor: 'primary' as const,
      status: 'offline' as StatusType
    }))

    return contacts
  } catch (error) {
    // Return empty array if API fails - no fake data fallback
    return []
  }
})

export const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    profileUser: db.profileUser,
    contacts: [], // Start with empty contacts, will be loaded from API
    chats: [], // Start with empty chats, will be created dynamically
    activeUser: undefined
  } as ChatState,
  reducers: {
    getActiveUserData: (state, action: PayloadAction<string>) => {
      const activeUser = state.contacts.find(user => user.id === action.payload)

      const chat = state.chats.find(chat => chat.userId === action.payload)

      if (chat && chat.unseenMsgs > 0) {
        chat.unseenMsgs = 0
      }

      if (activeUser) {
        state.activeUser = activeUser
      }
    },

    addNewChat: (state, action) => {
      const { id } = action.payload

      state.contacts.find(contact => {
        if (contact.id === id && !state.chats.find(chat => chat.userId === contact.id)) {
          state.chats.unshift({
            id: (state.chats.length + 1).toString(),
            userId: contact.id,
            unseenMsgs: 0,
            chat: []
          })
        }
      })
    },

    setUserStatus: (state, action: PayloadAction<{ status: StatusType }>) => {
      state.profileUser = {
        ...state.profileUser,
        status: action.payload.status
      }
    },

    sendMsg: (state, action: PayloadAction<{ message: string; senderId: string; receiverId: string }>) => {
      const { message, senderId, receiverId } = action.payload

      // The chat ID should be the other user in the conversation (not the current user)
      const currentUserId = state.profileUser.id.toString()
      const chatId = senderId === currentUserId ? receiverId : senderId

      let chat = state.chats.find(c => c.id === chatId)

      if (!chat) {
        chat = {
          id: chatId,
          userId: chatId,
          chat: [],
          unseenMsgs: 0,
          lastMessage: undefined
        }
        state.chats.push(chat)
      }

      chat.chat.push({
        message,
        time: new Date().toISOString(),
        senderId
      })
      chat.lastMessage = message
    }
  },
  extraReducers: (builder) => {
    builder.addCase(fetchUsers.fulfilled, (state, action) => {
      state.contacts = action.payload
    })
  }
})

export const { getActiveUserData, addNewChat, setUserStatus, sendMsg } = chatSlice.actions

export default chatSlice.reducer
