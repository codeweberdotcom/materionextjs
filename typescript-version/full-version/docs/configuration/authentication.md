# Authentication

## Overview

Welcome to modern authentication with Lucia Auth v3.x! This guide introduces secure session-based authentication and how Lucia helps achieve authentication goals.

### Why Lucia Auth?

Our authentication philosophy centers on secure, lightweight session management with minimal dependencies. Lucia Auth provides robust security features, flexibility, and excellent performance for modern web applications.

### Getting Started

Authentication is implemented using Lucia Auth v3.x for secure user authentication with session-based approach.

**Demonstrated Methods:**

- **Credentials Provider**: Traditional username/password authentication with bcrypt hashing
- **Session Management**: Secure cookie-based sessions with automatic expiration
- **Role-Based Access Control**: Integrated permission system with user roles

### What's Next?

Explore comprehensive guides for setting up authentication with Lucia. Whether you need basic login/logout or complex role-based permissions, detailed instructions are available.

Adapt these methods to your application's authentication needs.

**Happy authenticating!** 🛡️🔐

### Auth Other than Lucia

If you don't want to use Lucia:

- Start with the starter-kit
- Follow the [Remove Authentication from full-version](docs/setup.md) guide
- Implement custom authentication logic
- Consider alternatives like Auth0, Firebase, Amazon Cognito, Supabase

## Credentials Provider Using Lucia Auth

### Overview

Welcome to seamless authentication with Lucia Auth Credentials Provider! This guide walks through implementation step-by-step.

### Prerequisites

