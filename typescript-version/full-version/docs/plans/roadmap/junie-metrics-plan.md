# Junie Metrics Plan — Winston + Prometheus для RateLimit

Дата: 2025-11-14

## Зачем оба (Winston и Prometheus)
- Winston: детальные логи (контекст инцидентов, стек, payload), разбор после факта.
- Prometheus: числовая телеметрия (счётчики/таймеры), дашборды и алерты в реальном времени.
- Вместе: алерт в Grafana → переход в логи Winston для деталей.

## Что добавить (метрики)
1) Состояние backend'а и переключения:
- `rate_limit_store_backend{backend="redis|prisma"}` — gauge (1 у активного)
- `rate_limit_fallback_switch_total{from,to}` — counter (переключения между сторами)
- `rate_limit_redis_failures_total` — counter (ошибки Redis)
- `rate_limit_fallback_duration_seconds` — histogram/summary (длительность работы в fallback)

2) Производительность consume():
- `rate_limit_consume_duration_seconds{backend,module,mode}` — histogram (buckets: 5ms…2s)

3) События и дедуп:
- `rate_limit_block_events_total{mode,store}` — counter
- `rate_limit_block_events_suppressed_total{store}` — counter

4) Fail‑fast алерт конфигурации:
- `rate_limit_unknown_module_total{module}` — counter

## Интеграция (эскиз)
- Библиотека: `prom-client`.
- Реестр: `src/lib/metrics/registry.ts` с `collectDefaultMetrics`.
- Роут экспорта: `src/app/api/metrics/route.ts` — отдаёт текст в формате Prometheus.
- Модуль метрик RL: `src/lib/metrics/rate-limit.ts` — определение счётчиков/gauge/histogram.
- Включение в коде:
  - `ResilientRateLimitStore`: обновлять gauge, инкрементировать `fallback_switch_total`, `redis_failures_total`, оборачивать `consume()` таймером.
  - `redis-store.ts`/`prisma-store.ts`: инкрементировать `block_events_total` и `block_events_suppressed_total` (monitor‑дедуп).
  - `RateLimitService.checkLimit()`: при unknown‑module — `rate_limit_unknown_module_total.inc({ module })`.

## Алерты (Prometheus rules, пример)
```yaml
- alert: RateLimitUnknownModule
  expr: increase(rate_limit_unknown_module_total[5m]) > 0
  for: 0m
  labels: { severity: warning }
  annotations:
    summary: "Unknown rate limit module observed"
    description: "Some code path is calling rate limiter with an unknown module."

- alert: RateLimitFallbackTooLong
  expr: rate_limit_store_backend{backend="prisma"} == 1
  for: 5m
  labels: { severity: warning }
  annotations:
    summary: "Rate limit fallback active >5m"
    description: "Service is using Prisma fallback instead of Redis for more than 5 minutes."
```

## Рекомендации по лейблам
- Использовать только низкокардинальные: `backend`, `mode`, `module`, `store`, `from`, `to`.
- Не включать `key`, `userId`, `email`, `ip`, `ipHash`.

## Быстрые проверки
- Остановить Redis → должны увеличиться `rate_limit_redis_failures_total`, `fallback_switch_total{from="redis",to="prisma"}`, gauge переключится на prisma.
- Вызвать RL с неизвестным модулем → растёт `rate_limit_unknown_module_total` и срабатывает алерт.
- Превысить лимит в monitor → за окно ровно один `block_events_total{mode="monitor"}`, остальное уходит в `block_events_suppressed_total`.

## Дорожная карта внедрения
1) Подключить `prom-client`, реестр и `/api/metrics`.
2) Добавить модуль метрик RL и интеграцию в resilient‑слой/сторы/сервис.
3) Настроить scrape в Prometheus и алерты, собрать дашборд в Grafana.
4) Вынести ключевые события в Winston (switch‑over, ошибки Redis, unknown‑module) с корреляцией (requestId/correlationId).

## Примечания
- В dev/stage можно включить больше buckets/лейблов; в prod — держать лейблы минимальными.
- При необходимости добавить sampling в Winston, чтобы не зашумлять логи при высоком трафике.








