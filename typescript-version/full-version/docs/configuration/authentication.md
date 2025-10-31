# Authentication

## Overview

Welcome to modern authentication with NextAuth.js! This guide introduces password-less authentication and how NextAuth.js helps achieve authentication goals.

### Why NextAuth.js?

Our authentication philosophy centers on password-less authentication for enhanced security and user experience. NextAuth.js provides the robust features and flexibility needed for this vision.

### Getting Started

Authentication is implemented using NextAuth.js for secure user authentication.

**Demonstrated Methods:**

- **Credentials Provider**: Traditional username/password authentication
- **Google Provider + Prisma Adapter**: Google account sign-in with Prisma data management

### What's Next?

Explore comprehensive guides for setting up both authentication methods. Whether you prefer Credentials Provider or Google Provider with Prisma Adapter, detailed instructions are available.

Adapt these methods to your application's authentication needs.

**Happy authenticating!** 🛡️🔐

### Auth Other than NextAuth.js

If you don't want to use NextAuth.js:

- Start with the starter-kit
- Follow the [Remove Authentication from full-version](docs/setup.md) guide
- Implement custom authentication logic
- Consider alternatives like Auth0, Firebase, Amazon Cognito, Supabase

## Credentials Provider Using NextAuth.js

### Overview

Welcome to seamless authentication with NextAuth.js Credentials Provider! This guide walks through implementation step-by-step.

### Prerequisites

Basic understanding of NextAuth.js required. Refer to [NextAuth.js documentation](https://next-auth.js.org/) for refresher.

### Initialize NextAuth.js

Next.js 13.2+ uses Route Handlers for REST-like requests in App Router.

**Route Handler** (`src/app/api/auth/[...nextauth]/route.ts`):

```typescript
// Third-party Imports
import NextAuth from 'next-auth'

// Lib Imports
import { authOptions } from '@/libs/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

NextAuth.js detects Route Handler initialization and returns appropriate handlers.

### auth.ts file

Authentication logic implemented in `src/libs/auth.ts`. Customize according to project needs.

**Note:** All options explained below. Refer to [NextAuth documentation](https://next-auth.js/configuration/options) for complete list.

### Providers

Using `CredentialsProvider` for username/password authentication. Multiple providers can be configured.

**Options:**

- **`name`**: Display name on sign-in form ('Sign in with...')
- **`type`**: Provider type ('credentials')
- **`credentials`**: Define required credentials (username/password)
- **`authorize`**: Callback for credential validation. Return user object or null/false.

**Caution:** Make API call to login endpoint. Remove sensitive data from responses.

Refer to [NextAuth providers documentation](https://next-auth.js.org/configuration/providers) for more options.

### secret

Random string for hashing tokens and generating keys. Set via `NEXTAUTH_SECRET` environment variable.

Generate secret at [NextAuth documentation](https://next-auth.js/configuration/options#secret).

### session

- **`strategy`**: Session storage method ('jwt' or 'database')
- **`maxAge`**: Session idle timeout in seconds

Refer to [NextAuth session documentation](https://next-auth.js/configuration/options#session).

### pages

Custom URLs for sign-in, sign-out, and error pages.

Refer to [NextAuth pages documentation](https://next-auth.js/configuration/options#pages).

### callbacks

Asynchronous functions controlling authentication actions.

#### jwt()

Called when JWT created/updated. Add custom parameters here for session access.

#### session()

Called when session checked. Forward token data to client.

Refer to [NextAuth callbacks documentation](https://next-auth.js.org/configuration/options#callbacks).

### Login Form & API

#### Login Form

Use `signIn` function from `next-auth/client`. Calls login API and returns user data.

Refer to `src/views/Login.tsx` for implementation.

#### Login API

Create login API for credential authentication.

Refer to `src/app/api/login/route.ts` for implementation.

### Extending NextAuth Types for Custom User Fields

For custom user fields like `role`, extend NextAuth types.

**Create `next-auth.d.ts`**:

```typescript
import 'next-auth/jwt'
import { DefaultSession } from 'next-auth'

declare module 'next-auth/jwt' {
  type JWT = {
    role: string
  }
}

declare module 'next-auth' {
  type Session = {
    user: {
      role: string
    } & DefaultSession['user']
  }

  type User = {
    role: string
  }
}
```

**Update `src/libs/auth.ts` callbacks**:

```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.name = user.name
      token.role = user.role
    }
    return token
  },
  async session({ session, token }) {
    if (session.user) {
      session.user.name = token.name
      session.user.role = token.role
    }
    return session
  }
}
```

**Usage**:

```typescript
import { useSession } from 'next-auth/react'

