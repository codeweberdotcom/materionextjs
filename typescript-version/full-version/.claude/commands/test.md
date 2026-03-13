# Запуск тестов

Запусти тесты проекта. Аргумент определяет тип тестов.

## Использование

- `/test` или `/test all` — все тесты (unit + integration)
- `/test unit` — только unit-тесты
- `/test integration` — только integration-тесты
- `/test e2e` — E2E тесты (Playwright, требует запущенного сервера)
- `/test coverage` — тесты с отчётом о покрытии
- `/test watch` — watch-режим
- `/test <path>` — конкретный файл, например `/test tests/unit/export/`

## Аргумент: $ARGUMENTS

## Шаги

1. Определи тип тестов из аргумента. По умолчанию — `all`.

2. Убедись что используется Node.js 22:
   ```bash
   node --version
   ```

3. Запусти нужную команду из `c:/laragon/www/materionextjs_1/typescript-version/full-version`:

   | Тип | Команда |
   |-----|---------|
   | `all` | `pnpm test` |
   | `unit` | `pnpm test:unit` |
   | `integration` | `pnpm test:integration` |
   | `e2e` | `pnpm test:e2e` |
   | `coverage` | `pnpm test:coverage` |
   | `watch` | `pnpm test:watch` |
   | `<path>` | `pnpm vitest run <path>` |

4. Для E2E тестов предварительно проверь что сервер запущен на `http://localhost:3000`:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
   ```
   Если сервер не запущен — предложи выполнить `/dev` сначала.

5. После завершения выведи:
   - Количество тестов: пройдено / провалено / пропущено
   - Время выполнения
   - Если есть провалы — покажи детали ошибок и предложи исправления
