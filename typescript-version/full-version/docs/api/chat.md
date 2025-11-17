# Chat System API Documentation

## 📋 Overview

The chat system is a real-time messaging platform built with Next.js, WebSocket (Socket.IO), and Prisma database. It supports private messaging between users with features like message read status, mute notifications, and spam protection.

## 🏗️ Architecture

### Components
- **Frontend**: React components with Redux state management
- **Backend**: Next.js API routes with Socket.IO server
- **Database**: Prisma ORM with SQLite/PostgreSQL
- **Real-time**: WebSocket connections for instant messaging

### Key Files
- `src/server/websocket-server.js` - WebSocket server logic
- `src/hooks/useChat.ts` - React hook for chat functionality
- `src/redux-store/slices/chat.ts` - Redux state management
- `src/views/apps/chat/` - UI components
- `src/app/api/chat/` - API endpoints

## 🔌 WebSocket Events

### Client → Server
- `getOrCreateRoom` - Create or get chat room between two users
- `sendMessage` - Send message to room
- `markMessagesRead` - Mark messages as read in room

### Server → Client
- `roomData` - Room and messages data
- `receiveMessage` - New message received
- `messagesRead` - Messages marked as read confirmation

### Presence (статусы online/offline)
- 30-секундный `ping` отправляется в namespace `/notifications` и обновляет `lastSeen` в БД.
- Событие `presence:sync` в `/notifications` возвращает карту `{ userId: { isOnline, lastSeen } }`, расчёт по `lastSeen` (порог ~30 сек).
- Клиент: `PresenceProvider`/`usePresence` опрашивает `/notifications` раз в 30 сек, хранит статусы in-memory и раздаёт их чатовым компонентам; пока кэш пуст — чат может использовать fallback из `useUnreadByContact` (старый источник статусов).
- Чат-сокет `/chat` пинг не использует; он только для сообщений/acks.


## 🌐 Socket Architecture

### Namespaces
- `/chat` — сообщения; события: `sendMessage`, `receiveMessage`, `getOrCreateRoom`, `markMessagesRead`; разрешение: `send_message`.
- `/notifications` — уведомления и presence; события: `newNotification`, `markAsRead`, `markAllAsRead`, `deleteNotification`, `presence:sync` (карта `{ userId: { isOnline, lastSeen } }`), `ping` (обновляет `lastSeen`, клиентский интервал 30 сек); разрешение: `send_notification`.

### Роли и разрешения
- Роли: `admin`, `moderator`, `user`, `guest`.
- Разрешения: `send_message`, `send_notification`, `moderate_chat`, `view_admin_panel`.

### Аутентификация
JWT (Lucia) передаётся в `auth.token` при подключении:
```javascript
const socket = io('http://localhost:3000', { auth: { token: 'jwt-token-here' } })
```

### Rate limiting
- Чат: 10 сообщений в час
- Уведомления: 30 уведомлений в час

### Масштабирование (опционально)
Redis adapter:
```bash
npm install @socket.io/redis-adapter redis
```
```typescript
import { RedisAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'
const pubClient = createClient({ host: 'localhost', port: 6379 })
const subClient = pubClient.duplicate()
io.adapter(new RedisAdapter(pubClient, subClient))
```

### Troubleshooting (кратко)
- Проверить JWT/права, CORS, namespace.
- При rate limit — смотреть конфиг/логи.

## 📡 API Endpoints

### GET `/api/chat/last-messages`
Get last messages for current authenticated user.

**Authentication:** Required (Lucia session)

**Response:**
```json
[
  {
    "id": "message-id",
    "content": "Hello!",
    "senderId": "sender-id",
    "receiverId": "receiver-id",
    "roomId": "room-id",
    "createdAt": "2024-01-01T10:00:00Z"
  }
]
```

**AI Agent Usage:**
- Use this endpoint to fetch the latest messages for the current user
- Returns array of message objects with sender/receiver info
- Useful for initializing chat state or checking recent conversations

### GET `/api/chat/unread`
Get total count of unread messages for current user.

**Authentication:** Required

**Response:**
```json
{
  "count": 5
}
```

**AI Agent Usage:**
- Quick check for total unread message count
- Useful for notification badges or status indicators

### GET `/api/chat/unread-by-contact`
Get unread message counts grouped by contact.

**Authentication:** Required

**Response:**
```json
{
  "contact-id-1": 3,
  "contact-id-2": 1
}
```

**AI Agent Usage:**
- Get unread counts per contact for UI display
- Keys are contact IDs, values are unread message counts
- Returns empty object if no unread messages

