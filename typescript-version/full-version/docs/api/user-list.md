# User List API Documentation

## 📋 Overview

The User List system provides comprehensive user management functionality with static data demonstration, advanced filtering, sorting, and pagination capabilities. It uses fake database data for demonstration purposes but includes full API structure for production implementation.

## 🏗️ Architecture

### Components
- **Static Data Source**: Fake database with 50 sample users
- **API Endpoints**: RESTful API routes for data access
- **Type Safety**: TypeScript interfaces for user data
- **Filtering System**: Advanced search and filter capabilities
- **Pagination Support**: Server-side pagination implementation

### Key Files
- `src/app/api/apps/user-list/route.ts` - Main API endpoint
- `src/fake-db/apps/userList.ts` - Static user data
- `src/types/apps/userTypes.ts` - TypeScript type definitions
- `src/views/apps/user-list/` - UI components

## 📡 API Endpoints

### GET `/api/apps/user-list`
Get all users with optional filtering, sorting, and pagination.

**Authentication:** Not required (demo data)

**Query Parameters:**
- `q` (string): Search query for name, email, or username
- `role` (string): Filter by user role (admin, editor, maintainer, author, subscriber)
- `status` (string): Filter by user status (active, pending, inactive)
- `currentPlan` (string): Filter by subscription plan (basic, team, company, enterprise)
- `page` (number): Page number for pagination (default: 1)
- `limit` (number): Number of items per page (default: 10)
- `sortBy` (string): Field to sort by (default: 'id')
- `sortOrder` (string): Sort order ('asc' or 'desc', default: 'asc')

**Response:**
```json
{
  "users": [
    {
      "id": 1,
      "fullName": "Galen Slixby",
      "company": "Yotz PVT LTD",
      "role": "editor",
      "username": "gslixby0",
      "country": "El Salvador",
      "contact": "(479) 232-9151",
      "email": "gslixby0@abc.net.au",
      "currentPlan": "enterprise",
      "status": "inactive",
      "avatar": "",
      "avatarColor": "primary"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10,
  "totalPages": 5
}
```

**AI Agent Usage:**
- Fetch paginated user lists for admin interfaces
- Apply filters and search to find specific users
- Sort users by various criteria
- Implement infinite scroll or pagination

## 🎯 Core Features

### 1. User Data Structure
- **Basic Info**: ID, full name, username, email, contact
- **Business Info**: Company, role, current plan
- **Location**: Country
- **Status**: Active, pending, inactive
- **Avatar**: Image URL or color fallback

### 2. Advanced Filtering
- **Text Search**: Search across multiple fields
- **Role Filter**: Filter by user roles
- **Status Filter**: Filter by account status
- **Plan Filter**: Filter by subscription plans
- **Multi-field**: Combine multiple filters

### 3. Sorting & Pagination
- **Field Sorting**: Sort by any user field
- **Direction Control**: Ascending/descending order
- **Page-based**: Traditional pagination
- **Limit Control**: Configurable page sizes

### 4. Data Types
```typescript
export type UsersType = {
  id: number
  fullName: string
  company: string
  role: string
  username: string
  country: string
  contact: string
  email: string
  currentPlan: string
  status: string
  avatar?: string
  avatarColor?: string
}
```

## 🗄️ Data Source

### Fake Database Structure
```typescript
// Sample user data structure
const db: UsersType[] = [
  {
    id: 1,
    fullName: "Galen Slixby",
    company: "Yotz PVT LTD",
    role: "editor",
    username: "gslixby0",
    country: "El Salvador",
    contact: "(479) 232-9151",
    email: "gslixby0@abc.net.au",
    currentPlan: "enterprise",
    status: "inactive",
    avatar: "",
    avatarColor: "primary"
  }
  // ... 49 more users
]
```

### Production Database Schema
```prisma
model User {
  id          Int      @id @default(autoincrement())
  fullName    String
  company     String?
  role        String
  username    String   @unique
  country     String?
  contact     String?
  email       String   @unique
  currentPlan String
  status      String
  avatar      String?
  avatarColor String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## 🔧 Implementation Details

### Filtering Logic
```typescript
// Text search across multiple fields
const searchFields = ['fullName', 'email', 'username', 'company']
const searchFilter = (user: UsersType) => {
  if (!q) return true
  return searchFields.some(field =>
    user[field]?.toLowerCase().includes(q.toLowerCase())
  )
}

// Role, status, and plan filters
const roleFilter = (user: UsersType) =>
  !role || user.role === role

const statusFilter = (user: UsersType) =>
  !status || user.status === status

const planFilter = (user: UsersType) =>
  !currentPlan || user.currentPlan === currentPlan
```

### Sorting Implementation
```typescript
const sortUsers = (users: UsersType[], sortBy: string, sortOrder: 'asc' | 'desc') => {
  return users.sort((a, b) => {
    const aValue = a[sortBy]
    const bValue = b[sortBy]

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })
}
```

### Pagination Logic
```typescript
const paginateUsers = (users: UsersType[], page: number, limit: number) => {
  const startIndex = (page - 1) * limit
  const endIndex = startIndex + limit

  return {
    users: users.slice(startIndex, endIndex),
    total: users.length,
    page,
    limit,
    totalPages: Math.ceil(users.length / limit)
  }
}
```

## 🚀 Usage Examples

### Basic User List Fetch
```typescript
const response = await fetch('/api/apps/user-list')
const data = await response.json()

