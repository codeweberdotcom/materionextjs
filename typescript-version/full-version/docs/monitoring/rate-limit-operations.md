# Rate Limit — операционный гайд

Документ описывает, что делать администратору при сопровождении модуля RateLimit: какие метрики смотреть, как реагировать на fallback, чем очищать журнал событий и как вручную сбрасывать состояния.

## 1. Мониторинг и метрики

1. **Прометеус**
   ```bash
   curl -s http://localhost:9090/api/v1/query \
     --data-urlencode 'query=rate_limit_store_backend'
   ```
2. **Ключевые серии**
   - `rate_limit_store_backend{backend="redis|prisma"}` — активный стор (1 у текущего).
   - `rate_limit_fallback_switch_total{from,to}` — количество переключений Redis↔Prisma.
   - `rate_limit_fallback_duration_seconds` — сколько времени система провела в fallback.
   - `rate_limit_unknown_module_total{module}` — вызовы `checkLimit` без конфига.
3. **Alerting**
   - Если `rate_limit_store_backend{backend="prisma"} == 1` дольше 5 минут — алерт «fallback active».
   - Если `increase(rate_limit_unknown_module_total[5m]) > 0` — алерт «misconfig».

## 2. Что делать при fallback

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

## 3. Очистка и ретеншн

### 3.1 Журнал RateLimitEvent

Рекомендованный TTL — 30 дней. Раз в сутки запускайте (cron):
```bash
pnpm prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
DELETE FROM "RateLimitEvent"
WHERE "createdAt" < datetime('now', '-30 days');
SQL
```

### 3.2 States и ручные блокировки

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

## 4. Вручную запустить тесты RateLimit

Для проверки fallback-логики:
```bash
pnpm test:unit -- ResilientRateLimitStore
```
Единичный прогон никого не отключает: используются локальные моки Redis/Prisma.

## 5. Планы по PII

Пока IP/email хранятся целиком. Перед вводом в эксплуатацию зашифрованной версии:
1. Настроить `RATE_LIMIT_IP_HASH_SECRET` и `RATE_LIMIT_IP_HASH_VERSION`.
2. Мигрировать таблицы `RateLimitEvent` и `UserBlock`, добавив `ipHash` и `ipPrefix`.
3. Обновить этот гайд и `docs/api/rate-limits.md`.

## 6. Часто используемые команды

| Операция                              | Команда                                                                 |
|--------------------------------------|-------------------------------------------------------------------------|
| Проверить состояния                   | `curl -s "http://localhost:3000/api/admin/rate-limits?view=states"`     |
| Запустить миграции                    | `pnpm prisma migrate deploy --schema prisma/schema.prisma`              |
| Открыть Prisma Studio                 | `pnpm prisma studio --schema prisma/schema.prisma`                      |
| Tail логов rate-limit                 | `tail -f logs/application-$(date +%Y-%m-%d).log`                        |
| Очистить события старше 30 дней       | см. секцию 3.1                                                          |

Храните этот файл под рукой и обновляйте вместе с изменениями в модуле.

