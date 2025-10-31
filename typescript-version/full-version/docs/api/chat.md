# Chat System API

## 💬 Chat System

### GET `/api/chat/last-messages`
Get last messages for current user.

**Response:**
```json
[
  {
    "roomId": "room-id",
    "user1Id": "user1-id",
    "user2Id": "user2-id",
    "lastMessage": {
      "content": "Hello!",
      "createdAt": "2024-01-01T10:00:00Z",
      "sender": { "name": "John Doe" }
    }
  }
]
```

### GET `/api/chat/messages?roomId={roomId}`
Get messages for a chat room.

**Query Parameters:**
- `roomId`: Chat room ID

**Response:**
```json
[
  {
    "id": "message-id",
    "content": "Hello there!",
    "senderId": "sender-id",
    "sender": { "name": "John Doe" },
    "createdAt": "2024-01-01T10:00:00Z",
    "readAt": null
  }
]
```

### POST `/api/chat/messages`
Send a message.

**Request Body:**
```json
{
  "content": "Hello!",
  "receiverId": "receiver-user-id"
}
```

### PUT `/api/chat/messages/read`
Mark messages as read.

**Request Body:**
```json
{
  "messageIds": ["message-id-1", "message-id-2"]
}