console.log(`Total users: ${data.total}`)
console.log(`Current page: ${data.page}/${data.totalPages}`)
```

### Filtered User Search
```typescript
// Search for users with "admin" role
const response = await fetch('/api/apps/user-list?role=admin')
const admins = await response.json()

// Search for active users
const activeResponse = await fetch('/api/apps/user-list?status=active')
const activeUsers = await activeResponse.json()

// Combined filters
const filteredResponse = await fetch('/api/apps/user-list?role=editor&status=active&currentPlan=enterprise')
const filteredUsers = await filteredResponse.json()
```

### Paginated Results
```typescript
// Get page 2 with 20 users per page
const response = await fetch('/api/apps/user-list?page=2&limit=20')
const pageData = await response.json()

// Navigate through pages
const totalPages = pageData.totalPages
for (let page = 1; page <= totalPages; page++) {
  const pageResponse = await fetch(`/api/apps/user-list?page=${page}&limit=10`)
  const pageUsers = await pageResponse.json()
  // Process page users
}
```

### Sorted User Lists
```typescript
// Sort by name ascending
const nameSort = await fetch('/api/apps/user-list?sortBy=fullName&sortOrder=asc')

// Sort by email descending
const emailSort = await fetch('/api/apps/user-list?sortBy=email&sortOrder=desc')

// Sort by company
const companySort = await fetch('/api/apps/user-list?sortBy=company&sortOrder=asc')
```

### Advanced Search and Filter
```typescript
// Complex query with multiple parameters
const params = new URLSearchParams({
  q: 'john',                    // Search for "john"
  role: 'admin',                // Only admins
  status: 'active',             // Only active users
  currentPlan: 'enterprise',    // Enterprise plan
  page: '1',                    // Page 1
  limit: '5',                   // 5 per page
  sortBy: 'fullName',           // Sort by name
  sortOrder: 'asc'              // Ascending
})

const response = await fetch(`/api/apps/user-list?${params}`)
const results = await response.json()
```

## 🤖 AI Agent Integration Guide

### Core Workflow for AI Agents

1. **Data Retrieval**
   ```typescript
   // Fetch all users
   const allUsers = await fetch('/api/apps/user-list')

   // Fetch with pagination
   const paginatedUsers = await fetch('/api/apps/user-list?page=1&limit=20')

   // Apply filters
   const filteredUsers = await fetch('/api/apps/user-list?role=admin&status=active')
   ```

2. **Search and Filter Operations**
   ```typescript
   // Text search
   const searchUsers = async (query: string) => {
     const response = await fetch(`/api/apps/user-list?q=${encodeURIComponent(query)}`)
     return response.json()
   }

   // Role-based filtering
   const getUsersByRole = async (role: string) => {
     const response = await fetch(`/api/apps/user-list?role=${role}`)
     return response.json()
   }

   // Status filtering
   const getUsersByStatus = async (status: string) => {
     const response = await fetch(`/api/apps/user-list?status=${status}`)
     return response.json()
   }
   ```

3. **Pagination Handling**
   ```typescript
   // Handle pagination
   const loadAllUsers = async () => {
     const allUsers = []
     let page = 1
     let hasMore = true

     while (hasMore) {
       const response = await fetch(`/api/apps/user-list?page=${page}&limit=50`)
       const data = await response.json()

       allUsers.push(...data.users)
       hasMore = page < data.totalPages
       page++
     }

     return allUsers
   }
   ```

4. **Sorting Operations**
   ```typescript
   // Sort users by different criteria
   const sortUsers = async (sortBy: string, sortOrder: 'asc' | 'desc' = 'asc') => {
     const response = await fetch(`/api/apps/user-list?sortBy=${sortBy}&sortOrder=${sortOrder}`)
     return response.json()
   }

   // Get users sorted by name
   const usersByName = await sortUsers('fullName')

   // Get users sorted by email
   const usersByEmail = await sortUsers('email', 'desc')
   ```

### Error Handling for AI Agents

- **Invalid Parameters**: Check query parameter values
- **Empty Results**: Handle no users found scenarios
- **Pagination Errors**: Validate page and limit values
- **Network Errors**: Implement retry logic

### Best Practices

- **Efficient Pagination**: Use appropriate page sizes
- **Selective Filtering**: Combine filters to reduce data transfer
- **Caching**: Cache frequently accessed user data
- **Search Optimization**: Use debounced search for better UX
- **Type Safety**: Use TypeScript interfaces for type checking

### Advanced Use Cases

```typescript
// User analytics
const getUserStats = async () => {
  const allUsers = await loadAllUsers()

  const stats = {
    total: allUsers.length,
    byRole: allUsers.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1
      return acc
    }, {}),
    byStatus: allUsers.reduce((acc, user) => {
      acc[user.status] = (acc[user.status] || 0) + 1
      return acc
    }, {}),
    byPlan: allUsers.reduce((acc, user) => {
      acc[user.currentPlan] = (acc[user.currentPlan] || 0) + 1
      return acc
    }, {})
  }

  return stats
}

// Bulk operations
const bulkUpdateUsers = async (userIds: number[], updates: Partial<UsersType>) => {
  // Note: This would require additional API endpoints for bulk operations
  // Currently, individual user updates would be needed
  const results = []

  for (const userId of userIds) {
    // Update each user individually
    const result = await updateUser(userId, updates)
    results.push(result)
  }

  return results
}
```

---

*This documentation is designed for AI agents to understand and maintain the user list functionality.*