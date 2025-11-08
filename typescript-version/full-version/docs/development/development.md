# Development Guidelines

This document outlines the development standards, best practices, and workflows for the Materio MUI Next.js Admin Template.

## 🏗️ Development Environment

### Required Tools

- **Node.js**: 18.17.0+ (preferably 20.x LTS)
- **npm**: 9.0.0+ (or yarn/pnpm)
- **Git**: Latest stable version
- **VS Code**: Recommended IDE with extensions:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - Prisma

### VS Code Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "christian-kohler.path-intl",
    "ms-vscode-remote.remote-containers"
  ]
}
```

### Installation Errors

Causes of pnpm install, yarn install or npm install issues can be due to various things which include:

Missing or inappropriate dependencies like node or some other environmental issues.
Dependency resolved by package manager (pnpm/yarn/npm) conflicts with other installed dependency.
The dependency of the package we use have an internal issue or that dependency has some issue with your environment.
Package or dependency of the package requires some additional step or configuration to work in your environment.
Downloaded package is broken or is tampered with.
To resolve such installation issues:

Try using pnpm if possible (recommended).
Please try downloading the fresh package/zip and performing the installation again.
Please make sure you are using the LTS version of node which is recommended and not one with the latest features.
Try running the pnpm cache clean, yarn cache clean or npm cache clean command.
After following the steps explained above, if you are still getting any errors, please raise support at our support portal with the below details:

Your OS information, Node version, pnpm/yarn/npm version, Template/Package version.
Mention if you can run a fresh react project using npx create-next-app@latest without our template/package.
Attach log file of the error you are getting in your console(provide full log).
Mention which command you are running.
Mention if you are were able to run our template on one machine and not on another.

## 📁 Project Structure Guidelines

### File Naming Conventions

- **Components**: PascalCase (`UserCard.tsx`, `DataTable.tsx`)
- **Utilities**: camelCase (`formatDate.ts`, `validateEmail.ts`)
- **Hooks**: camelCase with `use` prefix (`usePermissions.ts`)
- **Types**: PascalCase with `Type` suffix (`UserType.ts`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_ROUTES.ts`)

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── [lang]/            # Internationalized routes
│   │   ├── (dashboard)/   # Route groups
│   │   └── api/           # API routes
├── components/             # Reusable components
│   ├── ui/               # Basic UI components
│   ├── layout/           # Layout components
│   └── forms/            # Form components
├── hooks/                 # Custom hooks
├── libs/                  # Third-party configurations
├── utils/                 # Utility functions
├── types/                 # TypeScript definitions
├── styles/                # Global styles
└── data/                  # Static data
```

## Customizing our Components

Overview
This guide provides a straightforward approach to customize our components in your project. Whether you're dealing with components in the src/@core, src/@layouts, src/@menu or src/components folders, this document outlines the steps to customize them according to your needs.

Components in our core folders
Heads up!
Do not make any changes in the src/@core, src/@layout and src/@menu folders unless suggested by our support team. It is the core functionality of the template which is responsible to run the template.

The src/@core, src/@layout and src/@menu folders will receive updates with each new release. Kindly handle these folders with utmost care, as they contain crucial elements that ensure the template runs properly. Unauthorized changes to them could result in conflicts with subsequent updates, potentially disrupting your project.

If you want to customize components located in the src/@core, src/@layouts, or src/@menu folders, you should follow the steps below:

Creating a new file:

Create a new file in the src/components folder
Copy the code from the original component file (located in src/@core, src/@layouts, or src/@menu) and paste it into the new file
Make the necessary changes in this new file according to your project requirements
Updating imports: After creating and modifying the new component, remember to update the import paths in your project to point to the new component file.

Example
Let's say you want to customize our Customizer component located in src/@core/components/customizer folder. To do this, you should follow the steps below:

Copy the src/@core/components/customizer folder and paste it into the src/components folder
Make the necessary changes in the src/components/customizer folder according to your project requirements
Search for the '@core/components/customizer' import path in your project and update it to '@components/customizer'
That's it! You have successfully customized the Customizer component in your project and maintained the integrity of the core components.

You can customize any component in the src/@core, src/@layouts, or src/@menu folders by following the steps outlined above.

Components in src/components
If the component you wish to customize is located in the src/components folder, you can directly modify the component file. Just follow the steps below:

Locate the component file in the src/components folder
Make the necessary changes in the component file according to your project requirements.

Conclusion
By following these steps, you can effectively customize components in your project while maintaining the integrity of the core components. This approach ensures that your modifications are safely segregated, making future updates and maintenance more manageable.

## 💻 Coding Standards

### TypeScript Guidelines

#### Type Definitions

```typescript
// ✅ Good: Explicit types
interface User {
  id: string
  name: string
  email: string
  role: Role
}