Basic understanding of Lucia Auth required. Refer to [Lucia Auth documentation](https://lucia-auth.com/) for refresher.

### Initialize Lucia Auth

Lucia Auth uses Prisma Adapter for database integration and provides secure session management.

**Configuration** (`src/libs/lucia.ts`):

```typescript
import { Lucia } from 'lucia';
import { PrismaAdapter } from '@lucia-auth/adapter-prisma';
import { prisma } from './prisma';

export const lucia = new Lucia(new PrismaAdapter(prisma.session, prisma.user), {
  sessionCookie: {
    expires: false,
    attributes: {
      secure: process.env.NODE_ENV === 'production',
    },
  },
  getUserAttributes: (attributes) => {
    return {
      id: attributes.id,
      email: attributes.email,
      name: attributes.name,
      roleId: attributes.roleId,
      permissions: attributes.permissions,
    };
  },
});

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      id: string;
      email: string;
      name: string;
      roleId: string;
      permissions: string;
    };
  }
}
```

### Authentication Utilities

Authentication utilities implemented in `src/utils/auth.ts`. Customize according to project needs.

**Key Functions:**

- **`requireAuth(request?)`**: Validates user session and returns user data
- **`getLuciaSession(request?)`**: Gets session data from cookies
- **`validateSession(sessionId)`**: Validates session ID

### Login API

Create login API for credential authentication with bcrypt password hashing.

**Route Handler** (`src/app/api/auth/login/route.ts`):

```typescript
export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true }
  })

  // Validate password with bcrypt
  const isValidPassword = await bcrypt.compare(password, user.password)

  // Create session
  const session = await lucia.createSession(user.id, {})

  // Set session cookie
  const sessionCookie = lucia.createSessionCookie(session.id)

  return NextResponse.json({ user, session }, {
    headers: {
      'Set-Cookie': sessionCookie.serialize()
    }
  })
}
```

### Session Management

Lucia handles session creation, validation, and cookie management automatically.

**Session Configuration:**

- **Cookie Security**: HTTPS-only in production
- **Expiration**: Sessions don't expire by default
- **Attributes**: Customizable cookie attributes

### Logout API

**Route Handler** (`src/app/api/auth/logout/route.ts`):

```typescript
export async function POST(request: NextRequest) {
  const { session } = await requireAuth(request)

  // Invalidate session
  await lucia.invalidateSession(session.id)

  // Clear session cookie
  const blankCookie = lucia.createBlankSessionCookie()

  return NextResponse.json({ success: true }, {
    headers: {
      'Set-Cookie': blankCookie.serialize()
    }
  })
}
```

### Login Form & API

#### Login Form

Use fetch API to call login endpoint and handle authentication.

Refer to `src/views/Login.tsx` for implementation.

#### Login API

Create login API for credential authentication with Lucia session management.

Refer to `src/app/api/auth/login/route.ts` for implementation.

### Extending Lucia Types for Custom User Fields

For custom user fields like `role`, extend Lucia types.

**Update `src/libs/lucia.ts`**:

```typescript
declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      id: string;
      email: string;
      name: string;
      roleId: string;
      permissions: string;
    };
  }
}
```

### Session Validation

Use `requireAuth()` utility for protected routes:

```typescript
import { requireAuth } from '@/utils/auth'

export async function GET(request: NextRequest) {
  const { user, session } = await requireAuth(request)

  // User is authenticated
  return NextResponse.json({ user })
}
```

### Client-Side Authentication

Use custom hooks for client-side authentication state:

```typescript
import { useAuth } from '@/contexts/AuthProvider'

const { user, isLoading } = useAuth()

if (isLoading) return <div>Loading...</div>
if (!user) return <div>Please login</div>

return <div>Welcome {user.name}!</div>
```

**Info:** Lucia customization (session configuration, cookie settings, user attributes) varies by implementation.

## Lucia Auth with OAuth Providers (Future Enhancement)

### Overview

Lucia Auth supports OAuth providers through custom implementation. This section describes how to add OAuth providers like Google in the future.

### Prerequisites

Basic understanding of Lucia Auth, OAuth flows, and Prisma required. Refer to documentation: [Lucia Auth](https://lucia-auth.com/), [OAuth 2.0](https://oauth.net/2/).

### OAuth Setup (Conceptual)

1. **Provider Configuration**: Set up OAuth app in provider console (Google, GitHub, etc.)
2. **Redirect URIs**: Configure callback URLs for your application
3. **Credentials**: Store client ID and secret securely

### Implementation Steps

1. **Install OAuth library** (if needed):
```bash
pnpm install @lucia-auth/oauth
```

2. **Configure OAuth provider** in Lucia setup

3. **Create OAuth callback handler**

4. **Update login form** with OAuth buttons

### Current Status

The current implementation focuses on credentials-based authentication. OAuth providers can be added as future enhancements following Lucia Auth documentation.

### Useful Links

- [Lucia Auth OAuth documentation](https://lucia-auth.com/oauth)
- [OAuth 2.0 specification](https://oauth.net/2/)
- [Prisma with Lucia Auth](https://lucia-auth.com/database-adapters/prisma)

## Securing Page

In Next.js applications, securing routes based on authentication status is essential. This covers three route types: Public, Private, and Guest-only.

### Public Routes or Shared Routes

Public routes are accessible to all users, authenticated or not. By default, all pages in `src/app` are public.

**Example:**
```typescript
// src/app/about/page.tsx
export default function About() {
  return <h1>About Page - Accessible to everyone</h1>
}
```

Routes under `(blank-layout-pages)` are protected with `GuestOnlyRoute`. Other routes work as shared routes without `AuthGuard` or `GuestOnlyRoute`.

For shared routes with dashboard layout, create `layout.tsx` under `src/app/(dashboard)/(shared-dashboard)`, copy from `src/app/(dashboard)/(private)`, and remove `AuthGuard`.

### Private Routes

Private routes restrict access to authenticated users only. All pages within `src/app/[lang]/(dashboard)/(private)` (with i18n) or `src/app/(dashboard)/(private)` (without i18n) are private.

**Example:**
```typescript
// src/app/[lang]/(dashboard)/(private)/profile/page.tsx
export default function Profile() {
  return <h1>Profile Page - Accessible to authenticated users only</h1>
}
```

Private routes use `AuthGuard` HOC from `src/hocs` to wrap layouts.

### Guest Routes

Guest-only routes (Login, Registration, Forgot Password) are accessible only to unauthenticated users.

All pages within `src/app/[lang]/(blank-layout-pages)/(guest-only)` (with i18n) or `src/app/(blank-layout-pages)/(guest-only)` (without i18n) are guest-only.

**Example:**
```typescript
// src/app/[lang]/(blank-layout-pages)/(guest-only)/login/page.tsx
export default function Login() {
  return <h1>Login Page - Accessible to unauthenticated users only</h1>
}
```

Guest routes use `GuestGuard` HOC from `src/hocs` to wrap layouts.

This ensures secure public, private, and guest-only routes for enhanced security and user experience.

## Remove Authentication from full-version

**Warning:** Only for those using the full-version.

### Overview

This guide walks through removing authentication partly or completely from the full-version.

### Remove Credentials Provider from the full-version

1. **Remove Lucia configuration** from `src/libs/lucia.ts`
2. **Remove** `src/app/api/auth` folder
3. **Update** `handleSubmit` in `src/views/Login.tsx`:

```typescript
const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault()
}
```

4. **Remove** unused hooks and imports from `src/views/Login.tsx`

### Remove Authentication completely from the full-version

1. **Remove** files & folders:
    - `src/app/api/auth`
    - `src/libs/lucia.ts`
    - `src/utils/auth.ts`
    - `src/contexts/AuthProvider.tsx`
    - `src/prisma`
    - `src/hocs/AuthGuard.tsx`
    - `src/hocs/GuestOnlyRoute.tsx`
    - `src/components/AuthRedirect.tsx`

2. **Remove** authentication logic from `src/components/layout/shared/UserDropdown.tsx`

3. **Remove** authentication from `src/views/Login.tsx`

4. **Remove** AuthProvider from `src/components/Providers.tsx`

5. **Remove** `src/app/[lang]/(blank-layout-pages)/(guest-only)/layout.tsx`

6. **Move** files from `(guest-only)` to `(blank-layout-pages)` and remove empty directory

7. **Move** files from `(private)` to `(dashboard)` and remove empty directory

8. **Remove** environment variables:
    - `DATABASE_URL`

9. **Update** `package.json`:

```json
"scripts": {
  "postinstall": "npm run build:icons"
},
// Remove prisma config
```

10. **Remove dependencies**:
```bash
pnpm remove lucia @lucia-auth/adapter-prisma @prisma/client prisma bcryptjs
```

## Add Authentication to Starter-kit

**Warning:** Only for those using the starter-kit.

### Overview

This guide walks through adding authentication partly or completely to your starter-kit using Lucia Auth.

### With Lucia Auth

#### Prerequisites

1. **Add dependencies**:
```bash
pnpm install lucia @lucia-auth/adapter-prisma @prisma/client prisma bcryptjs
```

2. **Add environment variables**:
    - `DATABASE_URL`

3. **Copy files** from full-version:
    - `src/libs/lucia.ts`
    - `src/utils/auth.ts`
    - `src/contexts/AuthProvider.tsx`

4. **Add AuthProvider** to `src/components/Providers.tsx` (from full-version)

#### Folder Structure Changes

1. **Create** `(private)` folder inside `(dashboard)` and move all dashboard content there
2. **Create** `(guest-only)` folder inside `(blank-layout-pages)` and move login/register folders there

Refer to [Securing Page guide](#securing-page) for route details.

#### Additional File Copying

**Copy files** from full-version:
- `src/hocs/AuthGuard.tsx`
- `src/components/AuthRedirect.tsx`
- `src/hocs/GuestOnlyRoute.tsx`
- `(blank-layout-pages)/(guest-only)/layout.tsx`

**Add AuthGuard** to `(dashboard)/(private)/layout.tsx` (from full-version)

#### Adjustments for Projects Without i18n

**AuthGuard.tsx**: Remove `Locale` and related code

**AuthRedirect.tsx**:
- Remove `lang` from function and related code
- Replace `getLocalizedUrl('/your-url', lang)` with `'/your-url'`

**GuestOnlyRoute.tsx**: Remove `lang` and replace `getLocalizedUrl` as above

**(guest-only)/layout.tsx**: Remove `lang` and related code

### Add Credentials Provider

For email/password authentication:

1. **Copy** `src/app/api/auth` folder from full-version
2. **Copy** `src/prisma/schema.prisma`
3. **Copy** `src/views/Login.tsx`

4. **Update package.json**:
```json
"scripts": {
  "migrate": "dotenv -e .env -- npx prisma migrate dev",
  "postinstall": "prisma generate && npm run build:icons"
},
"prisma": {
  "schema": "./src/prisma/schema.prisma"
}
```

5. **Run commands**:
```bash
pnpm migrate
npx prisma generate
```

**Note:** Remove i18n code from `Login.tsx` if not using internationalization

### Database Setup

1. **Configure Prisma** with your database
2. **Run migrations** to create auth tables
3. **Seed initial data** if needed

### Session Management

Lucia handles session creation, validation, and cookie management automatically.

### Without Lucia

Alternative authentication approaches:
- [Custom Auth with Next.js](https://nextjs.org/docs/authentication)
- [Next.js Auth Guide](https://nextjs.org/learn/dashboard-app/adding-authentication)
