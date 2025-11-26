"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimitStore = exports.ResilientRateLimitStore = void 0;
const logger_1 = __importDefault(require("@/lib/logger"));
const rate_limit_1 = require("@/lib/metrics/rate-limit");
const prisma_store_1 = require("./prisma-store");
const redis_store_1 = require("./redis-store");
class ResilientRateLimitStore {
    constructor(primary, fallback) {
        this.primary = primary;
        this.fallback = fallback;
        this.usingPrimary = true;
        this.lastFailure = 0;
        this.RETRY_INTERVAL_MS = 60 * 1000;
        this.fallbackActiveSince = null;
        (0, rate_limit_1.markBackendActive)('redis');
    }
    async consume(...args) {
        return this.execute(store => {
            const backend = store === this.primary ? 'redis' : 'prisma';
            const stopTimer = (0, rate_limit_1.startConsumeDurationTimer)({
                backend,
                module: args[0].module,
                mode: args[0].mode
            });
            return store.consume(...args).finally(() => stopTimer());
        });
    }
    async resetCache(...args) {
        return this.execute(store => store.resetCache(...args));
    }
    async shutdown() {
        await Promise.allSettled([this.primary.shutdown(), this.fallback.shutdown()]);
    }
    async execute(operation) {
        if (!this.usingPrimary) {
            const now = Date.now();
            const shouldRetryPrimary = now - this.lastFailure > this.RETRY_INTERVAL_MS;
            if (shouldRetryPrimary) {
                logger_1.default.info('[rate-limit] Attempting to return to Redis backend after fallback period.');
                try {
                    const result = await operation(this.primary);
                    this.usingPrimary = true;
                    this.lastFailure = 0;
                    (0, rate_limit_1.recordBackendSwitch)('prisma', 'redis');
                    if (this.fallbackActiveSince !== null) {
                        (0, rate_limit_1.recordFallbackDuration)(Date.now() - this.fallbackActiveSince);
                        this.fallbackActiveSince = null;
                    }
                    logger_1.default.info('[rate-limit] Successfully switched back to Redis backend.');
                    return result;
                }
                catch (error) {
                    this.lastFailure = now;
                    logger_1.default.warn('[rate-limit] Redis backend still unavailable, continuing with Prisma fallback.', {
                        error: error instanceof Error ? { message: error.message, name: error.name } : error
                    });
                    return operation(this.fallback);
                }
            }
            return operation(this.fallback);
        }
        try {
            return await operation(this.primary);
        }
        catch (error) {
            this.usingPrimary = false;
            this.lastFailure = Date.now();
            (0, rate_limit_1.recordRedisFailure)();
            (0, rate_limit_1.recordBackendSwitch)('redis', 'prisma');
            if (this.fallbackActiveSince === null) {
                this.fallbackActiveSince = this.lastFailure;
            }
            logger_1.default.error('[rate-limit] Redis store failed. Falling back to Prisma store for rate limiting.', {
                error: error instanceof Error ? { message: error.message, name: error.name } : error
            });
            return operation(this.fallback);
        }
    }
}
exports.ResilientRateLimitStore = ResilientRateLimitStore;
const createRateLimitStore = (prisma) => {
    const prismaStore = new prisma_store_1.PrismaRateLimitStore(prisma);
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
        try {
            const tls = process.env.REDIS_TLS === 'true';
            logger_1.default.info('[rate-limit] Using Redis backend for rate limiting.');
            const redisStore = new redis_store_1.RedisRateLimitStore(redisUrl, tls);
            return new ResilientRateLimitStore(redisStore, prismaStore);
        }
        catch (error) {
            logger_1.default.error('[rate-limit] Failed to initialize Redis backend. Falling back to Prisma.', {
                error: error instanceof Error ? error.message : error
            });
            (0, rate_limit_1.markBackendActive)('prisma');
        }
    }
    else {
        logger_1.default.info('[rate-limit] Redis URL not provided. Using Prisma backend for rate limiting.');
        (0, rate_limit_1.markBackendActive)('prisma');
    }
    return prismaStore;
};
exports.createRateLimitStore = createRateLimitStore;