const { data: session } = useSession()
const userRole = session?.user?.role || 'defaultRole'
```

**Info:** NextAuth customization (session strategy, expiration, pages, callbacks) varies by implementation and is not covered by support.

## NextAuth with Google Provider and Prisma Adapter

### Overview

Welcome to seamless authentication with NextAuth.js Google Provider and Prisma Adapter! This guide provides step-by-step implementation.

### Prerequisites

Basic understanding of NextAuth.js, Google Cloud, and Prisma required. Refer to documentation: [NextAuth.js](https://next-auth.js.org/), [Google Cloud](https://cloud.google.com/), [Prisma](https://www.prisma.io/).

### Google Cloud Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Select/create project
3. Create OAuth 2.0 credentials
4. Set authorized redirect URIs:
   - Production: `https://{YOUR_DOMAIN}/api/auth/callback/google`
   - Development: `http://localhost:3000/api/auth/callback/google`
5. Save `CLIENT_ID` and `CLIENT_SECRET` in `.env`:

```env
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_GOES_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_GOES_HERE
```

### Prisma Adapter Setup

**Caution:** Remove `@db.Text` from `prisma/schema.prisma` if using SQLite.

Follow [NextAuth PrismaAdapter documentation](https://next-auth.js.org/adapters/prisma).

**package.json configuration:**
```json
"prisma": {
  "schema": "./src/prisma/schema.prisma"
}
```

**Schema configuration** (`src/prisma/schema.prisma`):
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

**Environment** (`.env`):
```env
DATABASE_URL=file:./dev.db
```

Modify schema as needed, then run:

```bash
npx prisma generate
pnpm migrate
```

View database with:
```bash
npx prisma studio
```

### Initialize NextAuth.js

Using Route Handlers in Next.js 13.2+ App Router.

**Route Handler** (`src/app/api/auth/[...nextauth]/route.ts`):

```typescript
// Third-party Imports
import NextAuth from 'next-auth'

// Lib Imports
import { authOptions } from '@/libs/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

### auth.ts file

Authentication logic in `src/libs/auth.ts`. Customize per project needs.

### providers

Using `GoogleProvider` for Google sign-in. Multiple providers supported.

**Options:**
- `clientId`: Google Cloud project client ID
- `clientSecret`: Google Cloud project client secret

Refer to [NextAuth providers documentation](https://next-auth.js.org/configuration/providers).

### secret

Random string for tokens/keys. Set via `NEXTAUTH_SECRET` environment variable.

### session

- **`strategy`**: Session storage ('jwt' or 'database')
- **`maxAge`**: Idle timeout in seconds

### pages

Custom authentication page URLs.

### callbacks

Control authentication actions.

#### jwt()

Called on JWT creation/update. Add custom parameters.

#### session()

Called on session check. Forward token data to client.

### Login Form

Use `signIn` from `next-auth/react`:

```typescript
'use client'

// Third-party Imports
import { signIn } from 'next-auth/react'

const Login = () => {
  return (
    <button onClick={() => signIn('google')}>Login with Google</button>
  )
}

export default Login
```

### Extending NextAuth Types for Custom User Fields

For custom fields like `role`, extend NextAuth types.

**Create `next-auth.d.ts`**:

```typescript
import 'next-auth/jwt'
import { DefaultSession } from 'next-auth'

declare module 'next-auth/jwt' {
  type JWT = {
    role: string
  }
}

declare module 'next-auth' {
  type Session = {
    user: {
      role: string
    } & DefaultSession['user']
  }

  type User = {
    role: string
  }
}
```

**Update `src/libs/auth.ts` callbacks**:

```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.name = user.name
      token.role = user.role
    }
    return token
  },
  async session({ session, token }) {
    if (session.user) {
      session.user.name = token.name
      session.user.role = token.role
    }
    return session
  }
}
```

**Usage**:

```typescript
import { useSession } from 'next-auth/react'

const { data: session } = useSession()
const userRole = session?.user?.role || 'defaultRole'
```

**Info:** NextAuth customization varies by implementation.

### Useful Links

- [Prisma (SQLite) with Next.js video](https://www.youtube.com/watch?v=KoDtEc8c-iA)
- [NextAuth with PrismaAdapter (Planetscale) video](https://www.youtube.com/watch?v=7Za4DtcSgOA)
- [NextAuth with CredentialProvider article](https://next-auth.js.org/configuration/providers/credentials)

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

1. **Remove CredentialProvider** from `src/libs/auth.ts`
2. **Remove** `src/app/api/login` folder
3. **Update** `handleSubmit` in `src/views/Login.tsx`:

```typescript
const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault()
}
```

4. **Remove** unused hooks and imports from `src/views/Login.tsx`

### Remove Google Provider from the full-version

1. **Remove GoogleProvider** and PrismaAdapter from `src/libs/auth.ts`:

```typescript
// Remove these imports
- import { PrismaAdapter } from '@auth/prisma-adapter'
- import { PrismaClient } from '@prisma/client'
- import type { Adapter } from 'next-auth/adapters'

