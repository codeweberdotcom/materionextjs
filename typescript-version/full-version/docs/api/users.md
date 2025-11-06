# User Management API Documentation

## 📋 Overview

The user management system provides comprehensive user administration with role-based access control, profile management, and secure user operations. It supports user creation, updates, deletion, and profile management with proper permission checks and caching.

## 🏗️ Architecture

### Components
- **Admin API**: `/api/admin/users` for administrative user management
- **User API**: `/api/user/*` for self-service profile operations
- **Authentication**: Lucia Auth v3.x session management
- **Permissions**: Role-based access control system
- **Caching**: In-memory user cache with TTL
- **File Upload**: Avatar image handling

### Key Files
- `src/app/api/admin/users/route.ts` - Admin user collection operations
- `src/app/api/admin/users/[id]/route.ts` - Individual user admin operations
- `src/app/api/users/route.ts` - Public user listing for chat
- `src/utils/permissions.ts` - Permission checking utilities

## 👥 Admin User Management

### GET `/api/admin/users`
Get all users with caching support (admin only).

**Query Parameters:**
- `clearCache`: `true` to clear in-memory cache

**Permissions Required:** `userManagement.read`

**Response:**
```json
[
  {
    "id": "user-id",
    "fullName": "John Doe",
    "email": "user@example.com",
    "role": "admin",
    "status": "active",
    "country": "russia",
    "avatar": "/images/avatars/1.png",
    "avatarColor": "primary",
    "company": "N/A",
    "contact": "N/A",
    "currentPlan": "basic",
    "isActive": true,
    "username": "johndoe"
  }
]
```

**AI Agent Usage:**
- Load all users for admin dashboard
- Use clearCache=true to refresh after user changes
- Data cached for 30 seconds to improve performance

### POST `/api/admin/users`
Create new user with avatar upload (admin only).

**Permissions Required:** `Users.Create`

**Request Body (FormData):**
```
fullName: John Doe
username: johndoe
email: user@example.com
role: admin
plan: basic
status: active
country: russia
contact: +1234567890
avatar: [File]
```

**Response:**
```json
{
  "id": "user-id",
  "fullName": "John Doe",
  "email": "user@example.com",
  "role": "admin",
  "status": "active",
  "avatar": "/images/avatars/avatar.jpg",
  "avatarColor": "primary"
}
```

**AI Agent Usage:**
- Create new users with proper role assignment
- Handle file uploads for user avatars
- Default password set (should be changed by user)
- Cache automatically cleared after creation

### GET `/api/admin/users/[id]`
Get specific user details (admin only).

**Permissions Required:** `userManagement.read`

**Response:** Same as individual user object from GET `/api/admin/users`

**AI Agent Usage:**
- Fetch individual user data for editing
- Validate user exists before operations

### PUT `/api/admin/users/[id]`
Update user information with avatar upload (admin only).

**Permissions Required:** `Users.Update`

**Request Body (FormData or JSON):**
```
fullName: John Doe Updated
email: newemail@example.com
role: editor
country: usa
avatar: [File] (optional)
```

**Response:**
```json
{
  "id": "user-id",
  "fullName": "John Doe Updated",
  "email": "newemail@example.com",
  "role": "editor",
  "status": "active",
  "avatar": "/uploads/avatars/timestamp-random.jpg"
}
```

**AI Agent Usage:**
- Update user profile information
- Change user roles (with permission validation)
- Upload new avatar files to `/uploads/avatars/`
- Cache cleared automatically after updates

### PATCH `/api/admin/users/[id]`
Toggle user active status (admin only).

**Permissions Required:** Admin or Superadmin

**Response:**
```json
{
  "id": "user-id",
  "fullName": "John Doe",
  "email": "user@example.com",
  "role": "admin",
  "status": "inactive",
  "isActive": false
}
```

**AI Agent Usage:**
- Activate/deactivate user accounts
- Sessions deleted when user deactivated
- Cannot deactivate own account or superadmin users

### DELETE `/api/admin/users/[id]`
Delete user permanently (admin only).

**Permissions Required:** `Users.Delete`

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

**AI Agent Usage:**
- Permanently remove users from database
- Cannot delete own account or superadmin users
- Cache cleared automatically after deletion

## 👤 User Profile Management

### GET `/api/user/profile`
Get current user profile information.

**Authentication:** Required (current user session)

**Response:**
```json
{
  "id": "user-id",
  "fullName": "John Doe",
  "email": "user@example.com",
  "role": "admin",
  "country": "russia",
  "language": "ru",
  "currency": "RUB",
  "avatar": "/images/avatars/1.png"
}
```

**AI Agent Usage:**
- Load current user profile for settings page
- Display user information in UI components

### PUT `/api/user/profile`
Update current user profile.

**Authentication:** Required

**Request Body:**
```json
{
  "name": "John Doe Updated",
  "email": "newemail@example.com",
  "language": "en",
  "currency": "USD",
  "country": "usa"
}
```