// ✅ Good: Generic types
type ApiResponse<T> = {
  data: T
  message: string
  status: number
}

// ❌ Bad: any type
const user: any = {}

// ✅ Good: Union types
type Status = 'active' | 'inactive' | 'pending'
```

#### Function Signatures

```typescript
// ✅ Good: Proper typing
function createUser(data: CreateUserInput): Promise<User> {
  // implementation
}

// ✅ Good: Optional parameters
function updateUser(id: string, updates: Partial<User>): Promise<User> {
  // implementation
}

// ✅ Good: Generic functions
function fetchData<T>(endpoint: string): Promise<T> {
  // implementation
}
```

### React Best Practices

#### Component Structure

```typescript
// ✅ Good: Functional component with hooks
import { useState, useEffect } from 'react'

interface UserCardProps {
  user: User
  onEdit: (user: User) => void
}

export function UserCard({ user, onEdit }: UserCardProps) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="user-card">
      <h3>{user.name}</h3>
      <button onClick={() => onEdit(user)}>Edit</button>
    </div>
  )
}
```

#### Custom Hooks

```typescript
// ✅ Good: Custom hook for data fetching
import { useState, useEffect } from 'react'

export function useUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      setUsers(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { users, loading, error, refetch: fetchUsers }
}
```

### API Development

#### Route Structure

```typescript
// ✅ Good: API route with proper error handling
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'
import { checkPermission } from '@/utils/permissions'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Permission check
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { role: true }
    })

    if (!checkPermission(currentUser, 'users', 'read')) {
      return NextResponse.json(
        { message: 'Permission denied' },
        { status: 403 }
      )
    }

    const users = await prisma.user.findMany()
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## 🧪 Testing Guidelines

### Unit Tests

```typescript
// ✅ Good: Component testing with React Testing Library
import { render, screen, fireEvent } from '@testing-library/react'
import { UserCard } from './UserCard'

const mockUser = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com'
}

describe('UserCard', () => {
  test('renders user information', () => {
    render(<UserCard user={mockUser} onEdit={() => {}} />)

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  test('calls onEdit when edit button is clicked', () => {
    const mockOnEdit = jest.fn()
    render(<UserCard user={mockUser} onEdit={mockOnEdit} />)

    fireEvent.click(screen.getByText('Edit'))
    expect(mockOnEdit).toHaveBeenCalledWith(mockUser)
  })
})
```

### API Testing

```typescript
// ✅ Good: API route testing
import { createMocks } from 'node-mocks-http'
import { GET } from './route'

describe('/api/users', () => {
  test('returns users data', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: {
        authorization: 'Bearer valid-token'
      }
    })

    await GET(req, res)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(Array.isArray(data)).toBe(true)
  })
})
```

## 🔒 Security Best Practices

### Input Validation

```typescript
// ✅ Good: Input validation with Zod
import { z } from 'zod'

const createUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8)
})

export async function POST(request: Request) {
  const body = await request.json()

  try {
    const validatedData = createUserSchema.parse(body)
    // Proceed with validated data
  } catch (error) {
    return NextResponse.json(
      { message: 'Invalid input data', errors: error.errors },
      { status: 400 }
    )
  }
}
```

### Authentication Checks

```typescript
// ✅ Good: Consistent auth checks
import { getServerSession } from 'next-auth'
import { authOptions } from '@/libs/auth'

export async function protectedRoute() {
  const session = await getServerSession(authOptions)

  if (!session) {
    throw new Error('Unauthorized')
  }

  return session
}
```

## 🎨 Styling Guidelines

### Tailwind CSS

```typescript
// ✅ Good: Utility-first approach
function Button({ variant = 'primary', children }) {
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors'
  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300'
  }

  return (
    <button className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </button>
  )
}
```

### CSS Modules

```css
/* ✅ Good: Scoped styles */
.container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}
```

## 🚀 Performance Optimization

### Code Splitting

```typescript
// ✅ Good: Dynamic imports
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <div>Loading...</div>
})

function Page() {
  return (
    <div>
      <HeavyComponent />
    </div>
  )
}
```

### Image Optimization

