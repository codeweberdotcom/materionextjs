# User Management API

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
