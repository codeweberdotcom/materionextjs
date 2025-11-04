# Role Management API Documentation

## 📋 Overview

The role management system provides comprehensive role-based access control (RBAC) with hierarchical permissions, database persistence, and caching. It supports dynamic permission assignment, role inheritance, and admin controls for user management.

## 🏗️ Architecture

### Components
- **Role API**: RESTful endpoints for CRUD operations
- **Permission System**: Hierarchical permission checking
- **Database Models**: `Role`, `User` with role relationships
- **Caching**: In-memory role cache with TTL
- **Validation**: Permission-based access control

### Key Files
- `src/app/api/admin/roles/route.ts` - Role collection endpoints
- `src/app/api/admin/roles/[id]/route.ts` - Individual role endpoints
- `src/utils/permissions.ts` - Permission checking utilities
- `src/prisma/schema.prisma` - Database schema

##  Role Management

### GET `/api/admin/roles`
Get all roles with caching support (admin/superadmin only).

**Query Parameters:**
- `clearCache`: `true` to clear in-memory cache

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

**AI Agent Usage:**
- Load all available roles for admin interface
- Use clearCache=true to refresh after role changes
- Roles are sorted with base roles first (superadmin, admin, etc.)

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

**Response:**
```json
{
  "id": "new-role-id",
  "name": "editor",
  "description": "Content editor",
  "permissions": "{\"content\":[\"read\",\"create\",\"update\"]}"
}
```

**AI Agent Usage:**
- Create custom roles with specific permissions
- Permissions stored as JSON string in database
- Cache automatically cleared after creation

### GET `/api/admin/roles/[id]`
Get specific role by ID.

**Permissions Required:** `roleManagement.read` (or superadmin)

**Response:**
```json
{
  "id": "role-id",
  "name": "admin",
  "description": "Administrator role",
  "permissions": "{\"userManagement\":[\"read\",\"create\",\"update\",\"delete\"]}"
}
```

**AI Agent Usage:**
- Fetch individual role details for editing
- Validate role exists before operations

### PUT `/api/admin/roles/[id]`
Update existing role.

**Permissions Required:** `roleManagement.update` (or superadmin)

**Request Body:**
```json
{
  "name": "senior-editor",
  "description": "Senior content editor",
  "permissions": {
    "content": ["read", "create", "update", "delete"],
    "media": ["read", "upload"]
  }
}
```

**AI Agent Usage:**
- Modify role permissions and metadata
- Update role names and descriptions
- Changes affect all users with this role

### DELETE `/api/admin/roles/[id]`
Delete role (with safety checks).

**Permissions Required:** `roleManagement.delete` (or superadmin)

**Response:**
```json
{
  "message": "Role deleted successfully"
}
```

**Error Responses:**
```json
// Protected role
{
  "message": "This role cannot be deleted as it is a system role"
}

// Role has users
{
  "message": "Role has users assigned",
  "users": [
    {
      "id": "user-id",
      "fullName": "John Doe",
      "email": "john@example.com"
    }
  ]
}
```

**AI Agent Usage:**
- Safe deletion with user assignment checks
- Protected system roles cannot be deleted
- Cache cleared automatically after deletion

## 🔐 Permission System

### Permission Structure
```typescript
interface Permissions {
  [moduleName: string]: string[] | "all"
}

// Example:
{
  "userManagement": ["read", "create", "update", "delete"],
  "roleManagement": ["read"],
  "content": "all"  // Full access to content module
}
```

### Permission Actions
- `read` - View/list resources
- `create` - Create new resources
- `update` - Modify existing resources
- `delete` - Remove resources

### Protected Roles
The following roles cannot be deleted:
- `superadmin`, `admin`, `user`, `subscriber`
- `moderator`, `seo`, `editor`, `marketolog`, `support`, `manager`

## 🗄️ Database Schema

### Role Model
```prisma
model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  permissions String?  // JSON string
  users       User[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### User Model (Role Relationship)
```prisma
model User {
  // ... other fields
  roleId String?
  role   Role?   @relation(fields: [roleId], references: [id])
}
```

## 🛡️ Security Features

### Access Control
- **Superadmin Bypass**: Superadmin users skip permission checks
- **Role-based Permissions**: Granular permission system
- **User Validation**: Current user verification on all operations
- **Protected Roles**: System roles cannot be deleted

### Data Validation
- **Unique Names**: Role names must be unique
- **Required Fields**: Name is mandatory for roles
- **JSON Permissions**: Permissions stored as validated JSON
- **User Assignment Checks**: Prevent deletion of roles with users

## 🚀 Usage Examples

### Create Custom Role
```typescript
const response = await fetch('/api/admin/roles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'content-manager',
    description: 'Manages website content',
    permissions: {
      content: ['read', 'create', 'update', 'delete'],
      media: ['read', 'upload', 'delete'],
      pages: ['read', 'update']
    }
  })
})
```

### Update Role Permissions
```typescript
const response = await fetch(`/api/admin/roles/${roleId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    permissions: {
      ...existingPermissions,
      analytics: ['read']  // Add analytics permission
    }
  })
})
```

### Safe Role Deletion
```typescript
const response = await fetch(`/api/admin/roles/${roleId}`, {
  method: 'DELETE'
})

if (response.status === 400) {
  const error = await response.json()
  if (error.users) {
    // Handle users assigned to role
    console.log('Cannot delete: role has users', error.users)
  }
}
```

## 🤖 AI Agent Integration Guide

### Core Workflow for AI Agents

1. **Role Management**
   ```typescript
   // Load all roles
   const roles = await fetch('/api/admin/roles')

   // Create new role
   await fetch('/api/admin/roles', {
     method: 'POST',
     body: JSON.stringify({
       name: 'api-user',
       permissions: { api: ['read'] }
     })
   })

   // Update role
   await fetch(`/api/admin/roles/${roleId}`, {
     method: 'PUT',
     body: JSON.stringify({ permissions: newPermissions })
   })
   ```

2. **Permission Checking**
   ```typescript
   import { checkPermission, isSuperadmin } from '@/utils/permissions'

   // Check specific permission
   if (checkPermission(user, 'userManagement', 'create')) {
     // Allow user creation
   }

   // Superadmin bypass
   if (isSuperadmin(user)) {
     // Full access
   }
   ```

3. **Cache Management**
   ```typescript
   // Clear cache after changes
   await fetch('/api/admin/roles?clearCache=true')

   // Cache automatically cleared on role CRUD operations
   ```

### Error Handling for AI Agents

- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Role doesn't exist
- **400 Bad Request**: Validation errors or role has users
- **409 Conflict**: Duplicate role name

### Best Practices

- **Cache Awareness**: Use clearCache when needed
- **Permission Validation**: Always check permissions before operations
- **User Assignment**: Check for assigned users before deletion
- **Protected Roles**: Respect system role protections

---

*This documentation is designed for AI agents to understand and maintain the role management system functionality.*
