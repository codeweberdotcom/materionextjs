import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { lucia, LuciaSession, LuciaUser } from '@/libs/lucia'
import { prisma } from '@/libs/prisma'
import type { Role } from '@prisma/client'

export type AuthenticatedUser = LuciaUser extends null ? null : LuciaUser & { role?: Role | null }

export async function getLuciaSession(request?: NextRequest) {
  let sessionId: string | null = null

  if (request) {
    sessionId = lucia.readSessionCookie(request.headers.get('cookie') ?? '')
  } else {
    // For server components, use cookies() from next/headers
    const cookieStore = await cookies()
    sessionId = lucia.readSessionCookie(cookieStore.toString())
  }

  return lucia.validateSession(sessionId || '')
}

export async function requireAuth(request?: NextRequest) {
  const { session, user } = await getLuciaSession(request)

  if (!session || !user) {
    throw new Error('Unauthorized')
  }

  const role = user.roleId
    ? await prisma.role.findUnique({
        where: { id: user.roleId }
      })
    : null

  const enrichedUser: NonNullable<AuthenticatedUser> = {
    ...user,
    role
  }

  return { session, user: enrichedUser }
}

export async function optionalRequireAuth(request?: NextRequest) {
  try {
    return await requireAuth(request)
  } catch {
    return { session: null, user: null }
  }
}
