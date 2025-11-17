# Codex: типизация ТЗ (rate-limit + monitoring)

## RateLimit
- **Статус**: fail-fast + resilient store реализованы.
- **Метрики**: `prom-client` публикует `rate_limit_store_backend`, `rate_limit_fallback_switch_total`, `rate_limit_consume_duration_seconds`, `rate_limit_unknown_module_total` и др.
- **Текущие TODO**: PII/ipHash, unit/integration тесты (Prisma/Redis/Service/API), модуль Events, PII retention, переработка seed.

## Мониторинг
- **Prometheus/Grafana**: конфиг хранится в `monitoring/`; `/api/metrics` отдаёт метрики; Grafana provisioning включает rate-limit дашборд.
- **Логи**: Winston пишет в `logs/`, promtail → Loki (опционально).
- **Операционный гайд**: `docs/monitoring/rate-limit-operations.md` описывает действия при fallback, cron для очистки, ключевые метрики.

