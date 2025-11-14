# Rate Limiting System API Documentation

## 📋 Overview

The rate limiting system provides comprehensive request throttling and spam protection across different modules (chat, ads, uploads, authentication, emails). It uses a sliding window approach with database persistence and supports both automatic blocking and manual admin controls.

## 🏗️ Architecture

### Components
- **RateLimitService**: Core service class managing all rate limiting logic
- **Database Models**: `RateLimitConfig`, `RateLimitState`, `UserBlock` tables
- **Admin API**: `/api/admin/rate-limits` for configuration management
- **Client-side Checks**: Rate limit validation before API calls

### Key Files
- `src/lib/rate-limit.ts` - Main rate limiting service
- `src/app/api/admin/rate-limits/route.ts` - Admin management endpoints
- `prisma/schema.prisma` - Database schema definitions

## 🔌 Rate Limiting Modules

### Режимы enforcement/monitor
- **Enforce** — стандартный режим. При превышении лимита пользователь получает HTTP 429, блокируется до `blockedUntil`, в `RateLimitEvent` пишется событие `block`, UI скрывает поле ввода.
- **Monitor** — только наблюдение. Событие `warning` записывается в журнал и выводится админу, но пользователь продолжает отправку (UI видит предупреждение и таймер). Используется, когда нужно собрать статистику до включения жёсткой блокировки.
- Переключение режима доступно в админке (`/admin/rate-limits`). В monitor-контексте важно не дублировать уведомления о блокировке.


### 1. Chat Messages (`chat`)
- **Default**: 10 messages per hour
- **Block Duration**: 15 minutes on violation
- **Implementation**: Counts actual messages in database

### 2. Advertisements (`ads`)
- **Default**: 5 requests per hour
- **Block Duration**: 1 hour on violation
- **Use Case**: Prevents ad spam

### 3. File Uploads (`upload`)
- **Default**: 20 uploads per hour
- **Block Duration**: 30 minutes on violation
- **Use Case**: Prevents storage abuse

### 4. Authentication (`auth`)
- **Default**: 5 attempts per 15 minutes
- **Block Duration**: 1 hour on violation
- **Use Case**: Brute force protection

### 5. Email Sending (`email`)
- **Default**: 50 emails per hour
- **Block Duration**: 1 hour on violation
- **Use Case**: Prevents email spam

## 📡 API Endpoints

### GET `/api/admin/rate-limits`
Get all rate limit configurations and statistics (admin/superadmin only).

**Authentication:** Required (admin/superadmin)

**Response:**
```json
{
  "configs": [
    {
      "module": "chat",
      "maxRequests": 10,
      "windowMs": 3600000,
      "blockMs": 900000
    }
  ],
  "stats": [
    {
      "module": "chat",
      "config": {
        "maxRequests": 10,
        "windowMs": 3600000,
        "blockMs": 900000
      },
      "totalRequests": 45,
      "blockedCount": 2,
      "activeWindows": 3
    }
  ]
}
```

**AI Agent Usage:**
- Fetch current rate limit configurations
- Monitor system usage statistics
- Display rate limiting status in admin dashboard

### PUT `/api/admin/rate-limits`
Update rate limit configuration for a module (admin/superadmin only).

**Authentication:** Required (admin/superadmin)

**Request Body:**
```json
{
  "module": "chat",
  "maxRequests": 15,
  "windowMs": 3600000,
  "blockMs": 1800000,
  "warnThreshold": 5,
  "storeEmailInEvents": false,
  "storeIpInEvents": true
}
```

**Response:**
```json
{
  "success": true
}
```

**AI Agent Usage:**
- Modify rate limit settings per module
- Adjust spam protection levels
- Fine-tune system performance

### DELETE `/api/admin/rate-limits`
Reset rate limits for specific keys or modules (admin/superadmin only).

**Query Parameters:**
- `key`: Specific user/IP key to reset
- `module`: Module to reset (optional)

**Response:**
```json
{
  "success": true
}
```

**AI Agent Usage:**
- Unblock users after manual review
- Reset counters for testing
- Emergency rate limit resets

## 🔧 Rate Limit Service Methods

### `checkLimit(key: string, module: string): Promise<RateLimitResult>`
Check if a request should be allowed for the given key and module.