// Remove these lines
- const prisma = new PrismaClient()
- adapter: PrismaAdapter(prisma) as Adapter,
```

2. **Remove** `src/prisma` folder
3. **Remove** Google sign-in button from `src/views/Login.tsx`:

```typescript
// Remove this button
<button className='block' onClick={() => signIn('google')}>
  Login with google
</button>
```

4. **Remove** environment variables from `.env`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `DATABASE_URL`

5. **Update** `package.json` scripts:

```json
"scripts": {
  "postinstall": "npm run build:icons"
},
// Remove prisma config
```

6. **Remove dependencies**:
```bash
pnpm remove @auth/prisma-adapter @prisma/client prisma dotenv-cli
```

### Remove Authentication completely from the full-version

1. **Remove** files & folders:
   - `src/app/api/auth`
   - `src/app/api/login`
   - `src/libs/auth.ts`
   - `src/contexts/nextAuthProvider.tsx`
   - `src/prisma`
   - `src/hocs/AuthGuard.tsx`
   - `src/hocs/GuestOnlyRoute.tsx`
   - `src/components/AuthRedirect.tsx`

2. **Remove** signOut & useSession from `src/components/layout/shared/UserDropdown.tsx`

3. **Remove** signIn from `src/views/Login.tsx`

4. **Remove** NextAuthProvider from `src/components/Providers.tsx`

5. **Remove** `src/app/[lang]/(blank-layout-pages)/(guest-only)/layout.tsx`

6. **Move** files from `(guest-only)` to `(blank-layout-pages)` and remove empty directory

7. **Move** files from `(private)` to `(dashboard)` and remove empty directory

8. **Remove** environment variables:
   - `NEXTAUTH_BASEPATH`
   - `NEXTAUTH_URL`
   - `NEXTAUTH_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
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
pnpm remove @auth/prisma-adapter @prisma/client next-auth prisma dotenv-cli
```

## Add Authentication to Starter-kit

**Warning:** Only for those using the starter-kit.

### Overview

This guide walks through adding authentication partly or completely to your starter-kit using NextAuth.js.

### With NextAuth

#### Prerequisites

1. **Add dependency**:
```bash
pnpm install next-auth
```

2. **Add environment variables** from full-version's `.env`:
   - `BASEPATH`
   - `NEXTAUTH_BASEPATH`
   - `NEXTAUTH_URL`
   - `NEXTAUTH_SECRET`
   - `API_URL`
   - `NEXT_PUBLIC_API_URL`

3. **Copy files** from full-version:
   - `src/app/api/auth/[...nextauth]/route.ts`
   - `src/contexts/nextAuthProvider.tsx`

4. **Add NextAuthProvider** to `src/components/Providers.tsx` (from full-version)

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

1. **Copy** `src/app/api/login` folder from full-version
2. **Copy** `src/libs/auth.ts` (remove GoogleProvider code if not needed)
3. **Copy** `src/views/Login.tsx` (remove Google sign-in code if not needed)

**Note:** Remove i18n code from `Login.tsx` if not using internationalization

### Add Google Provider with Prisma Adapter

For Google authentication:

1. **Add dependencies**:
```bash
pnpm install @auth/prisma-adapter @prisma/client prisma dotenv-cli
```

2. **Update package.json**:
```json
"scripts": {
  "migrate": "dotenv -e .env -- npx prisma migrate dev",
  "postinstall": "prisma generate && npm run build:icons"
},
"prisma": {
  "schema": "./src/prisma/schema.prisma"
}
```

3. **Add environment variables**:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `DATABASE_URL`

4. **Copy files**:
   - `src/libs/auth.ts` (remove CredentialsProvider if not needed)
   - `src/views/Login.tsx` (remove email/password code if not needed)
   - `src/prisma/schema.prisma`

5. **Run commands**:
```bash
pnpm migrate
npx prisma generate
```

**Note:** Remove i18n/validation code from `Login.tsx` if not needed

### Signing Out

Copy `signOut` import and usage from full-version's `src/components/layout/shared/UserDropdown.tsx`

### Adding User's Name and Email to User Dropdown

Copy `useSession` import and usage from full-version's `src/components/layout/shared/UserDropdown.tsx`

### Without NextAuth

Alternative authentication approaches:
- [Custom Auth Video](https://www.youtube.com/watch?v=DJvM2lSPn6w)
- [Next.js Auth Guide](https://nextjs.org/learn/dashboard-app/adding-authentication)