**AI Agent Usage:**
- Allow users to update their own profile
- Handle profile form submissions

### PUT `/api/user/change-password`
Change current user password.

**Authentication:** Required

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

**AI Agent Usage:**
- Secure password change functionality
- Validate current password before update

### POST `/api/user/avatar`
Upload user avatar.

**Authentication:** Required

**Request Body:** FormData with `avatar` file

**AI Agent Usage:**
- Handle avatar file uploads for current user
- Store files in `/uploads/avatars/` directory

## 👥 Public User Operations

### GET `/api/users`
Get all users except current user (for chat contacts).

**Authentication:** Required

**Response:**
```json
[
  {
    "id": "user-id",
    "name": "John Doe",
    "email": "user@example.com",
    "image": "/images/avatars/1.png",
    "role": {
      "name": "admin"
    }
  }
]
```

**AI Agent Usage:**
- Load user contacts for chat functionality
- Exclude current user from results
- Used by chat system to populate contact lists

## 🗄️ Database Schema

### User Model
```prisma
model User {
  id          String   @id @default(cuid())
  name        String?
  email       String   @unique
  password    String?
  image       String?
  country     String?
  isActive    Boolean  @default(true)
  roleId      String?
  role        Role?    @relation(fields: [roleId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  messages    Message[]
  chatRooms1  ChatRoom[] @relation("User1Rooms")
  chatRooms2  ChatRoom[] @relation("User2Rooms")
  sessions    Session[]
}
```

## 🛡️ Security Features

### Access Control
- **Role-based Permissions**: Admin operations require specific permissions
- **Self-service**: Users can edit their own profiles
- **Superadmin Protection**: Cannot edit/delete superadmin users
- **Session Management**: Sessions cleared when user deactivated

### Data Validation
- **Email Uniqueness**: Email addresses must be unique
- **Role Validation**: Roles must exist in database
- **File Upload Security**: Avatar files validated and stored securely
- **Permission Checks**: All operations validate user permissions

## 🚀 Usage Examples

### Create New User (Admin)
```typescript
const formData = new FormData()
formData.append('fullName', 'John Doe')
formData.append('email', 'john@example.com')
formData.append('role', 'editor')
formData.append('country', 'usa')
formData.append('avatar', avatarFile)

const response = await fetch('/api/admin/users', {
  method: 'POST',
  body: formData
})
```

### Update User Profile
```typescript
const response = await fetch('/api/user/profile', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe Updated',
    email: 'newemail@example.com',
    country: 'canada'
  })
})
```

### Toggle User Status
```typescript
const response = await fetch(`/api/admin/users/${userId}`, {
  method: 'PATCH'
})
```

### Upload Avatar
```typescript
const formData = new FormData()
formData.append('avatar', imageFile)

const response = await fetch('/api/user/avatar', {
  method: 'POST',
  body: formData
})
```

## 🤖 AI Agent Integration Guide

### Core Workflow for AI Agents

1. **User Management (Admin)**
   ```typescript
   // Load all users
   const users = await fetch('/api/admin/users')

   // Create new user
   const formData = new FormData()
   formData.append('fullName', 'New User')
   formData.append('email', 'user@example.com')
   formData.append('role', 'user')
   await fetch('/api/admin/users', { method: 'POST', body: formData })

   // Update user
   await fetch(`/api/admin/users/${userId}`, {
     method: 'PUT',
     body: JSON.stringify({ fullName: 'Updated Name' })
   })

   // Toggle status
   await fetch(`/api/admin/users/${userId}`, { method: 'PATCH' })

   // Delete user
   await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
   ```

2. **Profile Management**
   ```typescript
   // Get current profile
   const profile = await fetch('/api/user/profile')

   // Update profile
   await fetch('/api/user/profile', {
     method: 'PUT',
     body: JSON.stringify({ name: 'New Name', country: 'US' })
   })

   // Change password
   await fetch('/api/user/change-password', {
     method: 'PUT',
     body: JSON.stringify({
       currentPassword: 'oldpass',
       newPassword: 'newpass123'
     })
   })
   ```

3. **Contact Loading (Chat)**
   ```typescript
   // Get all users for chat contacts
   const contacts = await fetch('/api/users')
   // Returns users except current user
   ```

### Error Handling for AI Agents

- **403 Forbidden**: Insufficient permissions or protected user
- **404 Not Found**: User doesn't exist
- **409 Conflict**: Email already exists
- **400 Bad Request**: Invalid data or self-operation not allowed

### Performance Optimization

- **Caching**: 30-second in-memory cache for user lists
- **Selective Fields**: Different field sets for different endpoints
- **File Handling**: Secure avatar upload with unique filenames
- **Session Cleanup**: Automatic session deletion on deactivation

---

*This documentation is designed for AI agents to understand and maintain the user management system functionality.*