**Parameters:**
- `key`: User ID or IP address
- `module`: Module name (chat, ads, upload, auth, email)

> ⚠️ **Important:** если передать название модуля, для которого нет записи в `RateLimitConfig`, сервис зафиксирует это в логах, автоматически создаст fallback-конфиг в режиме monitor (лимит включён, но блокировка отключена) и продолжит работу. Такое поведение защищает рабочие сценарии, но всё равно требует внимания: добавьте полноценную конфигурацию через миграцию или админку, иначе модуль останется в «наблюдении».

**Returns:**
```typescript
interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number // UNIX timestamp (ms)
  blockedUntil?: number // UNIX timestamp (ms)
}
```

**AI Agent Usage:**
- Validate requests before processing
- Return appropriate error responses
- Track remaining requests for UI feedback

### `getStats(module: string)`
Get statistics for a specific module.

**Returns:**
```typescript
{
  module: string
  config: RateLimitConfig
  totalRequests: number
  blockedCount: number
  activeWindows: number
}
```

**AI Agent Usage:**
- Monitor system health
- Generate usage reports
- Alert on high blocking rates

### `updateConfig(module: string, config: Partial<RateLimitConfig>)`
Update configuration for a module.

**AI Agent Usage:**
- Dynamic rate limit adjustments
- A/B testing different limits
- Automated scaling based on load

## 📊 Monitoring & Metrics

- Эндпоинт `/api/metrics` отдаёт метрики Prometheus с префиксом `materio_` и `rate_limit_*`.
- Ключевые серии:
  - `rate_limit_store_backend{backend="redis"|"prisma"}` — gauge активного стора (подходит для алерта «долго работаем в fallback»).
  - `rate_limit_fallback_switch_total{from,to}` — количество переключений между Redis и Prisma.
  - `rate_limit_redis_failures_total` — сколько ошибок Redis привели к fallback.
  - `rate_limit_consume_duration_seconds{backend,module,mode}` — латентность операций `store.consume()`.
  - `rate_limit_unknown_module_total{module}` — fail-fast на вызовы `checkLimit` без конфигурации (используйте как сигнал misconfig).
- Пример правила Prometheus:

```yaml
- alert: RateLimitFallbackTooLong
  expr: rate_limit_store_backend{backend="prisma"} == 1
  for: 5m
  labels: { severity: warning }
  annotations:
    summary: "Rate limit fallback активен"
    description: "Приложение >5 минут работает на Prisma вместо Redis."
```

## 🧹 Retention и PII

- Таблица `RateLimitEvent` и журнал состояний могут разрастаться. Рекомендуемый TTL:
  - `rate_limit` события — 30 дней для мониторинга, 90 дней для аудита.
  - ручные блокировки (`UserBlock`) — активные до `unblockedAt`, архивируем после 180 дней.
- Настройте cron/скрипт, который удаляет события старше TTL и деактивирует просроченные блокировки.
- Флаги `storeEmailInEvents` / `storeIpInEvents` позволяют ограничить PII в событиях. Для production рекомендуется хранить userId, ipHash/ipPrefix и маскировать «сырые» данные в ответах API.

## 🗄️ Database Schema

