import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { lucia } from '@/libs/lucia'

export async function getLuciaSession(request?: NextRequest) {
  let sessionId: string | null = null

  if (request) {
    sessionId = lucia.readSessionCookie(request.headers.get('cookie') ?? '')
  } else {
    // For server components, use cookies() from next/headers
    const cookieStore = await cookies()
    sessionId = lucia.readSessionCookie(cookieStore.toString())
  }

  const { session, user } = await lucia.validateSession(sessionId || '')

  return { session, user }
}

export async function requireAuth(request?: NextRequest) {
  const { session, user } = await getLuciaSession(request)

  if (!session || !user) {
    throw new Error('Unauthorized')
  }

  // Load user role for permissions
  if (user && user.roleId) {
    const { prisma } = await import('@/libs/prisma')
    const role = await prisma.role.findUnique({
      where: { id: user.roleId }
    })
    if (role) {
      (user as any).role = role
    }
  }

  return { session, user }
}