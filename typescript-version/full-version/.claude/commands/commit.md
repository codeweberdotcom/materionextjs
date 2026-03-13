# Git Commit

Создай коммит с осмысленным сообщением на основе изменений.

## Использование

- `/commit` — автоматический коммит всех изменений
- `/commit <message>` — коммит с указанным сообщением
- `/commit --amend` — дополнить последний коммит (только если явно указано)

## Аргумент: $ARGUMENTS

## Шаги

1. **Проанализируй изменения** — запусти параллельно:
   ```bash
   git status
   git diff
   git diff --cached
   git log --oneline -5
   ```

2. **Проверь безопасность** — НЕ коммить файлы с секретами:
   - `.env`, `.env.local`, `.env.production`
   - `credentials.json`, `*-credentials.*`
   - `settings.local.json`
   - Файлы с токенами, паролями, ключами API
   - Если обнаружены — предупреди пользователя и исключи из коммита

3. **Определи сообщение коммита:**
   - Если пользователь указал `<message>` — используй его
   - Если нет — сгенерируй на основе изменений

4. **Формат сообщения** — Conventional Commits:
   ```
   <type>(<scope>): <описание>

   [тело — опционально, если изменений много]

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   ```

   **Типы:**
   | Тип | Когда использовать |
   |-----|-------------------|
   | `feat` | Новая функциональность |
   | `fix` | Исправление бага |
   | `refactor` | Рефакторинг без изменения поведения |
   | `docs` | Только документация |
   | `test` | Добавление/изменение тестов |
   | `chore` | Конфигурация, зависимости, скрипты |
   | `style` | Форматирование, линтинг |
   | `perf` | Улучшение производительности |

   **Scope** (опционально): модуль или область (`chat`, `media`, `auth`, `api`, `ui`, `db`, `socket`, `i18n`, `permissions`)

   **Правила:**
   - Описание на английском, до 72 символов
   - Начинать с глагола в imperative mood: `add`, `fix`, `update`, `remove`, `refactor`
   - НЕ начинать с заглавной буквы после `:`
   - Тело — для объяснения "почему", а не "что"

5. **Добавь файлы и создай коммит:**
   ```bash
   git add <конкретные файлы>
   git commit -m "$(cat <<'EOF'
   <message>

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

   **Важно:**
   - Добавляй конкретные файлы по имени (`git add src/...`), а не `git add .` или `git add -A`
   - Используй HEREDOC для сообщения коммита
   - Всегда добавляй `Co-Authored-By`
   - Создавай НОВЫЙ коммит, не `--amend` (если не указано явно)

6. **Проверь результат:**
   ```bash
   git status
   git log --oneline -3
   ```

7. **Выведи результат:** хеш коммита, краткое описание изменений, количество файлов.

## Примеры

```
feat(chat): add message delivery receipts
fix(auth): resolve session expiration on refresh
refactor(media): extract upload logic into service
docs(api): update rate-limit endpoint documentation
chore: update dependencies and fix build config
test(permissions): add unit tests for role hierarchy
perf(db): optimize user list query with cursor pagination
```

## Запреты

- НИКОГДА не делай `git push` без явной просьбы
- НИКОГДА не делай `--amend` без явной просьбы
- НИКОГДА не используй `--no-verify` или `--no-gpg-sign`
- НИКОГДА не используй `git add .` или `git add -A`
- НИКОГДА не коммить файлы с секретами
- НЕ делай пустой коммит если нет изменений
