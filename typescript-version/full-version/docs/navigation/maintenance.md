# Maintenance / Cron
- Страница: `/admin/maintenance` — ручной запуск retention для RateLimitEvent, отображает последние время/результат.
- API: `GET/POST /api/admin/maintenance/retention` (только admin/superadmin).
- Параметры: `RATE_LIMIT_EVENT_RETENTION_DAYS` (default 90).
- Состояние хранится в `CronJobStatus` (name=`retention_cleanup`): lastRun/lastSuccess/result/count.
- Cron/CI: вызывайте `pnpm retention:cleanup` (еженедельно) или запускайте вручную через UI.
