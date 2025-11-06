# API Reference

This document provides comprehensive information about the API endpoints available in the Materio MUI Next.js Admin Template.

## 📋 API Overview

The application uses Next.js API routes with RESTful conventions. All endpoints require authentication unless explicitly stated otherwise.

### Base URL
```
http://localhost:3000/api
```

### Authentication
Most endpoints require a valid Lucia session. Include the session cookie in requests.

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

### POST `/api/auth/login`
Lucia authentication login endpoint.

**Supported Methods:**
- POST

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
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "role": "admin"
  }
}
```

**Providers:**
- Credentials (email/password)
- Google OAuth

### POST `/api/auth/logout`
Lucia authentication logout endpoint.

**Supported Methods:**
- POST

**Response:**
```json
{
  "success": true
}
```

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
