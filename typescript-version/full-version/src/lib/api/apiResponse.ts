import { NextResponse } from 'next/server'

/**
 * Стандартизированные ответы API
 * Используется совместно с withApiHandler и withPublicHandler
 */
export const apiResponse = {
  /** 200 OK */
  ok: (data: unknown) =>
    NextResponse.json({ success: true, data }, { status: 200 }),

  /** 201 Created */
  created: (data: unknown) =>
    NextResponse.json({ success: true, data }, { status: 201 }),

  /** 204 No Content */
  noContent: () =>
    new NextResponse(null, { status: 204 }),

  /** 400 Bad Request */
  badRequest: (message: string, details?: unknown) =>
    NextResponse.json({ success: false, message, ...(details ? { details } : {}) }, { status: 400 }),

  /** 401 Unauthorized */
  unauthorized: (message = 'Unauthorized') =>
    NextResponse.json({ success: false, message }, { status: 401 }),

  /** 403 Forbidden */
  forbidden: (message = 'Permission denied') =>
    NextResponse.json({ success: false, message }, { status: 403 }),

  /** 404 Not Found */
  notFound: (message = 'Not found') =>
    NextResponse.json({ success: false, message }, { status: 404 }),

  /** 409 Conflict */
  conflict: (message: string) =>
    NextResponse.json({ success: false, message }, { status: 409 }),

  /** 422 Unprocessable Entity — ошибки валидации */
  validationError: (message: string, errors: unknown) =>
    NextResponse.json({ success: false, message, errors }, { status: 422 }),

  /** 429 Too Many Requests */
  tooManyRequests: (retryAfterMs: number, details?: unknown) => {
    const retryAfterSec = Math.ceil((retryAfterMs - Date.now()) / 1000)

    return NextResponse.json(
      { success: false, message: 'Too many requests', retryAfterSec, ...(details ? { details } : {}) },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfterSec.toString()
        }
      }
    )
  },

  /** 500 Internal Server Error */
  error: (message = 'Internal server error') =>
    NextResponse.json({ success: false, message }, { status: 500 })
}
