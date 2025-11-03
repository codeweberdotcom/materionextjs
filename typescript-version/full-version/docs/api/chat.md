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

## 📡 API Endpoints

### GET `/api/chat/last-messages`
Get last messages for current authenticated user.

**Authentication:** Required (NextAuth session)

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

### GET `/api/chat/unread`
Get total count of unread messages for current user.

**Authentication:** Required

**Response:**
```json
{
  "count": 5
}
```

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
- `fetchUsers` - Load user contacts
- `getActiveUserData` - Set active chat user
- `sendMsg` - Add message to store
- `toggleMute` - Toggle contact mute status

### State Structure
```typescript
type ChatState = {
  profileUser: ProfileUserType
  contacts: ContactType[]
  chats: ChatType[]
  activeUser?: ContactType
}
```

## 🛡️ Security Features

### Authentication
- NextAuth.js session validation
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

---

*This documentation is designed for AI agents to understand and maintain the chat system functionality.*
