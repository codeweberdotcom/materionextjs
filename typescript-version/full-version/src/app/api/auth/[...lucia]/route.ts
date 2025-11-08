import { NextRequest, NextResponse } from 'next/server'
import { lucia } from '@/libs/lucia'

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(lucia.sessionCookieName)?.value ?? null

  if (!sessionId) {
    return new Response(null, {
      status: 401,
    })
  }

  const { session, user } = await lucia.validateSession(sessionId)

  if (!session) {
    return new Response(null, {
      status: 401,
    })
  }

  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export async function POST(request: NextRequest) {
  return new Response()
}