"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitService = exports.RateLimitService = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class RateLimitService {
    constructor() {
        this.limiters = new Map();
        this.configs = new Map();
        this.initializeLimiters();
    }
    static getInstance() {
        if (!RateLimitService.instance) {
            RateLimitService.instance = new RateLimitService();
        }
        return RateLimitService.instance;
    }
    async initializeLimiters() {
        // Загружаем конфигурации из БД
        await this.loadConfigs();
        // Создаем лимитеры для каждого модуля
        for (const [module, config] of this.configs) {
            // Используем in-memory для простоты (можно заменить на Redis)
            const limiter = new rate_limiter_flexible_1.RateLimiterMemory({
                keyPrefix: `rate_limit_${module}`,
                points: config.maxRequests, // Number of requests
                duration: Math.ceil(config.windowMs / 1000), // Per duration in seconds
                blockDuration: config.blockMs ? Math.ceil(config.blockMs / 1000) : 0, // Block duration in seconds
            });
            this.limiters.set(module, limiter);
        }
    }
    async loadConfigs() {
        try {
            const configs = await prisma.rateLimitConfig.findMany();
            this.configs.clear();
            for (const config of configs) {
                this.configs.set(config.module, {
                    maxRequests: config.maxRequests,
                    windowMs: config.windowMs,
                    blockMs: config.blockMs
                });
            }
            // Дефолтные настройки если нет в БД
            this.setDefaultConfigs();
        }
        catch (error) {
            console.error('Error loading rate limit configs:', error);
            this.setDefaultConfigs();
        }
    }
    setDefaultConfigs() {
        const defaults = {
            chat: { maxRequests: 10, windowMs: 60 * 1000, blockMs: 15 * 60 * 1000 }, // 10/min, block 15min
            ads: { maxRequests: 5, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 }, // 5/hour, block 1hour
            upload: { maxRequests: 20, windowMs: 60 * 60 * 1000, blockMs: 30 * 60 * 1000 }, // 20/hour, block 30min
            auth: { maxRequests: 5, windowMs: 15 * 60 * 1000, blockMs: 60 * 60 * 1000 }, // 5/15min, block 1hour
            email: { maxRequests: 50, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 } // 50/hour for emails
        };
        for (const [module, config] of Object.entries(defaults)) {
            if (!this.configs.has(module)) {
                this.configs.set(module, config);
            }
        }
    }
    async checkLimit(key, module) {
        const limiter = this.limiters.get(module);
        if (!limiter) {
            return { allowed: true, remaining: 999, resetTime: new Date(Date.now() + 60000) };
        }
        try {
            const res = await limiter.consume(key);
            return {
                allowed: true,
                remaining: res.remainingPoints,
                resetTime: new Date(Date.now() + (res.msBeforeNext || 0))
            };
        }
        catch (rejRes) {
            // Rate limit exceeded
            const resetTime = new Date(Date.now() + (rejRes.msBeforeNext || 0));
            const blockedUntil = rejRes.blockedUntil ? new Date(rejRes.blockedUntil) : undefined;
            return {
                allowed: false,
                remaining: 0,
                resetTime,
                blockedUntil
            };
        }
    }
    async getStats(module) {
        const limiter = this.limiters.get(module);
        if (!limiter)
            return null;
        try {
            // Для RateLimiterMemory можно получить базовую статистику
            // Для Redis/Memory это будет ограничено
            return {
                module,
                config: this.configs.get(module),
                // rate-limiter-flexible не предоставляет детальную статистику
                // без Redis, поэтому возвращаем базовую информацию
                limiterType: limiter.constructor.name
            };
        }
        catch (error) {
            console.error('Error getting rate limit stats:', error);
            return null;
        }
    }
    async updateConfig(module, config) {
        try {
            await prisma.rateLimitConfig.upsert({
                where: { module },
                update: {
                    maxRequests: config.maxRequests,
                    windowMs: config.windowMs,
                    blockMs: config.blockMs
                },
                create: {
                    module,
                    maxRequests: config.maxRequests || 10,
                    windowMs: config.windowMs || 60000,
                    blockMs: config.blockMs || 900000
                }
            });
            // Пересоздаем лимитер с новыми настройками
            await this.reloadLimiter(module);
            return true;
        }
        catch (error) {
            console.error('Error updating rate limit config:', error);
            return false;
        }
    }
    async reloadLimiter(module) {
        const config = this.configs.get(module);
        if (!config)
            return;
        // Удаляем старый лимитер
        this.limiters.delete(module);
        // Создаем новый с обновленными настройками
        const limiter = new rate_limiter_flexible_1.RateLimiterMemory({
            keyPrefix: `rate_limit_${module}`,
            points: config.maxRequests,
            duration: Math.ceil(config.windowMs / 1000),
            blockDuration: config.blockMs ? Math.ceil(config.blockMs / 1000) : 0,
        });
        this.limiters.set(module, limiter);
    }
    async getAllConfigs() {
        return Array.from(this.configs.entries()).map(([module, config]) => (Object.assign({ module }, config)));
    }
    async resetLimits(key, module) {
        try {
            // Для in-memory лимитера просто пересоздаем его
            if (module) {
                await this.reloadLimiter(module);
            }
            else {
                // Пересоздаем все лимитеры
                this.limiters.clear();
                await this.initializeLimiters();
            }
            return true;
        }
        catch (error) {
            console.error('Error resetting rate limits:', error);
            return false;
        }
    }
}
exports.RateLimitService = RateLimitService;
exports.rateLimitService = RateLimitService.getInstance();
