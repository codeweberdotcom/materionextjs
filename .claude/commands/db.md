# Управление базой данных (Prisma)

Выполни операцию с базой данных через Prisma.

## Использование

- `/db` — показать статус и доступные команды
- `/db migrate` — запустить миграции (`pnpm migrate`)
- `/db seed` — заполнить БД тестовыми данными (`npx prisma db seed`)
- `/db push` — применить схему напрямую (`npx prisma db push`)
- `/db studio` — открыть Prisma Studio (`pnpm pg:studio`)
- `/db generate` — сгенерировать Prisma Client (`npx prisma generate`)
- `/db reset` — сбросить БД (спросить подтверждение!)
- `/db setup` — полная настройка: PG up + push + generate + seed (`pnpm pg:setup`)
- `/db status` — статус PostgreSQL контейнера и подключения

## Аргумент: $ARGUMENTS

## Шаги

1. Определи команду из аргумента. Если аргумент пустой — покажи список доступных команд.

2. Все команды запускать из `c:/laragon/www/materionextjs_1/typescript-version/full-version`.

3. Загрузи переменные окружения из `.env` при выполнении Prisma-команд:
   ```bash
   dotenv -e .env -- npx prisma <command>
   ```

4. Для `reset` — ОБЯЗАТЕЛЬНО спроси подтверждение у пользователя перед выполнением. Это уничтожит все данные.

5. Для `studio` — запусти в фоне и сообщи URL (обычно `http://localhost:5555`).

6. Для `setup` — проверь что Docker запущен, затем выполни `pnpm pg:setup`.

7. Для `status`:
   ```bash
   docker ps --filter "name=materio-postgresql" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
   ```
   И проверь подключение:
   ```bash
   docker exec materio-postgresql pg_isready -U postgres
   ```

8. Выведи результат операции. При ошибках — покажи детали и предложи решение.
