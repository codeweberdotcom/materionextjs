import { ExtendedError } from 'socket.io'

import { rateLimitService } from '@/lib/rate-limit'
import logger, { rateLimitLogger } from '../../logger'
import type { ServerToClientEvents, TypedSocket } from '../types/common'

type SocketRateLimitOptions = {
  module: string
  warnEvent?: keyof ServerToClientEvents
  exceededEvent?: keyof ServerToClientEvents
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
        rateLimitLogger.limitApplied(rateKey, socket.handshake.address, result.remaining, result.resetTime)
        return next()
      }

      const blockedUntil = result.blockedUntil ?? result.resetTime
      const msBeforeNext = Math.max(0, blockedUntil - Date.now())
      const retryAfterSec = Math.max(1, Math.ceil(msBeforeNext / 1000))

      rateLimitLogger.limitExceeded(rateKey, socket.handshake.address, socket.id, msBeforeNext)

      if (exceededEvent) {
        socket.emit(exceededEvent, {
          error: 'Rate limit exceeded',
          blockedUntilMs: blockedUntil,
          retryAfterSec,
          remaining: result.remaining,
          // Legacy для совместимости
          retryAfter: retryAfterSec,
          blockedUntil
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

export const rateLimitChatMessages = createSocketRateLimiter({
  module: 'chat-messages',
  warnEvent: 'rateLimitWarning',
  exceededEvent: 'rateLimitExceeded',
  context: 'chat-messages-rate-limit'
})

export const rateLimitChatRooms = createSocketRateLimiter({
  module: 'chat-rooms',
  warnEvent: 'rateLimitWarning',
  exceededEvent: 'rateLimitExceeded',
  context: 'chat-rooms-rate-limit'
})

export const rateLimitChatRead = createSocketRateLimiter({
  module: 'chat-read',
  warnEvent: 'rateLimitWarning',
  exceededEvent: 'rateLimitExceeded',
  context: 'chat-read-rate-limit'
})

export const rateLimitChatPing = createSocketRateLimiter({
  module: 'chat-ping',
  warnEvent: 'rateLimitWarning',
  exceededEvent: 'rateLimitExceeded',
  context: 'chat-ping-rate-limit'
})

export const rateLimitNotification = createSocketRateLimiter({
  module: 'notifications',
  context: 'notification-rate-limit'
})

export const rateLimitChatConnections = createSocketRateLimiter({
  module: 'chat-connections',
  context: 'chat-connections-rate-limit'
})

// Export factory for potential reuse
export { createSocketRateLimiter }
