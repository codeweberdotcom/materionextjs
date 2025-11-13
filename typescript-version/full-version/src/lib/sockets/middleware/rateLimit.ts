import { ExtendedError } from 'socket.io'

import { rateLimitService } from '@/lib/rate-limit'
import logger, { rateLimitLogger } from '../../logger'
import type { TypedSocket } from '../types/common'

type SocketRateLimitOptions = {
  module: string
  warnEvent?: string
  exceededEvent?: string
  context?: string
}

const createSocketRateLimiter = (options: SocketRateLimitOptions) => {
  const warnEvent = options.warnEvent
  const exceededEvent = options.exceededEvent
  const context = options.context ?? options.module

  return async (socket: TypedSocket, next: (err?: ExtendedError) => void) => {
    try {
      if (!socket.data?.authenticated) {
        return next(new Error('Not authenticated'))
      }

      const resolvedUserId = socket.data.user?.id
      const ipAddress = socket.handshake.address
      const rateKey = resolvedUserId || ipAddress

      if (!rateKey) {
        logger.warn(`[${context}] Unable to resolve user key for rate limiting`, {
          socketId: socket.id,
          ip: socket.handshake.address
        })
        return next()
      }

      const result = await rateLimitService.checkLimit(rateKey, options.module, {
        userId: resolvedUserId ?? null,
        email: socket.data.user?.email ?? null,
        ipAddress: ipAddress ?? null,
        keyType: resolvedUserId ? 'user' : 'ip'
      })

      if (result.warning && warnEvent) {
        socket.emit(warnEvent, result.warning)
      }

      if (result.allowed) {
        rateLimitLogger.limitApplied(
          rateKey,
          socket.handshake.address,
          result.remaining,
          result.resetTime
        )
        return next()
      }

      const blockedUntil = result.blockedUntil ?? result.resetTime
      const msBeforeNext = Math.max(0, blockedUntil.getTime() - Date.now())
      const retryAfter = Math.max(1, Math.ceil(msBeforeNext / 1000))

      rateLimitLogger.limitExceeded(rateKey, socket.handshake.address, socket.id, msBeforeNext)

      if (exceededEvent) {
        socket.emit(exceededEvent, {
          error: 'Rate limit exceeded',
          retryAfter,
          blockedUntil: blockedUntil.toISOString()
        })
      }

      return next(new Error('Rate limit exceeded'))
    } catch (error) {
      logger.error(`[${context}] Rate limit middleware failed`, {
        error: error instanceof Error ? error.message : error,
        socketId: socket.id,
        module: options.module
      })
      return next(new Error('Rate limit error'))
    }
  }
}

export const rateLimitChat = createSocketRateLimiter({
  module: 'chat',
  warnEvent: 'rateLimitWarning',
  exceededEvent: 'rateLimitExceeded',
  context: 'chat-rate-limit'
})

export const rateLimitNotification = createSocketRateLimiter({
  module: 'notifications',
  context: 'notification-rate-limit'
})
