# Rate Limit — операционный гайд

Документ описывает, что делать администратору при сопровождении модуля RateLimit: настройка, мониторинг, troubleshooting, очистка журналов и ручное управление состояниями.

## 1. Настройка и конфигурация

### 1.1 Переменные окружения

```bash
# Обязательные
REDIS_URL=redis://localhost:6379  # Опционально, если не указан - используется Prisma store

# Для хэширования PII (GDPR compliance)
RATE_LIMIT_SECRET=your-secret-key-minimum-32-characters-long  # Секретный ключ для хэширования IP/email
```

### 1.2 Настройка модулей через API

```bash
# Установить конфигурацию для модуля auth
curl -X PUT "http://localhost:3000/api/admin/rate-limits" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "module": "auth",
    "maxRequests": 5,
    "windowMs": 900000,
    "blockMs": 3600000,
    "warnThreshold": 2,
    "mode": "enforce",
    "isActive": true
  }'
```

### 1.3 Режимы работы

- **Enforce** — активная блокировка при превышении лимита
- **Monitor** — только логирование, без блокировки (для сбора статистики)

Переключение режима:
```bash
curl -X PUT "http://localhost:3000/api/admin/rate-limits" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"module": "auth", "mode": "monitor"}'
```

## 2. Мониторинг и метрики

### 2.1 Доступ к метрикам

**Prometheus endpoint:**
```bash
curl -s http://localhost:3000/api/metrics | grep rate_limit
```

**Prometheus query:**
```bash
curl -s http://localhost:9090/api/v1/query \
  --data-urlencode 'query=rate_limit_store_backend'
```

### 2.2 Ключевые метрики

**Backend и failover:**
- `rate_limit_store_backend{backend="redis|prisma"}` — активный стор (1 у текущего)
- `rate_limit_fallback_switch_total{from,to}` — количество переключений Redis↔Prisma
- `rate_limit_fallback_duration_seconds` — время в fallback режиме
- `rate_limit_redis_failures_total` — количество ошибок Redis

**Производительность:**
- `rate_limit_consume_duration_seconds{backend,module,mode}` — латентность операций `store.consume()`
- `rate_limit_check_duration_seconds{module}` — время выполнения `checkLimit()`

**Проверки и события:**
- `rate_limit_checks_total{module,result}` — количество проверок (allowed/blocked)
- `rate_limit_events_total{module,event_type,mode}` — события (warning/block)
- `rate_limit_blocks_total{module,block_type}` — блокировки по типам (automatic, manual, user, ip, email, domain)
- `rate_limit_active_blocks{module,block_type}` — количество активных блоков

**Диагностика:**
- `rate_limit_unknown_module_total{module}` — вызовы `checkLimit` без конфига

### 2.3 Настройка алертов

**Prometheus alert rules:**
```yaml
groups:
  - name: rate_limit
    rules:
      # Fallback активен слишком долго
      - alert: RateLimitFallbackTooLong
        expr: rate_limit_store_backend{backend="prisma"} == 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Rate limit fallback активен"
          description: "Приложение >5 минут работает на Prisma вместо Redis."

      # Неизвестные модули
      - alert: RateLimitUnknownModule
        expr: increase(rate_limit_unknown_module_total[5m]) > 0
        labels:
          severity: warning
        annotations:
          summary: "Обнаружены запросы к неизвестным модулям"
          description: "Модуль {{ $labels.module }} не имеет конфигурации."

      # Высокий процент блокировок
      - alert: RateLimitHighBlockRate
        expr: |
          rate(rate_limit_checks_total{result="blocked"}[5m]) /
          rate(rate_limit_checks_total[5m]) > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Высокий процент блокировок"
          description: "Модуль {{ $labels.module }} блокирует >10% запросов."

      # Медленные проверки
      - alert: RateLimitSlowChecks
        expr: histogram_quantile(0.95, rate(rate_limit_check_duration_seconds_bucket[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Медленные проверки rate limit"
          description: "P95 время проверки {{ $labels.module }} > 100ms."
```

## 3. Troubleshooting

### 3.1 Что делать при fallback

1. Посмотреть логи:
   ```bash
   tail -f logs/error-$(date +%Y-%m-%d).log
   ```
   Сообщение `Redis store failed. Falling back to Prisma store` означает, что Redis недоступен.
2. Проверить доступность Redis (`redis-cli PING` или `docker compose ps redis`).
3. После восстановления Redis убедиться в переключении:
   ```bash
   curl -s http://localhost:3000/api/metrics | rg rate_limit_store_backend
   ```
4. Если Prisma fallback держится > 30 мин, разрешается вручную перезапустить backend (`pm2 restart websocket-server-new` либо `systemctl restart materio-rate-limit` — зависит от окружения).

### 3.2 Проблемы с производительностью

**Симптомы:**
- Высокий `rate_limit_check_duration_seconds`
- Медленные ответы API
- Таймауты при проверке лимитов

**Диагностика:**
```bash
# Проверить время выполнения проверок
curl -s http://localhost:3000/api/metrics | \
  grep rate_limit_check_duration_seconds

# Проверить использование Redis
redis-cli INFO stats | grep total_commands_processed
```

**Решения:**
1. Переключиться на Redis (если используется Prisma)
2. Оптимизировать запросы к БД (добавить индексы)
3. Увеличить пул соединений к БД

### 3.3 Проблемы с блокировками

**Симптомы:**
- Пользователи жалуются на необоснованные блокировки
- Блокировки не снимаются автоматически

**Диагностика:**
```bash
# Проверить активные блокировки
curl -s "http://localhost:3000/api/admin/rate-limits?view=states&module=auth" \
  -H "Authorization: Bearer <token>"

# Проверить события блокировок
curl -s "http://localhost:3000/api/admin/rate-limits?view=events&module=auth&key=user-123" \
  -H "Authorization: Bearer <token>"
```

