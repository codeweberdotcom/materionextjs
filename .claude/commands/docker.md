# Управление Docker-сервисами

Управляй Docker-контейнерами проекта.

## Использование

- `/docker` или `/docker status` — статус всех контейнеров
- `/docker up` — запустить все сервисы (`pnpm docker:up && pnpm pg:up`)
- `/docker down` — остановить все сервисы (`pnpm docker:down && pnpm pg:down`)
- `/docker logs` — логи всех сервисов (`pnpm docker:logs`)
- `/docker logs <name>` — логи конкретного сервиса
- `/docker restart` — перезапустить все сервисы (down + up)
- `/docker restart <name>` — перезапустить конкретный сервис

## Аргумент: $ARGUMENTS

## Сервисы проекта

| Контейнер | Порт | Назначение |
|-----------|------|-----------|
| materio-redis | 6379 | Кэш, rate limiting, очереди |
| materio-postgresql | 5432 | Основная БД |
| materio-s3 (MinIO) | 9000/9001 | S3-совместимое хранилище |
| materio-prometheus | 9090 | Метрики |
| materio-grafana | 9091 | Дашборды мониторинга |
| materio-loki | 3100 | Хранилище логов |
| materio-promtail | — | Отправка логов в Loki |
| materio-bull-board | 3030 | Мониторинг очередей |

## Шаги

1. Определи команду из аргумента. По умолчанию — `status`.

2. Все команды запускать из `c:/laragon/www/materionextjs_1/typescript-version/full-version`.

3. Для `status`:
   ```bash
   docker ps --filter "name=materio" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
   ```

4. Для `up`:
   ```bash
   pnpm docker:up && pnpm pg:up
   ```

5. Для `down`:
   ```bash
   pnpm docker:down && pnpm pg:down
   ```

6. Для `logs <name>`:
   ```bash
   docker logs --tail 50 materio-<name>
   ```

7. Для `restart`:
   ```bash
   pnpm docker:down && pnpm pg:down && pnpm docker:up && pnpm pg:up
   ```

8. Для `restart <name>`:
   ```bash
   docker restart materio-<name>
   ```

9. Выведи результат в виде таблицы со статусами контейнеров и URL-ами для веб-интерфейсов:
   - Grafana: http://localhost:9091 (admin/admin)
   - Prometheus: http://localhost:9090
   - MinIO: http://localhost:9001
   - Bull Board: http://localhost:3030
   - Prisma Studio: http://localhost:5555 (если запущен)
