# Запуск dev-серверов

Убей все node-процессы и запусти полный стек разработки.

## Шаги

1. Убей все node-процессы:
   ```bash
   taskkill //f //im node.exe
   ```
   Если процессов нет — это нормально, продолжай.

2. Убедись что Docker запущен:
   ```bash
   docker info --format '{{.ServerVersion}}'
   ```
   Если Docker не запущен — сообщи пользователю и останови выполнение.

3. Убедись что используется Node.js 22 (не 24):
   ```bash
   node --version
   ```
   Если версия 24.x — переключи: `nvm use 22.22.1`

4. Запусти `pnpm dev:full` в фоне:
   ```bash
   pnpm dev:full
   ```
   Это запустит Docker-сервисы (Redis, PostgreSQL, MinIO, Grafana, Prometheus, Loki, Bull Board), Socket.IO (порт 3001) и Next.js (порт 3000).

5. Подожди 30 секунд и проверь вывод. Убедись что:
   - Next.js запустился на `http://localhost:3000`
   - Socket.IO на порту 3001
   - Нет ошибок `EADDRINUSE`

6. Выведи итоговый статус:
   - Next.js: URL и порт
   - Socket.IO: порт
   - Docker: список запущенных контейнеров
