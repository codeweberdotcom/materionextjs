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

### Layered view

| Layer | Location | Notes |
| --- | --- | --- |
| Socket namespace | `src/lib/sockets/namespaces/notifications/index.ts` | Lucia auth, rate limits, события `markAsRead/deleteNotification`. |
| REST API | `src/app/api/notifications/*.ts` | CRUD, `mark-all`, `clear-all`, socket-эмиты. |
| Provider | `src/contexts/SocketProvider.tsx` | Делится `notificationSocket`/`chatSocket`. |
| State management | `src/hooks/useNotifications.ts`, `src/redux-store/slices/notifications.ts` | Нормализация, фильтры, fallback на fetch. |
| UI | `src/views/apps/notifications/*`, `src/components/layout/shared/NotificationsDropdown.tsx` | Страница и dropdown. |
| Metadata utils | `src/utils/notifications/metadata.ts` | JSON <-> String сериализация для Prisma. |

## 🔌 Real-time architecture

Notifications синхронизируются через Socket.IO namespace `/notifications`. Клиент подключается через `SocketProvider`, а бизнес-логика живёт в `useNotifications`.

### Сервер → Клиент
- `newNotification` — новое уведомление после создания через REST или сокет.
- `notificationUpdate` — изменение статуса/metadata.
- `notificationDeleted` — удаление уведомления.
- `notificationsRead` — массовое чтение (mark-all).
- `presence:sync` — синхронизация статусов онлайн пользователей.

### Клиент → Сервер
- `markAsRead`, `markAllAsRead`, `deleteNotification`, `presence:sync` — вызываются хуком `useNotifications`, который автоматически использует Socket.IO либо REST.
- AI-агентам предпочтительнее REST API, поскольку оно даёт детерминированные ответы; сокет служит для live-обновлений UI.

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
      "readAt": null,
      "metadata": {},
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
- Fetch up to 100 latest notifications on initialization
- Apply client-side filters (status, type) for lists and dropdowns
- Use `readAt`/`metadata` for richer rendering (timelines, custom payloads)

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
  "avatarColor": "primary",
  "metadata": {
    "cta": "/en/apps/chat"
  }
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
    "readAt": null,
    "metadata": {},
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
Update notification status or metadata.

**Authentication:** Required (user can only update their own notifications)

**Request Body:**
```json
{
  "status": "read",
  "metadata": {
    "cta": "/en/apps/chat"
  }
}
```

**Response:**
```json
{
  "success": true
}
```

**AI Agent Usage:**
- Mark notifications as read/archived when пользователь взаимодействует с ними
- Передавайте дополнительные данные (CTA, ссылки) через `metadata`
- Изменения автоматически рассылаются по WebSocket всем вкладкам

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
Archive all notifications (скрывает их из выпадающего списка).

**Authentication:** Required

**Response:**
```json
{
  "success": true
}
```

**AI Agent Usage:**
- Скрывайте все уведомления одним действием (например, «Очистить всё»)
- Все активные вкладки получают WebSocket обновления и синхронизируются

### PATCH `/api/notifications/mark-all`
Mark all unread notifications as read.

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
- `read` - User has read the notification (server stores `readAt`)
- `archived` - Hidden from dropdown but доступна на странице уведомлений
- `deleted` - Удалена пользователем (не отображается)

### 3. Avatar Support
- `avatarImage` - Image URL
- `avatarIcon` - RemixIcon class name
- `avatarText` - Text to display
- `avatarColor` - Theme color
- `avatarSkin` - Avatar skin style

## 🗄️ Database Schema

### Notification Model
```prisma
model Notification {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  message     String
  type        String   @default("system")
  status      String   @default("unread") // unread, read, archived, deleted
  readAt      DateTime?
  metadata    Json?    @default("{}")
  avatarImage String?
  avatarIcon  String?
  avatarText  String?
  avatarColor String?
  avatarSkin  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, status, createdAt])
}
```

## 🔧 Redux State Management

### Notification Slice Actions
- `setLoading` / `setNotifications` — управление состоянием загрузки и данными
- `filterNotifications` — применение фильтров по статусу/типу
- `upsertNotification` — добавление или обновление записи на лету (сокеты, API)
- `updateNotification` / `deleteNotification` — точечные изменения
- `markAllAsRead` — массовое обновление статуса `read`
- `setCurrentNotification` / `navigateNotifications` — управление детальным просмотром
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

## 🧪 Testing & Observability

- `pnpm dev:with-socket` — поднимает Next.js + Socket.IO сервер на 3000 порту.
- `pnpm lint` — требует доступа к `~/.cache/next-swc`.
- Prisma: `pnpm prisma migrate dev`, `pnpm prisma db seed`.
- Логи: `logs/application-*.log` (Winston) + консольный вывод `pnpm run dev:with-socket`.

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
- `newNotification`
- `notificationUpdate`
- `notificationDeleted`
- `notificationsRead`
- `presence:sync`

### Virtual Notifications
- Generated client-side for chat unread messages
- Not stored in database
- Auto-updates with chat state
- Uses translation dictionary for localization

---

*This documentation is designed for AI agents to understand and maintain the notifications system functionality.*
