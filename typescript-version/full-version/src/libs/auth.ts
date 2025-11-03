// Third-party Imports
import CredentialProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import type { NextAuthOptions, User } from 'next-auth'
import type { Adapter } from 'next-auth/adapters'
import bcrypt from 'bcryptjs'

// Initialize Prisma client
import { PrismaClient } from '@prisma/client'
import { PrismaAdapter } from '@auth/prisma-adapter'

import { prisma } from './prisma'

// Cache utilities (simple in-memory cache for demo)
const cache = new Map<string, { data: any; expires: number }>()

const getCache = async (key: string) => {
  const item = cache.get(key)
  if (item && Date.now() < item.expires) {
    return item.data
  }
  cache.delete(key)
  return null
}

const setCache = async (key: string, data: any, ttlSeconds: number) => {
  cache.set(key, {
    data,
    expires: Date.now() + (ttlSeconds * 1000)
  })
}

const deleteCache = async (key: string) => {
  cache.delete(key)
}

// Extend NextAuth types
declare module 'next-auth' {
  interface User {
    id: string
    role?: {
      id: string
      name: string
      description?: string | null
      permissions?: string | null
    }
  }

  interface Session {
    user: User & {
      id: string
      role?: {
        id: string
        name: string
        description?: string | null
        permissions?: string | null
      }
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: {
      id: string
      name: string
      description?: string | null
      permissions?: string | null
    }
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,

  // ** Configure one or more authentication providers
  // ** Please refer to https://next-auth.js.org/configuration/options#providers for more `providers` options
  providers: [
    CredentialProvider({
      // ** The name to display on the sign in form (e.g. 'Sign in with...')
      // ** For more details on Credentials Provider, visit https://next-auth.js.org/providers/credentials
      name: 'Credentials',
      type: 'credentials',

      /*
       * As we are using our own Sign-in page, we do not need to change
       * username or password attributes manually in following credentials object.
       */
      credentials: {},
      async authorize(credentials, req) {
        /*
         * You need to provide your own logic here that takes the credentials submitted and returns either
         * an object representing a user or value that is false/null if the credentials are invalid.
         * For e.g. return { id: 1, name: 'J Smith', email: 'jsmith@example.com' }
         * You can also use the `req` object to obtain additional parameters (i.e., the request IP address)
         */
        const { email, password, locale = 'en' } = credentials as { email: string; password: string; locale?: string }

        // Load dictionary
        let dict: any = {}

        try {
          const dictModule = await import(`../data/dictionaries/${locale}.json`)

          dict = dictModule.default
        } catch (error) {
          console.error('Error loading dictionary:', error)

          // Fallback to English
          const dictModule = await import('../data/dictionaries/en.json')

          dict = dictModule.default
        }

        try {
          // Find user by email
          const user = await prisma.user.findUnique({
            where: { email },
            include: { role: true }
          })

          if (!user) {
            throw new Error(dict.navigation?.invalidCredentials || 'Email or Password is invalid')
          }

          // Check if user is active
          if (!user.isActive) {
            throw new Error(dict.navigation?.accountSuspended || 'Your account has been suspended. Please contact administrator.')
          }

          // Check if user has a role
          if (!user.role) {
            throw new Error(dict.navigation?.roleNotFound || 'User role not found. Please contact administrator.')
          }

          // Verify password
          const isPasswordValid = await bcrypt.compare(password, user.password)

          if (!isPasswordValid) {
            throw new Error(dict.navigation?.invalidCredentials || 'Email or Password is invalid')
          }

          /*
           * Please unset all the sensitive information of the user either from API response or before returning
           * user data below. Below return statement will set the user object in the token and the same is set in
           * the session which will be accessible all over the app.
           */
          return {
            id: user.id,
            role: user.role
          }
        } catch (e: any) {
          console.error('Auth error:', e)
          throw new Error(e.message)
        }
      }
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
    })

    // ** ...add more providers here
  ],

  // ** Please refer to https://next-auth.js.org/configuration/options#session for more `session` options
  session: {
    /*
     * Choose how you want to save the user session.
     * The default is `jwt`, an encrypted JWT (JWE) stored in the session cookie.
     * If you use an `adapter` however, NextAuth default it to `database` instead.
     * You can still force a JWT session by explicitly defining `jwt`.
     * When using `database`, the session cookie will only contain a `sessionToken` value,
     * which is used to look up the session in the database.
     * If you use a custom credentials provider, user accounts will not be persisted in a database by NextAuth.js (even if one is configured).
     * The option to use JSON Web Tokens for session tokens must be enabled to use a custom credentials provider.
     */
    strategy: 'jwt',

    // ** Seconds - How long until an idle session expires and is no longer valid
    maxAge: 30 * 24 * 60 * 60 // ** 30 days
  },

  // ** Please refer to https://next-auth.js.org/configuration/options#pages for more `pages` options
  pages: {
    signIn: '/login'
  },

  // ** Please refer to https://next-auth.js.org/configuration/options#callbacks for more `callbacks` options
  callbacks: {
    /*
     * While using `jwt` as a strategy, `jwt()` callback will be called before
     * the `session()` callback. So we have to add custom parameters in `token`
     * via `jwt()` callback to make them accessible in the `session()` callback
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }

      
return token
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        // Check cache first (30 seconds TTL)
        const cacheKey = `user_status_${token.id}`
        const cachedData = await getCache(cacheKey)

        let user
        if (cachedData) {
          user = cachedData
        } else {
          // Fetch from database if not cached
          user = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: { role: true }
          })

          if (user) {
            // Cache user data for 30 seconds
            await setCache(cacheKey, user, 30)
          }
        }

        if (user) {
          // Check if user is still active during session validation
          if (!user.isActive) {
            // Clear cache for inactive user
            await deleteCache(cacheKey)
            // Return null to invalidate the session
            throw new Error('User account is suspended')
          }

          session.user.id = user.id
          session.user.name = user.name
          session.user.email = user.email
          session.user.image = user.image
          session.user.role = { id: user.role.id, name: user.role.name, description: user.role.description, permissions: user.role.permissions }
        }
      }

      return session
    }
  }
}
