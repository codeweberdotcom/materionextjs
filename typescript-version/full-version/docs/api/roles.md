# Role Management API

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
