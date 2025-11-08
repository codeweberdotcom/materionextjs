# API Reference

This document provides comprehensive information about the API endpoints available in the Materio MUI Next.js Admin Template.

## 📋 API Overview

The application uses Next.js API routes with RESTful conventions. All endpoints require authentication unless explicitly stated otherwise.

### Base URL
```
http://localhost:3000/api
```

### Authentication
Most endpoints require a valid NextAuth session. Include the session cookie or Authorization header.

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

### Error Response Format
```json
{
  "message": "Error description",
  "status": 400
}
```

## 🔐 Authentication Endpoints

### POST `/api/auth/[...nextauth]`
NextAuth.js authentication handler.

**Supported Methods:**
- GET, POST (NextAuth.js handles routing)

**Providers:**
- Credentials (email/password)
- Google OAuth

### POST `/api/login`
Custom login endpoint (alternative to NextAuth).

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "id": "user-id",
  "name": "John Doe",
  "email": "user@example.com",
  "role": { "id": "role-id", "name": "admin" }
}
```

### POST `/api/register`
User registration endpoint.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "user@example.com",
    "role": { "name": "user" }
  }
}
```

## 👥 User Management

### GET `/api/admin/users`
Get all users (admin only).

**Query Parameters:**
- `clearCache`: `true` to clear cache

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
    "avatar": "/images/avatars/1.png"
  }
]
```

### POST `/api/admin/users`
Create new user (admin only).

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
  "status": "active"
}
```

### GET `/api/admin/users/[id]`
Get user by ID (admin only).

**Permissions Required:** `userManagement.read`

**Response:** Same as individual user object above.

### PUT `/api/admin/users/[id]`
Update user (admin only).

**Permissions Required:** `Users.Update`

**Request Body:** Same as POST, plus user ID in URL.

### DELETE `/api/admin/users/[id]`
Delete user (admin only).

**Permissions Required:** `Users.Delete`

### GET `/api/user/profile`
Get current user profile.

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

### PUT `/api/user/profile`
Update current user profile.

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

### PUT `/api/user/change-password`
Change current user password.

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

### POST `/api/user/avatar`
Upload user avatar.

**Request Body:** FormData with `avatar` file.

## 👤 Role Management

### GET `/api/admin/roles`
Get all roles (admin/superadmin only).

**Query Parameters:**
- `clearCache`: `true` to clear cache

**Permissions Required:** `roleManagement.read` (or superadmin)

**Response:**
```json
[
  {
    "id": "role-id",
    "name": "admin",
    "description": "Administrator role",
    "permissions": {
      "userManagement": ["read", "create", "update", "delete"],
      "roleManagement": ["read"]
    }
  }
]
```

### POST `/api/admin/roles`
Create new role (admin/superadmin only).

**Permissions Required:** `roleManagement.create` (or superadmin)

**Request Body:**
```json
{
  "name": "editor",
  "description": "Content editor",
  "permissions": {
    "content": ["read", "create", "update"]
  }
}
```

### GET `/api/admin/roles/[id]`
Get role by ID.

**Permissions Required:** `roleManagement.read` (or superadmin)

### PUT `/api/admin/roles/[id]`
Update role.

**Permissions Required:** `roleManagement.update` (or superadmin)

### DELETE `/api/admin/roles/[id]`
Delete role.

**Permissions Required:** `roleManagement.delete` (or superadmin)

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
```

## 📧 Email System

### GET `/api/settings/email-templates`
Get all email templates (admin only).

**Permissions Required:** `emailTemplates.read`

**Response:**
```json
[
  {
    "id": "template-id",
    "name": "welcome",
    "subject": "Welcome to our platform",
    "content": "Welcome {{name}}!",
    "isActive": true
  }
]
```

### POST `/api/settings/email-templates`
Create email template.

**Permissions Required:** `emailTemplates.create`

**Request Body:**
```json
{
  "name": "password-reset",
  "subject": "Reset your password",
  "content": "Click here to reset: {{resetLink}}"
}
```

### GET `/api/settings/email-templates/[id]`
Get email template by ID.

### PUT `/api/settings/email-templates/[id]`
Update email template.

**Permissions Required:** `emailTemplates.update`

### DELETE `/api/settings/email-templates/[id]`
Delete email template.

**Permissions Required:** `emailTemplates.delete`

### POST `/api/email/send`
Send email using template.

**Request Body:**
```json
{
  "templateName": "welcome",
  "to": "user@example.com",
  "variables": {
    "name": "John Doe",
    "company": "ACME Corp"
  }
}
```

## ⚙️ System Settings

### GET `/api/settings/smtp`
Get SMTP settings.

**Permissions Required:** `settings.read`

### PUT `/api/settings/smtp`
Update SMTP settings.

**Permissions Required:** `settings.update`

**Request Body:**
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "your-email@gmail.com",
    "pass": "your-app-password"
  }
}
```

### POST `/api/settings/smtp/test`
Test SMTP connection.

### POST `/api/settings/smtp/send-test`
Send test email.

## 📍 Geographic Data (References)

### Countries

**GET `/api/admin/references/countries`** - Get all countries
**POST `/api/admin/references/countries`** - Create country
**GET `/api/admin/references/countries/[id]`** - Get country by ID
**PUT `/api/admin/references/countries/[id]`** - Update country
**DELETE `/api/admin/references/countries/[id]`** - Delete country

