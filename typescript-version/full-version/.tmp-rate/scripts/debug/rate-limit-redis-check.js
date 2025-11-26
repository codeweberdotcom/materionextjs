"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rate_limit_1 = require("../../src/lib/rate-limit");
const TEST_MODULE = 'codex-redis-test';
const TEST_KEY = 'codex-test-user';
async function run() {
    console.log('🔄 Setting up test config...');
    await rate_limit_1.rateLimitService.updateConfig(TEST_MODULE, {
        maxRequests: 2,
        windowMs: 5000,
        blockMs: 15000,
        warnThreshold: 1,
        isActive: true,
        mode: 'enforce',
        storeEmailInEvents: false,
        storeIpInEvents: true
    });
    await rate_limit_1.rateLimitService.resetLimits(TEST_KEY, TEST_MODULE);
    console.log('🚀 Invoking rateLimitService.checkLimit three times');
    for (let attempt = 1; attempt <= 3; attempt++) {
        const result = await rate_limit_1.rateLimitService.checkLimit(TEST_KEY, TEST_MODULE, {
            userId: TEST_KEY,
            email: 'codex@example.com',
            ipAddress: '127.0.0.1',
            keyType: 'user'
        });
        console.log(`Attempt ${attempt}:`, result);
    }
    console.log('✅ Done.');
}
run().catch(error => {
    console.error('Rate limit redis check failed', error);
    process.exit(1);
});
