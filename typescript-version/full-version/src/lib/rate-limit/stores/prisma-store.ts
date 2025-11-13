import type { PrismaClient } from '@prisma/client'

import type { RateLimitStore, RateLimitConsumeParams, StoreEventPayload } from './types'
import type { RateLimitResult } from '../types'

type TransactionOutcome = {
  result: RateLimitResult
  warningEvent?: StoreEventPayload
  blockEvent?: StoreEventPayload
}

export class PrismaRateLimitStore implements RateLimitStore {
  constructor(private prisma: PrismaClient) {}

  async consume(params: RateLimitConsumeParams): Promise<RateLimitResult> {
    const { key, module, config, increment, warnThreshold, mode, now, recordEvent, userId, email, ipAddress } = params

    const outcome = await this.prisma.$transaction(async tx => {
      let state = await tx.rateLimitState.findUnique({
        where: {
          key_module: {
            key,
            module
          }
        }
      })

      const windowExpired = state ? state.windowEnd <= now : true
      if (!state || windowExpired) {
        const windowStart = this.calculateWindowStart(now, config.windowMs)
        const windowEnd = new Date(windowStart.getTime() + config.windowMs)

        if (!state) {
          state = await tx.rateLimitState.create({
            data: {
              key,
              module,
              count: 0,
              windowStart,
              windowEnd,
              blockedUntil: null
            }
          })
        } else {
          const stillBlocked =
            state.blockedUntil && state.blockedUntil.getTime() > now.getTime() ? state.blockedUntil : null
          state = await tx.rateLimitState.update({
            where: {
              key_module: {
                key,
                module
              }
            },
            data: {
              count: 0,
              windowStart,
              windowEnd,
              blockedUntil: stillBlocked
            }
          })
        }
      }

      if (!state) {
        return {
          result: {
            allowed: true,
            remaining: config.maxRequests,
            resetTime: new Date(now.getTime() + config.windowMs)
          }
        } as TransactionOutcome
      }

      if (state.blockedUntil && state.blockedUntil > now) {
        if (mode === 'monitor') {
          state = await tx.rateLimitState.update({
            where: { key_module: { key, module } },
            data: { blockedUntil: null }
          })
        } else {
          const blockDuration = config.blockMs ?? config.windowMs
          if (blockDuration > 0) {
            const latestAllowedEnd = new Date(now.getTime() + blockDuration)
            if (state.blockedUntil.getTime() > latestAllowedEnd.getTime()) {
              state = await tx.rateLimitState.update({
                where: { key_module: { key, module } },
                data: { blockedUntil: latestAllowedEnd }
              })
            }
          }

          return {
            result: {
              allowed: false,
              remaining: 0,
              resetTime: state.windowEnd,
              blockedUntil: state.blockedUntil
            }
          } as TransactionOutcome
        }
      }

      const remainingBefore = Math.max(0, config.maxRequests - state.count)
      const warnPreview = warnThreshold > 0 && remainingBefore > 0 && remainingBefore <= warnThreshold

      if (!increment) {
        return {
          result: {
            allowed: true,
            remaining: remainingBefore,
            resetTime: state.windowEnd,
            warning: warnPreview ? { remaining: remainingBefore } : undefined
          }
        } as TransactionOutcome
      }

      const updatedState = await tx.rateLimitState.update({
        where: {
          key_module: {
            key,
            module
          }
        },
        data: {
          count: { increment: 1 }
        },
        select: {
          count: true,
          windowStart: true,
          windowEnd: true
        }
      })

      const newCount = updatedState.count
      const remainingAfter = Math.max(0, config.maxRequests - newCount)

      const warnTriggered =
        warnThreshold > 0 && remainingBefore > warnThreshold && remainingAfter <= warnThreshold && remainingAfter > 0

      const blockTriggered = newCount > config.maxRequests
      const crossedLimitFirstTime = blockTriggered && state.count <= config.maxRequests

      if (blockTriggered) {
        const blockDuration = config.blockMs ?? config.windowMs
        const blockedUntil = new Date(now.getTime() + blockDuration)

        if (mode === 'enforce') {
          await tx.rateLimitState.update({
            where: {
              key_module: {
                key,
                module
              }
            },
            data: {
              blockedUntil
            }
          })
        }

        return {
          blockEvent:
            crossedLimitFirstTime
              ? {
                  module,
                  key,
                  userId,
                  email,
                  ipAddress,
                  eventType: 'block',
                  mode,
                  count: newCount,
                  maxRequests: config.maxRequests,
                  windowStart: updatedState.windowStart,
                  windowEnd: updatedState.windowEnd,
                  blockedUntil: mode === 'enforce' ? blockedUntil : null
                }
              : undefined,
          result:
            mode === 'monitor'
              ? {
                  allowed: true,
                  remaining: 0,
                  resetTime: updatedState.windowEnd,
                  warning: { remaining: 0 }
                }
              : {
                  allowed: false,
                  remaining: 0,
                  resetTime: updatedState.windowEnd,
                  blockedUntil
                }
        } as TransactionOutcome
      }

      const showWarningAfter = warnThreshold > 0 && remainingAfter > 0 && remainingAfter <= warnThreshold

      return {
        warningEvent: warnTriggered
          ? {
              module,
              key,
              userId,
              email,
              ipAddress,
              eventType: 'warning',
              mode,
              count: newCount,
              maxRequests: config.maxRequests,
              windowStart: updatedState.windowStart,
              windowEnd: updatedState.windowEnd,
              blockedUntil: null
            }
          : undefined,
        result: {
          allowed: true,
          remaining: remainingAfter,
          resetTime: updatedState.windowEnd,
          warning: showWarningAfter ? { remaining: remainingAfter } : undefined
        }
      } as TransactionOutcome
    })

    if (outcome.warningEvent) {
      await recordEvent(outcome.warningEvent)
    }
    if (outcome.blockEvent) {
      await recordEvent(outcome.blockEvent)
    }

    return outcome.result
  }

  async resetCache(): Promise<void> {
    // Prisma backend stores state in the database, nothing to clear
    return
  }

  async shutdown(): Promise<void> {
    // Nothing to dispose
    return
  }

  private calculateWindowStart(now: Date, windowMs: number) {
    const timestamp = now.getTime()
    const aligned = timestamp - (timestamp % windowMs)
    return new Date(aligned)
  }
}
