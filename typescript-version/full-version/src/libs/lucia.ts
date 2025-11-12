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
      name: string
      roleId: string
      permissions: string
    }
  }
}