```typescript
// ✅ Good: Next.js Image component
import Image from 'next/image'

function Avatar({ src, alt }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={40}
      height={40}
      className="rounded-full"
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
    />
  )
}
```

## 📝 Documentation Standards

### Code Comments

```typescript
// ✅ Good: JSDoc comments for functions
/**
 * Creates a new user in the database
 * @param data - User creation data
 * @returns Promise resolving to created user
 * @throws Error if user creation fails
 */
async function createUser(data: CreateUserInput): Promise<User> {
  // Implementation
}

// ✅ Good: Inline comments for complex logic
function calculatePermissions(user: User) {
  // Check if user is superadmin (has all permissions)
  if (user.role.permissions === 'all') {
    return PERMISSIONS.all
  }

  // Parse JSON permissions or return empty object
  try {
    return JSON.parse(user.role.permissions)
  } catch {
    return {}
  }
}
```

### Component Documentation

```typescript
interface DataTableProps<T> {
  /** Array of data items to display */
  data: T[]
  /** Configuration for table columns */
  columns: ColumnConfig<T>[]
  /** Callback when row is selected */
  onRowSelect?: (row: T) => void
  /** Whether to show loading state */
  loading?: boolean
}

/**
 * Reusable data table component with sorting, filtering, and pagination
 */
export function DataTable<T>({ data, columns, onRowSelect, loading }: DataTableProps<T>) {
  // Implementation
}
```

## 🔄 Git Workflow

### Branch Naming

```bash
# Feature branches
feature/add-user-management
feature/implement-chat-system

# Bug fixes
fix/login-validation-error
fix/permission-check-failure

# Hotfixes
hotfix/critical-security-patch

# Releases
release/v1.2.0
```

### Commit Messages

```bash
# ✅ Good: Conventional commits
feat: add user registration functionality
fix: resolve permission check bug in admin panel
docs: update API documentation for user endpoints
style: format code with prettier
refactor: simplify user authentication logic
test: add unit tests for permission utilities
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots
If applicable, add screenshots of changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] Security review completed
```

## 🧹 Code Quality Tools

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'next/core-web-vitals',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    'react-hooks/exhaustive-deps': 'warn'
  }
}
```

### Prettier Configuration

```javascript
// .prettierrc.js
module.exports = {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'none',
  printWidth: 100
}
```

## 🚀 Deployment

Heads up!
Please note that deployment falls outside the scope of our support services. We do not offer assistance or troubleshooting for deployment issues.

We highly recommend referring to resources that are specifically dedicated to this aspect.

Recommended Resources
Next.js Official Deployment Documentation
The Next.js framework has comprehensive guidelines and best practices for deployment. Please visit the Next.js Deployment Documentation for detailed instructions and tips on deploying your Next.js application. This resource covers a variety of hosting platforms and addresses common deployment scenarios.

Community Support and Forums
Numerous community forums and discussion platforms can offer valuable insights:

Stack Overflow: A large community of developers where you can search for answers or ask specific questions about Next.js deployment.
Next.js GitHub Discussions: Engage with the Next.js community on GitHub for deployment-related queries and discussions.
Static Export not possible
Static export is not possible with our template. Please refer to this FAQ for more information.

### Deployment Checklist

#### Pre-deployment

- [ ] Run full test suite
- [ ] Lint code with ESLint
- [ ] Format code with Prettier
- [ ] Build production bundle
- [ ] Test build locally
- [ ] Update version number
- [ ] Update changelog
- [ ] Review environment variables

#### Post-deployment

- [ ] Verify application loads
- [ ] Test critical user flows
- [ ] Check logs for errors
- [ ] Monitor performance metrics
- [ ] Update documentation if needed

## 📚 Learning Resources

### Recommended Reading

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Material-UI Documentation](https://mui.com/material-ui/)

### Development Tools

- [VS Code Extensions](https://marketplace.visualstudio.com)
- [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools)
- [Prisma Studio](https://www.prisma.io/studio)

## 🤝 Code Review Guidelines

### Reviewer Checklist

- [ ] Code follows established patterns
- [ ] Proper error handling
- [ ] Security considerations addressed
- [ ] Performance implications reviewed
- [ ] Tests included and passing
- [ ] Documentation updated
- [ ] No console.log statements in production code

### Author Checklist

- [ ] Self-review completed
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Migration guide provided if needed

This development guide ensures consistent, maintainable, and scalable code across the project. Follow these guidelines to contribute effectively to the codebase.
