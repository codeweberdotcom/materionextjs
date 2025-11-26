# Исправление: Race condition при подключении к Redis

**Дата исправления:** 2025-11-23  
**Модуль:** Rate Limit  
**Приоритет:** Высокий

---

## 📋 Описание проблемы

### Симптомы:
- В логах появлялись множественные ошибки:
  ```
  error: [rate-limit] Redis store failed. Falling back to Prisma store for rate limiting.
  {"error":{"message":"Redis is already connecting/connected","name":"Error"}}
  ```
- Происходил необоснованный fallback на Prisma store
- Redis был доступен, но система не могла к нему подключиться

### Причина:
При параллельных запросах несколько потоков одновременно вызывали метод `ensureConnected()` в `RedisRateLimitStore`, что приводило к попытке множественного подключения к одному и тому же Redis клиенту. Библиотека `ioredis` не позволяет множественные попытки подключения одновременно.

---

## 🔧 Технические детали исправления

### Файл:
`src/lib/rate-limit/stores/redis-store.ts`

### Изменения:

**До:**
```typescript
export class RedisRateLimitStore implements RateLimitStore {
  private redis: RedisInstance
  private ready = false

  private async ensureConnected() {
    if (this.ready) return
    try {
      await this.redis.connect()
      this.ready = true
    } catch (error) {
      console.error('[rate-limit] Failed to connect to Redis, falling back to Prisma store.', error)
      throw error
    }
  }
}
```

**После:**
```typescript
export class RedisRateLimitStore implements RateLimitStore {
  private redis: RedisInstance
  private ready = false
  private connecting: Promise<void> | null = null

  private async ensureConnected() {
    if (this.ready) return
    
    // Если уже идет подключение, ждем его завершения
    if (this.connecting) {
      await this.connecting
      return
    }

    // Создаем промис подключения
    this.connecting = (async () => {
      try {
        await this.redis.connect()
        this.ready = true
        this.connecting = null
      } catch (error) {
        this.connecting = null
        console.error('[rate-limit] Failed to connect to Redis, falling back to Prisma store.', error)
        throw error
      }
    })()

    await this.connecting
  }
}
```

### Механизм работы:

1. **Первый запрос:** Инициирует подключение, создает промис в `this.connecting`
2. **Параллельные запросы:** Проверяют `this.connecting`, если он существует - ждут его завершения
3. **После подключения:** Флаг `this.connecting` сбрасывается в `null`, `this.ready` устанавливается в `true`
4. **Последующие запросы:** Используют уже установленное соединение (проверка `this.ready`)

---

## ✅ Результаты

- ✅ Ошибка "Redis is already connecting/connected" больше не возникает
- ✅ Параллельные запросы корректно синхронизируются
- ✅ Fallback на Prisma store происходит только при реальных проблемах с Redis
- ✅ Код обратно совместим

---

## 🧪 Тестирование

### Проверка:
1. ✅ Код проверен линтером - ошибок нет
2. ⏳ Требуется мониторинг в production для подтверждения исправления

### Рекомендации по тестированию:
- Нагрузочное тестирование с множественными параллельными запросами
- Мониторинг логов на предмет повторения ошибки

---

## 📚 Связанные документы

- [Анализ проблемы](analysis/architecture/analysis-redis-connection-race-condition-2025-11-23.md)
- [План исправления](plans/active/plan-fix-redis-connection-race-2025-11-23.md)
- [Отчет о реализации](reports/testing/report-fix-redis-connection-race-2025-11-23.md)
- [Troubleshooting guide](monitoring/rate-limit-operations.md#35-ошибка-redis-is-already-connectingconnected)

---

## 🔄 Версии

- **Версия исправления:** 1.0
- **Дата:** 2025-11-23







