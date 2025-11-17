import type { NextRequest } from 'next/server'

/**
 * Возвращает IP-адрес клиента из заголовков/контекста Next.js.
 */
export function getRequestIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const candidate = forwardedFor.split(',')[0]?.trim()
    if (candidate) {
      return candidate
    }
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp?.trim()) {
    return realIp.trim()
  }

  return null
}
