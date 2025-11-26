"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaRateLimitStore = void 0;
class PrismaRateLimitStore {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async consume(params) {
        const { key, module, config, increment, warnThreshold, mode, now, recordEvent, userId, email, emailHash, ipAddress, ipHash, ipPrefix, hashVersion } = params;
        const outcome = await this.prisma.$transaction(async (tx) => {
            let state = await tx.rateLimitState.findUnique({
                where: {
                    key_module: {
                        key,
                        module
                    }
                }
            });
            const windowExpired = state ? state.windowEnd <= now : true;
            if (!state || windowExpired) {
                const windowStart = this.calculateWindowStart(now, config.windowMs);
                const windowEnd = new Date(windowStart.getTime() + config.windowMs);
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
                    });
                }
                else {
                    const stillBlocked = state.blockedUntil && state.blockedUntil.getTime() > now.getTime() ? state.blockedUntil : null;
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
                    });
                }
            }
            if (!state) {
                return {
                    result: {
                        allowed: true,
                        remaining: config.maxRequests,
                        resetTime: now.getTime() + config.windowMs
                    }
                };
            }
            if (state.blockedUntil && state.blockedUntil > now) {
                if (mode === 'monitor') {
                    state = await tx.rateLimitState.update({
                        where: { key_module: { key, module } },
                        data: { blockedUntil: null }
                    });
                }
                else {
                    const blockDuration = config.blockMs ?? config.windowMs;
                    if (blockDuration > 0) {
                        const latestAllowedEnd = new Date(now.getTime() + blockDuration);
                        if (state.blockedUntil.getTime() > latestAllowedEnd.getTime()) {
                            state = await tx.rateLimitState.update({
                                where: { key_module: { key, module } },
                                data: { blockedUntil: latestAllowedEnd }
                            });
                        }
                    }
                    return {
                        result: {
                            allowed: false,
                            remaining: 0,
                            resetTime: state.windowEnd.getTime(),
                            blockedUntil: state.blockedUntil?.getTime()
                        }
                    };
                }
            }
            const remainingBefore = Math.max(0, config.maxRequests - state.count);
            const warnPreview = warnThreshold > 0 && remainingBefore > 0 && remainingBefore <= warnThreshold;
            if (!increment) {
                return {
                    result: {
                        allowed: true,
                        remaining: remainingBefore,
                        resetTime: state.windowEnd.getTime(),
                        warning: warnPreview ? { remaining: remainingBefore } : undefined
                    }
                };
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
                    windowEnd: true,
                    blockedUntil: true
                }
            });
            const newCount = updatedState.count;
            const remainingAfter = Math.max(0, config.maxRequests - newCount);
            const warnTriggered = warnThreshold > 0 &&
                remainingBefore > warnThreshold &&
                remainingAfter <= warnThreshold &&
                remainingBefore > remainingAfter &&
                remainingAfter > 0;
            const blockTriggered = newCount > config.maxRequests;
            const crossedLimitFirstTime = blockTriggered && remainingBefore >= 0 && remainingBefore <= config.maxRequests;
            if (blockTriggered) {
                const blockDuration = config.blockMs ?? config.windowMs;
                const blockedUntil = new Date(now.getTime() + blockDuration);
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
                    });
                }
                return {
                    blockEvent: crossedLimitFirstTime
                        ? {
                            module,
                            key,
                            userId,
                            email,
                            emailHash,
                            ipAddress,
                            ipHash,
                            ipPrefix,
                            hashVersion,
                            eventType: 'block',
                            mode,
                            count: newCount,
                            maxRequests: config.maxRequests,
                            windowStart: updatedState.windowStart,
                            windowEnd: updatedState.windowEnd,
                            blockedUntil: mode === 'enforce' ? blockedUntil : null
                        }
                        : undefined,
                    result: mode === 'monitor'
                        ? {
                            allowed: true,
                            remaining: 0,
                            resetTime: updatedState.windowEnd.getTime(),
                            warning: { remaining: 0 }
                        }
                        : {
                            allowed: false,
                            remaining: 0,
                            resetTime: updatedState.windowEnd.getTime(),
                            blockedUntil: blockedUntil.getTime()
                        }
                };
            }
            const showWarningAfter = warnThreshold > 0 && remainingAfter > 0 && remainingAfter <= warnThreshold;
            return {
                warningEvent: warnTriggered
                    ? {
                        module,
                        key,
                        userId,
                        email,
                        emailHash,
                        ipAddress,
                        ipHash,
                        ipPrefix,
                        hashVersion,
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
                    resetTime: updatedState.windowEnd.getTime(),
                    warning: showWarningAfter ? { remaining: remainingAfter } : undefined
                }
            };
        });
        if (outcome.warningEvent) {
            await recordEvent(outcome.warningEvent);
        }
        if (outcome.blockEvent) {
            await recordEvent(outcome.blockEvent);
        }
        return outcome.result;
    }
    async resetCache() {
        // Prisma backend stores state in the database, nothing to clear
        return;
    }
    async shutdown() {
        // Nothing to dispose
        return;
    }
    calculateWindowStart(now, windowMs) {
        const timestamp = now.getTime();
        const aligned = timestamp - (timestamp % windowMs);
        return new Date(aligned);
    }
}
exports.PrismaRateLimitStore = PrismaRateLimitStore;
