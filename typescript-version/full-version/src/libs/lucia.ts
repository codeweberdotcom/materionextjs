import { Lucia } from 'lucia'
import { PrismaAdapter } from '@lucia-auth/adapter-prisma'
import { prisma } from './prisma'
import { isProduction } from '@/shared/config/env'

export const lucia = new Lucia(new PrismaAdapter(prisma.session, prisma.user), {
  sessionCookie: {
    expires: false,
    attributes: {
      secure: isProduction
    }
  },
  getUserAttributes: attributes => ({
    id: attributes.id,
    email: attributes.email,
    name: attributes.name,
    image: attributes.image,
    roleId: attributes.roleId,
    permissions: attributes.permissions
  })
})

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia
    DatabaseUserAttributes: {
      id: string
      email: string
      name: string | null
      image: string | null
      roleId: string
      permissions: string | null
    }
  }
}

// Export types for use in auth utilities
export type LuciaUser = Awaited<ReturnType<typeof lucia.validateSession>>['user']
export type LuciaSession = Awaited<ReturnType<typeof lucia.validateSession>>['session']