### RateLimitConfig
```prisma
model RateLimitConfig {
  id          String   @id @default(cuid())
  module      String   @unique
  maxRequests Int
  windowMs    Int      // milliseconds
  blockMs     Int?     // milliseconds (optional)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### RateLimitState
```prisma
model RateLimitState {
  id          String   @id @default(cuid())
  key         String
  module      String
  count       Int      @default(0)
  windowStart DateTime
  windowEnd   DateTime
  blockedUntil DateTime?

  @@unique([key, module])
}
```

### UserBlock
```prisma
model UserBlock {
  id          String   @id @default(cuid())
  userId      String?
  ipAddress   String?
  module      String
  reason      String
  blockedBy   String
  unblockedAt DateTime?
  isActive    Boolean  @default(true)
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## 🛡️ Security Features

### Multi-layer Protection
- **Database Counting**: Actual usage tracking
- **UserBlock Table**: Manual/admin blocks
- **Sliding Windows**: Time-based rate limiting
- **Automatic Cleanup**: Expired blocks removal

### Block Types
- **Automatic**: Rate limit violations
- **Manual**: Admin-imposed blocks
- **Permanent**: No unblock time set
- **Temporary**: Time-based unblocking

## 🚀 Usage Examples

### Check Rate Limit Before Action
```typescript
import { rateLimitService } from '@/lib/rate-limit'

const result = await rateLimitService.checkLimit(userId, 'chat')

if (!result.allowed) {
  return {
    error: 'Rate limit exceeded',
    retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
    blockedUntil: result.blockedUntil ?? result.resetTime
  }
}

// Proceed with action
```

### Admin Configuration Update
```typescript
const response = await fetch('/api/admin/rate-limits', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    module: 'chat',
    maxRequests: 20,
    windowMs: 3600000, // 1 hour
    blockMs: 900000    // 15 minutes
  })
})
```

### Monitor Statistics
```typescript
const stats = await rateLimitService.getStats('chat')
console.log(`Chat module: ${stats.totalRequests} requests, ${stats.blockedCount} blocked`)
```

## 🔍 Troubleshooting

### Common Issues

1. **Rate limit not working**
   - Check database connectivity
   - Verify module configuration exists
   - Ensure key is properly passed

2. **Blocks not clearing**
   - Check UserBlock table for manual blocks
   - Verify unblockedAt timestamps
   - Check for permanent blocks (null unblockedAt)

3. **Inconsistent counting**
   - Chat module uses message count from DB
   - Other modules use RateLimitState table
   - Ensure proper key identification

### Debug Commands
```bash
# Check rate limit state
SELECT * FROM RateLimitState WHERE module = 'chat' LIMIT 10;

# View active blocks
SELECT * FROM UserBlock WHERE isActive = true;

# Check configurations
SELECT * FROM RateLimitConfig;
```

## 🔒 Privacy & PII considerations

- `RateLimitEvent` сохраняет `userId`, а также опционально `email` и `ipAddress`. Теперь для каждого модуля можно задать флаги `storeEmailInEvents` и `storeIpInEvents` (через `/api/admin/rate-limits` или админку): если значение `false`, соответствующее поле не будет записано в события (оно встанет `null`, даже если сервис получил данные).
- `UserBlock` (ручные блокировки) тоже содержит `ipAddress` и заметки администратора. Старайтесь хранить только необходимый минимум данных, а по окончании расследований очищайте избыточные записи.
- Для аналитики используйте агрегаты (`RateLimitState`, `RateLimitEvent` c индексами `createdAt`). Периодически проверяйте retention-политику и удаляйте устаревшие персональные данные.

## 🤖 AI Agent Integration Guide

### Core Workflow for AI Agents

1. **Pre-request Validation**
   ```typescript
   // Always check rate limits before API calls
   const rateCheck = await rateLimitService.checkLimit(userId, module)

   if (!rateCheck.allowed) {
     // Return 429 with retry information
     return new Response('Rate limit exceeded', {
       status: 429,
       headers: {
         'Retry-After': Math.ceil((rateCheck.resetTime - Date.now()) / 1000).toString(),
         'X-RateLimit-Remaining': rateCheck.remaining.toString()
       }
     })
   }
   ```

2. **Admin Management**
   ```typescript
   // Update rate limits dynamically
   await rateLimitService.updateConfig('chat', {
     maxRequests: 25,
     windowMs: 1800000, // 30 minutes
     blockMs: 3600000   // 1 hour block
   })
   ```

3. **Monitoring and Alerts**
   ```typescript
   // Check for high block rates
   const stats = await rateLimitService.getStats('auth')
   if (stats.blockedCount > stats.totalRequests * 0.1) {
     // Alert: High authentication failure rate
   }
   ```

### Error Handling for AI Agents

- **Rate Limited**: Return 429 with retry headers
- **Configuration Missing**: Use default values
- **Database Errors**: Fallback to allow requests
- **Invalid Keys**: Log and continue

### Performance Optimization

- **Singleton Service**: RateLimitService is a singleton
- **Database Indexing**: Proper indexes on key+module
- **Caching**: In-memory config caching
- **Async Operations**: Non-blocking rate checks

---

*This documentation is designed for AI agents to understand and maintain the rate limiting system functionality.*
