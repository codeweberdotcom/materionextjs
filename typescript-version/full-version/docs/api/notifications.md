# Notifications System API Documentation

## 📋 Overview

The notifications system provides real-time notification management with database persistence, WebSocket integration, and local storage for user preferences. It supports multiple notification types, status management, and virtual notifications for chat messages.

## 🏗️ Architecture

### Components
- **Frontend**: React hooks and Redux state management
- **Backend**: Next.js API routes with Prisma ORM
- **Database**: SQLite/PostgreSQL with Notification model
- **Real-time**: WebSocket integration for instant notifications
- **Storage**: localStorage for user-specific cleared notifications

### Key Files
- `src/hooks/useNotifications.ts` - Main notification hook
- `src/redux-store/slices/notifications.ts` - Redux state management
- `src/components/layout/shared/NotificationsDropdown.tsx` - UI component
- `src/app/api/notifications/` - API endpoints
- `src/types/apps/notificationTypes.ts` - TypeScript types

## 🔌 WebSocket Events

### Server → Client
- `new-notification` - New notification received
- `notification-update` - Notification status updated

## 📡 API Endpoints

### GET `/api/notifications`
Get all notifications for current authenticated user.

**Authentication:** Required (NextAuth session)

**Query Parameters:**
- None (returns all non-archived notifications)

**Response:**
```json
{
  "notifications": [
    {
      "id": "notification-id",
      "title": "Welcome!",
      "message": "Welcome to our platform",
      "type": "system",
      "status": "unread",
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T10:00:00Z",
      "userId": "user-id",
      "subtitle": "Welcome to our platform",
      "time": "1/1/2024, 10:00:00 AM",
      "read": false,
      "avatarImage": null,
      "avatarIcon": "ri-information-line",
      "avatarText": null,
      "avatarColor": "info",
      "avatarSkin": "light"
    }
  ],
  "total": 1
}
```

### POST `/api/notifications`
Create a new notification.

**Authentication:** Required

**Request Body:**
```json
{
  "title": "New Message",
  "message": "You have a new message",
  "type": "user",
  "avatarIcon": "ri-message-line",
  "avatarColor": "primary"
}
```

**Response:**
```json
{
  "notification": {
    "id": "new-notification-id",
    "title": "New Message",
    "message": "You have a new message",
    "type": "user",
    "status": "unread",
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z",
    "userId": "user-id",
    "subtitle": "You have a new message",
    "time": "1/1/2024, 10:00:00 AM",
    "read": false,
    "avatarIcon": "ri-message-line",
    "avatarColor": "primary"
  }
}
```

### PATCH `/api/notifications/{id}`
Update notification status.

**Authentication:** Required (user can only update their own notifications)

**Request Body:**
```json
{
  "status": "read"
}
```

**Response:**
```json
{
  "success": true
}
```

### DELETE `/api/notifications/{id}`
Delete notification permanently.

**Authentication:** Required (user can only delete their own notifications)

**Response:**
```json
{
  "success": true
}
```

### DELETE `/api/notifications/clear-all`
Clear all notifications from dropdown (marks as hidden for current session).

**Authentication:** Required

**Response:**
```json
{
  "success": true
}
```

### PATCH `/api/notifications/mark-all`
Mark all notifications as archived (hide from dropdown).

**Authentication:** Required

**Request Body:**
```json
{
  "read": true
}
```

**Response:**
```json
{
  "success": true
}
```

## 🎯 Core Features

### 1. Notification Types
- `system` - System notifications
- `user` - User-generated notifications
- `security` - Security-related notifications
- `marketing` - Marketing/promotional notifications
- `info` - General information notifications
- `chat` - Virtual chat notifications (not stored in DB)

### 2. Notification Status
- `unread` - New notification
- `read` - User has read the notification
- `trash` - Notification marked for deletion
- `archived` - Hidden from dropdown but still in database

### 3. Virtual Notifications
- Chat unread messages notification
- Dynamically generated based on chat state
- Not persisted in database
- Auto-updates with chat unread count

### 4. Avatar Support
- `avatarImage` - Image URL
- `avatarIcon` - RemixIcon class name
- `avatarText` - Text to display
- `avatarColor` - Theme color
- `avatarSkin` - Avatar skin style

### 5. Local Storage Management
- Cleared notifications persist per user
- Automatic cleanup on logout
- Session-based notification hiding

## 🗄️ Database Schema

### Notification Model
```prisma
model Notification {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  message     String
  type        String   @default("system") // system, user, security, marketing, info
  status      String   @default("unread") // unread, read, trash, archived
  avatarImage String?
  avatarIcon  String?
  avatarText  String?
  avatarColor String?
  avatarSkin  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## 🔧 Redux State Management

### Notification Slice Actions
- `setNotifications` - Set all notifications
- `filterNotifications` - Filter by status and type
- `updateNotificationStatus` - Update single notification status
- `deleteNotification` - Remove notification
- `markAllAsRead` - Mark all as read
- `addNotification` - Add new notification
- `updateNotification` - Update existing notification
- `setCurrentNotification` - Set active notification for details view
- `navigateNotifications` - Navigate between notifications
- `addClearedNotifications` - Add to cleared set
- `clearClearedNotifications` - Clear all cleared notifications

### State Structure
```typescript
interface NotificationState {
  notifications: Notification[]
  filteredNotifications: Notification[]
  currentNotificationId?: string
  clearedNotifications: Set<string>
}
```

## 🛡️ Security Features

### Authentication
- NextAuth.js session validation
- User ownership verification for all operations
- Secure API endpoints with proper authorization

### Data Validation
- Input sanitization for notification content
- Type validation for notification fields
- User permission checks

### Privacy
- Users can only access their own notifications
- Secure localStorage key namespacing
- Automatic cleanup on logout

## 🚀 Usage Examples

### Initialize Notifications Hook
```typescript
const {
  notifications,
  loading,
  unreadCount,
  markAsRead,
  removeNotification,
  clearAllNotifications
} = useNotifications()
```

### Create Notification
```typescript
const createNotification = async () => {
  const response = await fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Welcome!',
      message: 'Welcome to our platform',
      type: 'system',
      avatarIcon: 'ri-information-line',
      avatarColor: 'info'
    })
  })
}
```

### Mark as Read
```typescript
await markAsRead(notificationId, true)
```

### Clear All Notifications
```typescript
await clearAllNotifications()
```

## 🔍 Troubleshooting

### Common Issues

1. **Notifications not appearing**
   - Check WebSocket connection
   - Verify user authentication
   - Check database connectivity

2. **Virtual chat notifications not showing**
   - Ensure chat unread count > 0
   - Check useUnreadMessages hook
   - Verify dictionary translations

3. **Notifications not clearing**
   - Check localStorage permissions
   - Verify user session
   - Check API response status

### Debug Commands
```bash
# Check notification state
console.log('Notifications:', notifications)

# View localStorage cleared notifications
console.log('Cleared:', localStorage.getItem('clearedNotifications_userId'))

# Check WebSocket connection
console.log('Socket connected:', socket?.connected)
```

## 📝 Development Notes

- Virtual notifications are generated client-side
- Real notifications are persisted in database
- localStorage manages user-specific cleared state
- WebSocket enables real-time notification delivery
- Redux manages UI state synchronization
- TypeScript provides type safety throughout
- Backward compatibility maintained with legacy fields

---

*This documentation is designed for AI agents to understand and maintain the notifications system functionality.*