### POST `/api/chat/messages/read`
Mark messages as read in a specific room.

**Authentication:** Required

**Request Body:**
```json
{
  "roomId": "room-id"
}
```

**Response:**
```json
{
  "success": true,
  "updatedCount": 3
}
```

**AI Agent Usage:**
- Mark all unread messages in a room as read
- Returns count of messages that were marked as read
- Use after user opens a chat room to clear unread indicators

### POST `/api/chat/messages/check-rate-limit`
Check if user can send messages (rate limit validation).

**Authentication:** Required

**Request Body:**
```json
{
  "userId": "user-id"
}
```

**Response (Success):**
```json
{
  "allowed": true,
  "remaining": 4,
  "resetTime": 1704103500000
}
```

**Response (Rate Limited):**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 30,
  "blockedUntil": 1704103500000
}
```

**AI Agent Usage:**
- Check rate limit before sending messages
- Returns remaining messages allowed in current window
- Use retryAfter for client-side retry logic

### POST `/api/chat/messages`
Send a new message (rate-limited endpoint).

**Authentication:** Required

**Request Body:**
```json
{
  "content": "Hello, how are you?",
  "receiverId": "receiver-user-id",
  "roomId": "chat-room-id"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "new-message-id",
  "roomId": "chat-room-id"
}
```

**AI Agent Usage:**
- Send messages with automatic rate limiting
- Requires content, receiverId, and roomId
- Check rate limit first using `/api/chat/messages/check-rate-limit`

## 🎯 Core Features

### 1. Real-time Messaging
- Instant message delivery via WebSocket
- Automatic room creation between users
- Message persistence in database

### 2. Message Status
- `createdAt` - Message creation timestamp
- `readAt` - Message read timestamp (null if unread)
- Automatic read status updates

### 3. Contact Management
- User contacts list with online status
- Contact mute functionality (`isMuted` field)
- Avatar and profile information display

### 4. Spam Protection
- Rate limiting: max 5 messages per 30 seconds
- Progressive blocking: 1 minute → 2 minutes → 4 minutes
- Automatic unblocking after timeout

### 5. UI Components

#### SidebarLeft
- Contact list with unread badges
- Search functionality
- Online/offline status indicators

#### ChatContent
- Message display area
- User profile toggle
- Mute/unmute contact button

#### ChatLog
- Message history with timestamps
- Read status indicators
- Auto-scroll to latest messages

#### SendMsgForm
- Message input with validation
- Send button with loading states
- Enter key submission

## 🗄️ Database Schema

### ChatRoom
```prisma
model ChatRoom {
  id        String   @id @default(cuid())
  user1Id   String
  user2Id   String
  user1     User     @relation("User1Rooms", fields: [user1Id], references: [id])
  user2     User     @relation("User2Rooms", fields: [user2Id], references: [id])
  messages  Message[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([user1Id, user2Id])
}
```

### Message
```prisma
model Message {
  id        String   @id @default(cuid())
  content   String
  senderId  String
  sender    User     @relation("MessageSender", fields: [senderId], references: [id])
  roomId    String
  room      ChatRoom @relation(fields: [roomId], references: [id])
  readAt    DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### ContactType (TypeScript)
```typescript
type ContactType = {
  id: string
  fullName: string
  role: string
  about: string
  avatar?: string
  avatarColor?: ThemeColor
  status: StatusType
  isMuted?: boolean
}
```

## 🔧 Redux State Management

### Chat Slice Actions
- `fetchUsers` - Load user contacts from API
- `getActiveUserData` - Set active chat user and mark messages as read
- `sendMsg` - Add message to Redux store (optimistic update)
- `addNewChat` - Create new chat entry for user
- `setUserStatus` - Update current user status
- `toggleMute` - Toggle contact mute status (not implemented in current code)

### State Structure
```typescript
type ChatState = {
  profileUser: ProfileUserType
  contacts: ContactType[]
  chats: ChatType[]
  activeUser?: ContactType
}
```

**AI Agent Usage:**
- Use `fetchUsers` to load contacts on app initialization
- Use `sendMsg` for optimistic UI updates before API confirmation
- Use `getActiveUserData` when user opens a chat to clear unread badges
- Redux state syncs with real-time WebSocket updates

## 🛡️ Security Features

### Authentication
- Lucia Auth session validation
- User ID verification on all endpoints
- Room access control (only participants)

### Rate Limiting
- Message sending limits per user
- Exponential backoff for violations
- Automatic cleanup of expired blocks

### Input Validation
- Message content sanitization
- Room ID validation
- User permission checks

## 🚀 Usage Examples

### Initialize Chat Hook
```typescript
const { messages, sendMessage, markMessagesAsRead } = useChat(otherUserId)
```

### Send Message
```typescript
sendMessage("Hello, how are you?")
```

### Mark Messages Read
```typescript
markMessagesAsRead()
```

### Toggle Contact Mute
```typescript
dispatch(toggleMute(contactId))
```

## 🤖 AI Agent Integration Guide

### Core Workflow for AI Agents

1. **Authentication Check**
   - Ensure user is authenticated via Lucia session
   - All chat endpoints require valid session

2. **Rate Limit Management**
   ```typescript
   // Always check rate limit before sending messages
   const rateLimit = await fetch('/api/chat/messages/check-rate-limit', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ userId: currentUserId })
   })

   if (rateLimit.allowed) {
     // Proceed with sending message
   } else {
     // Handle rate limit exceeded
     console.log('Retry after:', rateLimit.retryAfter)
   }
   ```

3. **Real-time Message Handling**
   ```typescript
   // Use useUnreadByContact hook for real-time updates
   const { unreadByContact, refetch } = useUnreadByContact()

   // Listen for WebSocket events
   socket.on('receiveMessage', () => {
     refetch() // Update unread counts
   })
   ```

4. **Message Sending Flow**
   ```typescript
   // 1. Check rate limit
   // 2. Send message via API
   const response = await fetch('/api/chat/messages', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       content: messageText,
       receiverId: targetUserId,
       roomId: chatRoomId
     })
   })

   // 3. Update Redux store optimistically
   dispatch(sendMsg({
     message: messageText,
     senderId: currentUserId,
     receiverId: targetUserId
   }))
   ```

5. **Contact Management**
   ```typescript
   // Load contacts on app start
   dispatch(fetchUsers())

   // Get unread counts by contact
   const unreadData = await fetch('/api/chat/unread-by-contact')
   // Returns: { "contact-id-1": 3, "contact-id-2": 1 }
   ```

### Error Handling for AI Agents

- **Rate Limit Exceeded**: Wait for retryAfter seconds, then retry
- **Unauthorized**: Redirect to login or refresh session
- **WebSocket Disconnected**: Implement reconnection logic
- **API Errors**: Log errors and provide user feedback

### Performance Optimization

- Use Redux for local state management
- Implement optimistic updates for better UX
- Cache contact data to reduce API calls
- Use WebSocket for real-time updates instead of polling

## 🔍 Troubleshooting

### Common Issues

1. **Messages not appearing**
   - Check WebSocket connection
   - Verify room creation
   - Check database connectivity

2. **Read status not updating**
   - Ensure user is authenticated
   - Check room permissions
   - Verify WebSocket events

3. **Spam protection triggered**
   - Wait for block timeout
   - Reduce message frequency
   - Check rate limit configuration

### Debug Commands
```bash
# Check WebSocket connections
console.log('Socket connected:', socket?.connected)

# View Redux state
console.log('Chat state:', store.getState().chat)

# Check API responses
curl -H "Authorization: Bearer <token>" /api/chat/unread
```

## 📝 Development Notes

- Messages are stored permanently in database
- WebSocket handles real-time delivery
- Redux manages UI state synchronization
- Components auto-update on state changes
- Error handling includes user feedback
- TypeScript provides type safety throughout

## 📋 Quick Reference for AI Agents

### Essential Endpoints Summary
- `GET /api/chat/last-messages` - Get recent conversations
- `GET /api/chat/unread-by-contact` - Get unread counts by contact
- `POST /api/chat/messages/check-rate-limit` - Check if can send message
- `POST /api/chat/messages` - Send new message
- `POST /api/chat/messages/read` - Mark messages as read

### Key Data Types
```typescript
interface Message {
  id: string
  content: string
  senderId: string
  receiverId: string
  roomId: string
  createdAt: string
}

interface Contact {
  id: string
  fullName: string
  role: string
  about: string
  avatar?: string
  status: 'online' | 'offline' | 'busy' | 'away'
}
```

### Rate Limiting Rules
- Max 5 messages per 30 seconds
- Progressive blocking: 1min → 2min → 4min
- Always check limits before sending

### WebSocket Events
- `receiveMessage` - New message received
- `messagesRead` - Messages marked as read
- `getOrCreateRoom` - Create/join chat room
- `sendMessage` - Send message via socket

---

*This documentation is designed for AI agents to understand and maintain the chat system functionality.*