**Решения:**
1. Проверить конфигурацию модуля (возможно, слишком строгие лимиты)
2. Вручную снять блокировку через API
3. Проверить логи на наличие ошибок

### 3.4 Проблемы с метриками

**Симптомы:**
- Метрики не обновляются
- Отсутствуют данные в Prometheus

**Диагностика:**
```bash
# Проверить доступность endpoint метрик
curl -s http://localhost:3000/api/metrics | head -20

# Проверить регистрацию метрик
curl -s http://localhost:3000/api/metrics | grep -c rate_limit
```

**Решения:**
1. Проверить, что приложение запущено
2. Проверить логи на ошибки инициализации метрик
3. Убедиться, что `metricsRegistry` правильно настроен

### 3.5 Ошибка "Redis is already connecting/connected"

**Симптомы:**
- В логах появляются множественные ошибки:
  ```
  error: [rate-limit] Redis store failed. Falling back to Prisma store for rate limiting.
  {"error":{"message":"Redis is already connecting/connected","name":"Error"}}
  ```
- Происходит необоснованный fallback на Prisma store
- Redis доступен, но система не может к нему подключиться

**Причина:**
При параллельных запросах несколько потоков одновременно пытаются подключиться к Redis, что вызывает конфликт. Redis клиент (ioredis) не позволяет множественные попытки подключения одновременно.

**Решение:**
Проблема исправлена в версии с защитой от параллельных подключений. `RedisRateLimitStore` теперь использует механизм синхронизации:
- Первый запрос инициирует подключение
- Остальные запросы ждут завершения подключения
- После успешного подключения все запросы используют установленное соединение

**Проверка:**
1. Убедиться, что используется последняя версия кода
2. Перезапустить сервер после обновления
3. Проверить логи - ошибка должна исчезнуть:
   ```bash
   tail -f logs/error-$(date +%Y-%m-%d).log | grep "Redis is already"
   ```

**Если проблема сохраняется:**
1. Проверить версию `ioredis` в `package.json`
2. Убедиться, что Redis доступен: `redis-cli PING`
3. Проверить, не создается ли несколько экземпляров `RedisRateLimitStore` одновременно

## 4. Очистка и ретеншн

### 4.1 Журнал RateLimitEvent

Рекомендованный TTL — 30 дней. Раз в сутки запускайте (cron):
```bash
pnpm prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
DELETE FROM "RateLimitEvent"
WHERE "createdAt" < datetime('now', '-30 days');
SQL
```

### 4.2 States и ручные блокировки

1. Снять блокировку в БД:
   ```bash
   pnpm prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
   UPDATE "UserBlock"
   SET "isActive" = FALSE, "unblockedAt" = datetime('now')
   WHERE "module" = 'chat' AND "isActive" = TRUE AND "unblockedAt" < datetime('now');
   SQL
   ```
2. Очистить счётчики через API:
   ```bash
   curl -X DELETE \
     "http://localhost:3000/api/admin/rate-limits?module=chat" \
     -H "Authorization: Bearer <token>"
   ```

## 5. Тестирование

### 5.1 Запуск unit тестов

Для проверки fallback-логики:
```bash
pnpm test:unit -- ResilientRateLimitStore
```
Единичный прогон никого не отключает: используются локальные моки Redis/Prisma.

### 5.2 Интеграционное тестирование

```bash
# Запустить все тесты rate-limit
pnpm test:unit -- rate-limit
pnpm test:integration -- rate-limit-admin
```

## 6. PII защита и хэширование

### 6.1 Текущая реализация

Система использует хэширование для защиты PII (GDPR compliance):
- IP адреса хранятся как `ipHash` и `ipPrefix` (первые 3 октета для IPv4)
- Email хранятся как `emailHash`
- Raw значения не сохраняются в автоматических блокировках

### 6.2 Настройка секретного ключа

```bash
# Установить секретный ключ для хэширования
export RATE_LIMIT_SECRET="your-secret-key-minimum-32-characters-long"

# В production используйте сильный случайный ключ
openssl rand -hex 32
```

**Важно:** Храните секретный ключ в безопасном месте (secrets manager, environment variables).

### 6.3 Ротация ключей хэширования

См. подробный гайд: `docs/rate-limits/hash-key-rotation.md`

## 7. Часто используемые команды

| Операция                              | Команда                                                                 |
|--------------------------------------|-------------------------------------------------------------------------|
| Проверить состояния                   | `curl -s "http://localhost:3000/api/admin/rate-limits?view=states"`     |
| Запустить миграции                    | `pnpm prisma migrate deploy --schema prisma/schema.prisma`              |
| Открыть Prisma Studio                 | `pnpm prisma studio --schema prisma/schema.prisma`                      |
| Tail логов rate-limit                 | `tail -f logs/application-$(date +%Y-%m-%d).log`                        |
| Очистить события старше 30 дней       | см. секцию 3.1                                                          |

## 8. Известные проблемы и исправления

### 8.1 Множественные подключения к Redis (исправлено)

**Дата исправления:** 2025-11-23

**Проблема:** При параллельных запросах возникала ошибка "Redis is already connecting/connected", приводящая к необоснованному fallback на Prisma store.

**Исправление:** Добавлена защита от параллельных подключений в `RedisRateLimitStore.ensureConnected()`. Теперь используется механизм синхронизации с флагом `connecting`, который предотвращает множественные попытки подключения.

**Файл:** `src/lib/rate-limit/stores/redis-store.ts`

**Детали:** См. раздел 3.5 Troubleshooting

---

Храните этот файл под рукой и обновляйте вместе с изменениями в модуле.

