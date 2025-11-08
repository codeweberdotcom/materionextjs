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

**Authentication:** Required (Lucia session)

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

**AI Agent Usage:**
- Fetch all user notifications on app initialization
- Includes virtual chat notifications if unread messages exist
- Filters out locally cleared notifications per user session
- Use for populating notification dropdown

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

**AI Agent Usage:**
- Create system notifications (welcome, updates, alerts)
- Trigger real-time notification via WebSocket after creation
- Use appropriate avatar icons and colors for different notification types

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

**AI Agent Usage:**
- Mark notifications as read when user interacts with them
- Update status to 'trash' for soft deletion
- Emit WebSocket event for real-time status updates

### DELETE `/api/notifications/{id}`
Delete notification permanently.

**Authentication:** Required (user can only delete their own notifications)

**Response:**
```json
{
  "success": true
}
```

**AI Agent Usage:**
- Permanently remove notifications from database
- Use for cleanup or when user explicitly deletes notifications

### DELETE `/api/notifications/clear-all`
Clear all notifications from dropdown (marks as hidden for current session).

**Authentication:** Required

**Response:**
```json
{
  "success": true
}
```

**AI Agent Usage:**
- Hide all notifications from UI for current session
- Stores cleared IDs in localStorage per user
- Keeps virtual chat notifications visible if applicable

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

**AI Agent Usage:**
- Bulk mark all notifications as read
- Useful for "mark all as read" functionality
- Updates all notification statuses in database

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
- `setNotifications` - Set all notifications from API
- `filterNotifications` - Filter by status and type (similar to email filtering)
- `updateNotificationStatus` - Update single notification status (read/unread/trash)
- `deleteNotification` - Remove notification from state
- `markAllAsRead` - Mark all notifications as read in bulk
- `addNotification` - Add new notification (for real-time updates)
- `updateNotification` - Update existing notification properties
- `setCurrentNotification` - Set active notification for details view
- `navigateNotifications` - Navigate between notifications (next/prev)
- `addClearedNotifications` - Add notification IDs to cleared set (localStorage)
- `clearClearedNotifications` - Clear all cleared notifications (new session)

### State Structure
```typescript
interface NotificationState {
  notifications: Notification[]
  filteredNotifications: Notification[]
  currentNotificationId?: string
  clearedNotifications: Set<string>
}
```

**AI Agent Usage:**
- Use `setNotifications` to initialize state from API
- Use `addNotification` for WebSocket real-time updates
- Use `filterNotifications` to show filtered views
- Use `addClearedNotifications` to track locally cleared notifications
- Redux state syncs with localStorage for session persistence

## 🛡️ Security Features

### Authentication
- Lucia Auth session validation
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

## 🤖 AI Agent Integration Guide

### Core Workflow for AI Agents

1. **Initialization**
   ```typescript
   // Load notifications on app start
   const { notifications, unreadCount } = useNotifications()

   // Includes virtual chat notifications automatically
   // Filters out locally cleared notifications
   ```

2. **Real-time Updates**
   ```typescript
   // WebSocket events are handled automatically
   socket.on('new-notification', (notification) => {
     // Notification added to state automatically
   })

   socket.on('notification-update', (data) => {
     // Status updates handled automatically
   })
   ```

3. **Creating Notifications**
   ```typescript
   // System notifications
   await fetch('/api/notifications', {
     method: 'POST',
     body: JSON.stringify({
       title: 'Security Alert',
       message: 'New login detected',
       type: 'security',
       avatarIcon: 'ri-shield-line',
       avatarColor: 'error'
     })
   })

   // User notifications
   await fetch('/api/notifications', {
     method: 'POST',
     body: JSON.stringify({
       title: 'Message Received',
       message: 'You have a new message',
       type: 'user',
       avatarIcon: 'ri-message-line',
       avatarColor: 'primary'
     })
   })
   ```

4. **Managing Notification State**
   ```typescript
   // Mark single notification as read
   await markAsRead(notificationId, true)

   // Mark all as read
   await fetch('/api/notifications/mark-all', {
     method: 'PATCH',
     body: JSON.stringify({ read: true })
   })

   // Clear all (hide from UI)
   await clearAllNotifications()
   ```

### Virtual Chat Notifications

- **Automatic Generation**: Created client-side when `chatUnreadCount > 0`
- **Dynamic Content**: Updates based on unread message count
- **Translation Support**: Uses dictionary for localized text
- **Not Persisted**: Exists only in client state, not in database

### Error Handling for AI Agents

- **WebSocket Disconnection**: Notifications load from API as fallback
- **API Failures**: Graceful degradation, show cached notifications
- **localStorage Errors**: Continue without session persistence
- **Authentication Errors**: Redirect to login or refresh session

### Performance Optimization

- **Lazy Loading**: Notifications loaded on demand
- **WebSocket Priority**: Real-time updates over polling
- **localStorage Caching**: Session-based cleared notification tracking
- **Memory Management**: Automatic cleanup on logout

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

## 📋 Quick Reference for AI Agents

### Essential Endpoints Summary
- `GET /api/notifications` - Fetch all user notifications
- `POST /api/notifications` - Create new notification
- `PATCH /api/notifications/{id}` - Update notification status
- `DELETE /api/notifications/{id}` - Delete notification
- `DELETE /api/notifications/clear-all` - Hide all notifications (session)
- `PATCH /api/notifications/mark-all` - Mark all as read

### Key Data Types
```typescript
interface Notification {
  id: string
  title: string
  message: string
  type: 'system' | 'user' | 'security' | 'marketing' | 'info' | 'chat'
  status: 'unread' | 'read' | 'trash' | 'archived'
  avatarIcon?: string
  avatarColor?: string
  createdAt: string
  userId?: string
}
```

### Notification Types
- **system**: Platform announcements, welcome messages
- **user**: User-generated notifications, messages
- **security**: Login alerts, password changes
- **marketing**: Promotions, newsletters
- **info**: General information
- **chat**: Virtual chat unread notifications (client-side only)

### WebSocket Events
- `new-notification` - New notification created
- `notification-update` - Status changed (read/unread)

### Virtual Notifications
- Generated client-side for chat unread messages
- Not stored in database
- Auto-updates with chat state
- Uses translation dictionary for localization

---

*This documentation is designed for AI agents to understand and maintain the notifications system functionality.*