### States

**GET `/api/admin/references/states`** - Get all states
**POST `/api/admin/references/states`** - Create state
**GET `/api/admin/references/states/[id]`** - Get state by ID
**PUT `/api/admin/references/states/[id]`** - Update state
**DELETE `/api/admin/references/states/[id]`** - Delete state

### Cities

**GET `/api/admin/references/cities`** - Get all cities
**POST `/api/admin/references/cities`** - Create city
**GET `/api/admin/references/cities/[id]`** - Get city by ID
**PUT `/api/admin/references/cities/[id]`** - Update city
**DELETE `/api/admin/references/cities/[id]`** - Delete city

### Districts

**GET `/api/admin/references/districts`** - Get all districts
**POST `/api/admin/references/districts`** - Create district
**GET `/api/admin/references/districts/[id]`** - Get district by ID
**PUT `/api/admin/references/districts/[id]`** - Update district
**DELETE `/api/admin/references/districts/[id]`** - Delete district

### Languages

**GET `/api/admin/references/languages`** - Get all languages
**POST `/api/admin/references/languages`** - Create language
**GET `/api/admin/references/languages/[id]`** - Get language by ID
**PUT `/api/admin/references/languages/[id]`** - Update language
**DELETE `/api/admin/references/languages/[id]`** - Delete language

### Currencies

**GET `/api/admin/references/currencies`** - Get all currencies
**POST `/api/admin/references/currencies`** - Create currency
**GET `/api/admin/references/currencies/[id]`** - Get currency by ID
**PUT `/api/admin/references/currencies/[id]`** - Update currency
**DELETE `/api/admin/references/currencies/[id]`** - Delete currency

## 📚 Content & Translations

### GET `/api/admin/references/translations`
Get all translations.

**Response:**
```json
[
  {
    "id": "translation-id",
    "key": "navigation.dashboard",
    "language": "en",
    "value": "Dashboard",
    "namespace": "navigation"
  }
]
```

### POST `/api/admin/references/translations`
Create translation.

**Request Body:**
```json
{
  "key": "buttons.save",
  "language": "en",
  "value": "Save",
  "namespace": "common"
}
```

### POST `/api/admin/references/translations/import`
Import translations from file.

**Request Body:** FormData with translation file.

### GET `/api/admin/references/translations/export`
Export translations.

**Query Parameters:**
- `language`: Filter by language
- `namespace`: Filter by namespace

## 📊 Application Data

### GET `/api/apps/ecommerce`
Get ecommerce data (fake data for demo).

### GET `/api/apps/academy`
Get academy data (fake data for demo).

### GET `/api/apps/logistics`
Get logistics data (fake data for demo).

### GET `/api/apps/invoice`
Get invoice data (fake data for demo).

### GET `/api/pages/profile`
Get user profile data.

### GET `/api/pages/faq`
Get FAQ data.

### GET `/api/pages/pricing`
Get pricing data.

### GET `/api/pages/widget-examples`
Get widget examples data.

## 🎛️ Permissions

### GET `/api/apps/permissions`
Get permissions data (returns empty array - legacy endpoint).

## 📋 Menu

### GET `/api/menu`
Get navigation menu structure.

**Response:**
```json
{
  "menuData": [
    {
      "id": "dashboards",
      "title": "Dashboards",
      "icon": "ri-home-line",
      "children": [...]
    }
  ]
}
```

## 🔍 Public Endpoints

These endpoints don't require authentication:

### GET `/api/countries` - Get countries
### GET `/api/states` - Get states
### GET `/api/cities` - Get cities
### GET `/api/currencies` - Get currencies
### GET `/api/languages` - Get languages
### GET `/api/users` - Get public user list (limited data)

## 🚨 Error Handling

### Common HTTP Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found
- **409**: Conflict (duplicate data)
- **500**: Internal Server Error

### Error Response Examples

```json
{
  "message": "Permission denied: Users required",
  "status": 403
}
```

```json
{
  "message": "User not found",
  "status": 404
}
```

## 🔒 Security Considerations

- All sensitive endpoints require authentication
- Role-based permissions are enforced on the server
- Passwords are hashed using bcrypt
- Input validation prevents injection attacks
- Rate limiting should be implemented for production
- HTTPS should be used in production environments

## 📝 API Development Guidelines

### Creating New Endpoints

1. **File Structure**: Create in `src/app/api/[category]/[endpoint]/route.ts`
2. **Authentication**: Check session with `getServerSession(authOptions)`
3. **Permissions**: Use `checkPermission()` for authorization
4. **Validation**: Validate input data before processing
5. **Error Handling**: Use try-catch blocks and consistent error responses
6. **Caching**: Implement caching for frequently accessed data
7. **Documentation**: Update this API reference document

### Example Endpoint Structure

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { checkPermission } from '@/utils/permissions'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { role: true }
    })

    if (!checkPermission(currentUser, 'module', 'read')) {
      return NextResponse.json({ message: 'Permission denied' }, { status: 403 })
    }

    // Your logic here
    const data = await fetchData()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
```

This API reference covers all major endpoints. For specific implementation details, refer to the source code in `src/app/api/`.
