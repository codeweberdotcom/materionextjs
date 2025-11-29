# Файлы в корне docs/ - Краткое описание

**Формат:** файл - назначение

---

## 📚 Основные файлы

| Файл | Назначение |
|------|------------|
| `README.md` | Главный индекс документации, навигация по всем разделам |
| `QUICK_START.md` | Краткий справочник для людей: где что хранить, как найти информацию |
| `DOCUMENTATION_STANDARDS.md` | Правила и стандарты: структура, шаблоны, именование файлов |
| `STATUS_INDEX.md` | Индекс статусов: что в планах, в работе, сделано, требует улучшений |
| `AI_WORKFLOW_GUIDE.md` | Инструкция для AI: процесс работы (АНАЛИЗ → ПЛАН → РЕАЛИЗАЦИЯ → ОТЧЕТ → ДОКУМЕНТАЦИЯ) |
| `AI_MODULE_STANDARDS.md` | Чек-лист для AI: требования к созданию/доработке модулей |
| `UI_UX_PATTERNS.md` | Образцы UI/UX элементов: компоненты, паттерны дизайна, цветовая палитра |

---

## 🔐 Модуль "Роли пользователей" (обновлено 2025-11-25, рефакторинг завершён)

### Модель данных Role

```prisma
model Role {
  id          String   @id @default(cuid())
  code        String   @unique  // Неизменяемый код: 'SUPERADMIN', 'ADMIN'
  name        String   @unique  // Отображаемое имя (можно переименовывать)
  description String?
  permissions String?  @default("{}")
  level       Int      @default(100)  // Уровень иерархии (0 = высший)
  isSystem    Boolean  @default(false) // Системная роль (нельзя удалить)
}
```

### Структура файлов

| Путь | Назначение |
|------|------------|
| `src/app/api/admin/roles/route.ts` | API: GET (список), POST (создание) |
| `src/app/api/admin/roles/[id]/route.ts` | API: GET (одна роль), PUT (обновление), DELETE (удаление) |
| `src/app/api/admin/roles/utils/error-helper.ts` | Стандартизированные ошибки API |
| `src/lib/role-cache/` | Кэширование ролей (Redis + fallback) |
| `src/lib/role-cache/types.ts` | Интерфейс RoleCacheStore (включает `code`, `level`, `isSystem`) |
| `src/lib/role-cache/in-memory-store.ts` | In-memory реализация кэша |
| `src/lib/role-cache/redis-store.ts` | Redis реализация кэша |
| `src/lib/role-cache/index.ts` | ResilientRoleCacheStore с fallback |
| `src/lib/metrics/roles.ts` | Prometheus метрики для ролей |
| `src/utils/permissions/validation.ts` | Zod-валидация структуры разрешений |
| `src/utils/permissions/permissions.ts` | Функции проверки ролей: `isSuperadmin()`, `isAdminByCode()`, `hasRoleCode()` |
| `src/shared/config/protected-roles.ts` | `isSystemRole()` - проверка по `isSystem` полю |
| `src/utils/formatting/string.ts` | `ROLE_CODES`, `canModifyRoleByObject()` - иерархия по `level` |

### Тесты

| Файл | Покрытие |
|------|----------|
| `tests/unit/role-cache/in-memory-store.test.ts` | TTL, healthCheck, get/set |
| `tests/unit/role-cache/resilient-store.test.ts` | Fallback, переключение на primary |
| `tests/unit/permissions/permissions-parsing.test.ts` | Парсинг JSON, legacy форматы |
| `tests/unit/permissions/permissions-validation.test.ts` | Zod-валидация разрешений |
| `tests/unit/api/roles-route.test.ts` | Hierarchy violation, cache clear, protected roles |

### События (EventService)

| Тип | Триггер | Severity |
|-----|---------|----------|
| `role.created` | POST /api/admin/roles | info |
| `role.updated` | PUT /api/admin/roles/[id] | info |
| `role.deleted` | DELETE /api/admin/roles/[id] | warning |

### Метрики (Prometheus)

| Метрика | Тип | Описание |
|---------|-----|----------|
| `role_operations_total` | Counter | Счётчик операций (create/read/update/delete) |
| `role_operation_duration_seconds` | Histogram | Время выполнения операций |
| `role_events_total` | Counter | Счётчик событий ролей |
| `role_cache_errors_total` | Counter | Ошибки кэша |
| `role_cache_switches_total` | Counter | Переключения Redis ↔ in-memory |

### Иерархия ролей (по полю `level`)

| code | level | isSystem | Описание |
|------|-------|----------|----------|
| SUPERADMIN | 0 | true | Высший приоритет |
| ADMIN | 10 | true | Администратор |
| MANAGER | 20 | true | Менеджер |
| EDITOR | 30 | true | Редактор |
| MODERATOR | 40 | true | Модератор |
| SEO | 50 | true | SEO-специалист |
| MARKETOLOG | 60 | true | Маркетолог |
| SUPPORT | 70 | true | Поддержка |
| SUBSCRIBER | 80 | true | Подписчик |
| USER | 90 | true | Пользователь |
| (custom) | 100+ | false | Кастомные роли |

**Правила:**
- Роль может изменять только роли с большим значением `level`
- `SUPERADMIN` (`level: 0`) может изменять все роли
- Системные роли (`isSystem: true`) нельзя удалить
- **Переименование разрешено** - `name` можно менять, `code` неизменяем

### Функции проверки ролей

Все проверки ролей используют поле `code` (не `name`):

| Функция | Описание | Пример |
|---------|----------|--------|
| `isSuperadmin(user)` | Проверка SUPERADMIN (по permissions или code) | `isSuperadmin(currentUser)` |
| `isAdminByCode(user)` | Проверка ADMIN по коду | `isAdminByCode(currentUser)` |
| `hasRoleCode(user, code)` | Проверка любой роли по коду | `hasRoleCode(user, 'MANAGER')` |
| `isAdminOrHigher(user)` | Проверка ADMIN или SUPERADMIN | `isAdminOrHigher(user)` |

**Важно:**
- ❌ **Удалено:** `isAdmin()` - использовала проверку по `name`
- ✅ **Используется:** `isAdminByCode()` - проверка по `code === 'ADMIN'`
- ✅ **Остаётся:** `isSuperadmin()` - проверяет permissions и code
- Все прямые проверки `role?.name === 'admin'` заменены на `role?.code === 'ADMIN'`

### Seed данные

В `prisma/seed.ts` создаются все 10 системных ролей с правильными `code`, `level`, `isSystem`:

| Роль | code | level | isSystem | Пользователи |
|------|------|-------|----------|--------------|
| SUPERADMIN | `SUPERADMIN` | 0 | true | `superadmin@example.com` (пароль: `admin123`) |
| ADMIN | `ADMIN` | 10 | true | `admin@example.com` (пароль: `admin123`) |
| MANAGER | `MANAGER` | 20 | true | `manager.demo@example.com` |
| EDITOR | `EDITOR` | 30 | true | `editor.demo@example.com` |
| MODERATOR | `MODERATOR` | 40 | true | `moderator.demo@example.com` |
| SEO | `SEO` | 50 | true | `seo@example.com` |
| MARKETOLOG | `MARKETOLOG` | 60 | true | `marketing@example.com` |
| SUPPORT | `SUPPORT` | 70 | true | `support.demo@example.com` |
| SUBSCRIBER | `SUBSCRIBER` | 80 | true | `subscriber@example.com` |
| USER | `USER` | 90 | true | `user@example.com` |

**Запуск seed:**
```bash
npx prisma db seed
```

**Примечание:** Seed-файл использует `upsert`, поэтому при повторном запуске существующие роли обновляются с правильными `level` и `isSystem` значениями.

---

## 📦 Модуль "S3 (MinIO)" (добавлено 2025-11-26)

### Назначение

Локальное S3-совместимое хранилище для разработки и тестирования модуля Media.

### Структура файлов

| Путь | Назначение |
|------|------------|
| `s3/docker-compose.yml` | Docker: MinIO контейнер |
| `s3/README.md` | Документация по использованию |

### npm скрипты

| Скрипт | Описание |
|--------|----------|
| `pnpm s3:up` | Запуск MinIO |
| `pnpm s3:down` | Остановка |
| `pnpm s3:logs` | Логи контейнера |
| `pnpm dev:with-socket:monitoring:with-redis:with-bull:with-s3` | Полный стек с S3 |

### URL сервисов

| URL | Сервис |
|-----|--------|
| http://localhost:9000 | S3 API endpoint |
| http://localhost:9001 | MinIO Web Console |

### Учётные данные

| Параметр | Значение |
|----------|----------|
| Root User | `minioadmin` |
| Root Password | `minioadmin123` |

### ENV переменные

```env
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=materio-bucket
S3_REGION=us-east-1
```

### Интеграция с проектом

| Компонент | Путь | Описание |
|-----------|------|----------|
| **S3Connector** | `src/modules/settings/services/connectors/S3Connector.ts` | Тестирование подключения |
| **S3Adapter** | `src/services/media/storage/S3Adapter.ts` | Адаптер для MediaService |
| **ServiceConfiguration** | Seed в `prisma/seed.ts` | 3 конфигурации: MinIO, AWS, Yandex |

### Связанные документы

- [Анализ](analysis/architecture/analysis-s3-minio-docker-setup-2025-11-26.md)
- [План реализации](plans/completed/plan-s3-minio-docker-setup-2025-11-26.md)
- [Отчёт](reports/deployment/report-s3-minio-docker-setup-2025-11-26.md)

---

## 🐂 Модуль "Bull Queue" (обновлено 2025-11-25)

### Структура файлов

| Путь | Назначение |
|------|------------|
| `queues/docker-compose.yml` | Docker: Redis (опц.) + Bull Board UI + Redis Commander |
| `queues/README.md` | Документация по использованию |
| `queues/worker/index.ts` | Воркер для обработки очередей |
| `queues/worker/processors/notifications.ts` | Обработчик уведомлений |
| `src/services/notifications/NotificationQueue.ts` | Bull очередь уведомлений (singleton) |
| `src/lib/metrics/notifications.ts` | Prometheus метрики для очередей |

### Prometheus метрики

| Метрика | Тип | Описание |
|---------|-----|----------|
| `notification_jobs_added_total` | Counter | Добавленные задачи |
| `notification_jobs_processed_total` | Counter | Обработанные задачи |
| `notification_queue_errors_total` | Counter | Ошибки очереди |
| `notification_job_duration_seconds` | Histogram | Время обработки |
| `notification_queue_size` | Gauge | Размер очереди |
| `notification_queue_switches_total` | Counter | Переключения Bull ↔ in-memory |
| `notifications_sent_total` | Counter | Отправленные уведомления |
| `notification_retries_total` | Counter | Retry попытки |

### Sentry интеграция

- ✅ Ошибки задач отправляются в Sentry
- ✅ Теги: `component`, `queue_type`, `channel`
- ✅ Extra: `jobId`, `attempts`, `jobData`

### npm скрипты

| Скрипт | Описание |
|--------|----------|
| `pnpm queue:up` | Запуск Bull Board UI |
| `pnpm queue:down` | Остановка |
| `pnpm queue:logs` | Логи контейнеров |
| `pnpm queue:worker` | Запуск воркера |
| `pnpm dev:with-socket:monitoring:with-redis:with-bull` | Полный стек |

### URL сервисов

| URL | Сервис |
|-----|--------|
| http://localhost:3030 | Bull Board (мониторинг очередей) |
| http://localhost:8081 | Redis Commander (--profile tools) |
| http://localhost:9091 | Grafana (дашборды мониторинга) |

### Grafana Dashboard

**Файл:** `monitoring/grafana/dashboards/notifications-dashboard.json`

**Панели:**

| Row | Панели | Описание |
|-----|--------|----------|
| Overview Stats | Queue Size, Jobs Added, Jobs Processed, Failures, Retries | Статистика за 5 минут |
| Queue Activity | Queue Size Over Time, Queue Switches | Активность очереди |
| By Channel | Sent by Channel, Failed by Channel | Уведомления по каналам (email/sms/browser/telegram) |
| Performance | Send Duration (p50/p95/p99), Throughput | Производительность |
| Retries & Errors | Retries by Attempt, Error Types | Повторы и ошибки |
| Scenarios | Scenario Executions | Выполнение сценариев |

**Доступ:** http://localhost:9091 → Dashboards → "Materio Notifications & Queue Overview"

**Связанные документы:**

- [Анализ](analysis/monitoring/analysis-bull-grafana-dashboard-2025-11-26.md)
- [План реализации](plans/completed/plan-bull-grafana-dashboard-2025-11-26.md)
- [Отчёт](reports/monitoring/report-bull-grafana-dashboard-2025-11-26.md)

---

## 🌐 Модуль "Переводы" (обновлено 2025-01-24)

### Модель данных Translation

```prisma
model Translation {
  id        String   @id @default(cuid())
  key       String   // Ключ перевода: 'navigation.dashboard'
  language  String   // Код языка: 'en', 'ru', 'fr', 'ar'
  value     String   // Текст перевода
  namespace String   @default("common") // Пространство имён
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([key, language, namespace])
}
```

### Структура файлов

| Путь | Назначение |
|------|------------|
| `src/app/api/admin/references/translations/route.ts` | API: GET (список), POST (создание) |
| `src/app/api/admin/references/translations/[id]/route.ts` | API: PUT (обновление), DELETE (удаление), PATCH (toggle) |
| `src/app/api/admin/references/translations/import/route.ts` | API: POST (импорт из JSON) |
| `src/app/api/admin/references/translations/export/route.ts` | API: POST (экспорт в JSON) |
| `src/app/api/admin/references/translations/utils/error-helper.ts` | Стандартизированные ошибки API |
| `src/lib/metrics/translations.ts` | Prometheus метрики для переводов |
| `src/lib/validations/translation-schemas.ts` | Zod-валидация структуры переводов |
| `src/utils/translations/export-helper.ts` | Функции импорта/экспорта JSON |
| `src/views/apps/references/translations/` | UI компоненты |
| `src/contexts/TranslationContext.tsx` | React Context: `useTranslation()`, `useTranslationSafe()` |
| `src/data/dictionaries/` | JSON файлы переводов по языкам |

### Хуки TranslationContext

| Хук | Описание | Без провайдера |
|-----|----------|----------------|
| `useTranslation()` | Основной хук для компонентов внутри TranslationProvider | ❌ Throws error |
| `useTranslationSafe()` | Безопасный хук для shared компонентов | ✅ Возвращает `null` |

**Использование `useTranslationSafe`:** Для компонентов, которые рендерятся как внутри dashboard (с провайдером), так и на front-pages (без провайдера). Пример: `ModeDropdown`, `LanguageSwitcher`.

### События (EventService)

| Тип | Триггер | Severity |
|-----|---------|----------|
| `translation.created` | POST /api/admin/references/translations | info |
| `translation.updated` | PUT /api/admin/references/translations/[id] | info |
| `translation.deleted` | DELETE /api/admin/references/translations/[id] | warning |
| `translation.toggled` | PATCH /api/admin/references/translations/[id] | info |
| `translation.imported` | POST /api/admin/references/translations/import | info |
| `translation.exported` | POST /api/admin/references/translations/export | info |

### Метрики (Prometheus)

| Метрика | Тип | Описание |
|---------|-----|----------|
| `translation_operations_total` | Counter | Счётчик операций (create/read/update/delete/toggle) |
| `translation_operation_duration_seconds` | Histogram | Время выполнения операций |
| `translation_events_total` | Counter | Счётчик событий переводов |
| `translation_import_total` | Counter | Счётчик импортов |
| `translation_export_total` | Counter | Счётчик экспортов |

### Доступ

| code | level | Доступ |
|------|-------|--------|
| SUPERADMIN | 0 | Полный доступ |
| ADMIN | 10 | Полный доступ |
| (остальные) | 20+ | Нет доступа |

### Множественные формы (Pluralization)

Для языков с комплексными правилами склонения (русский, арабский, польский и др.) поддерживаются множественные формы:

```json
// Значение в поле value для русского языка:
{
  "one": "{{count}} пользователь",
  "few": "{{count}} пользователя", 
  "many": "{{count}} пользователей"
}
```

**Правила для русского языка:**

| Форма | Числа | Пример |
|-------|-------|--------|
| one | 1, 21, 31, 41... | 1 пользователь |
| few | 2-4, 22-24, 32-34... | 3 пользователя |
| many | 0, 5-20, 25-30... | 5 пользователей |

**Использование в коде:**

```typescript
import { useTranslate } from '@/hooks/useTranslate'

const { t } = useTranslate()

t('users.count', { count: 1 }) // → "1 пользователь"
t('users.count', { count: 3 }) // → "3 пользователя"
t('users.count', { count: 5 }) // → "5 пользователей"
```

### Структура файлов (pluralization)

| Путь | Назначение |
|------|------------|
| `src/utils/translations/pluralization.ts` | Правила plural для языков |
| `src/hooks/useTranslate.ts` | Хук `t()` с поддержкой plural |

**Правила:**
- Доступ проверяется по `role.code` (не по `name`)
- Только SUPERADMIN и ADMIN могут управлять переводами
- При создании/обновлении автоматически экспортируется в JSON
- Значение может быть строкой или JSON с plural формами

### Выполненные задачи

**✅ План реализован:** [План: Множественные формы (Pluralization) для модуля переводов](plans/completed/plan-translations-module-pluralization-2025-01-24.md) (завершён 2025-01-24)

**Основные достижения:**
- ✅ Полная поддержка plural forms для русского языка (one, few, many)
- ✅ Хук `useTranslate()` с автоматическим определением формы
- ✅ Поддержка форматов переменных: `{{var}}` и `${var}`
- ✅ UI для создания и редактирования plural forms
- ✅ Корректный импорт/экспорт plural forms (объекты ↔ JSON-строки)
- ✅ Добавлены plural forms для всех числовых ключей в `ru.json`
- ✅ Исправлены ошибки использования в компонентах (RoleCards и др.)

**Файлы с plural forms в `ru.json`:**
- `daysAgo`, `hoursAgo`, `minutesAgo`
- `totalUsers`, `totalUsersCount`
- `confirmBulkActivate`, `confirmBulkDeactivate`, `confirmBulkDelete`
- `bulkOperationSuccess`, `bulkOperationPartialSuccess`
- `errorsCount`, `warningsCount`, `duplicatesFound`
- `recordsExported`, `recordsImported`, `recordsFailed`, `recordsProcessed`
- `rowsWillBeSkipped`, `translationsImportSuccess`
- `waitMessage`, `rateLimitMessage`, `rateLimitWarning`
- `viewingLabel`, `tableSubtitle`

---

## ⚙️ Модуль "Конфигурация внешних сервисов" (обновлено 2025-11-25)

### Назначение

Централизованное управление подключениями к внешним сервисам (Redis, PostgreSQL, Prometheus, Loki, Grafana, Sentry, S3, SMTP, Elasticsearch) через админ-панель с гибридным режимом работы:
- **Development**: Docker-контейнеры (localhost)
- **Staging**: Переменные окружения (.env)
- **Production**: Конфигурация через админ-панель (БД)

### Модель данных ServiceConfiguration

```prisma
model ServiceConfiguration {
  id          String   @id @default(cuid())
  name        String   @unique // 'redis', 'postgresql', 'prometheus'
  displayName String   // 'Redis Server', 'PostgreSQL Main'
  type        String   // REDIS, POSTGRESQL, PROMETHEUS, LOKI, GRAFANA, SENTRY, SMTP, S3, ELASTICSEARCH
  host        String
  port        Int?
  protocol    String?  // redis://, https://, http://
  basePath    String?  // /api/v1
  username    String?
  password    String?  // Зашифровано AES-256-GCM
  token       String?  // Зашифровано
  tlsEnabled  Boolean  @default(false)
  tlsCert     String?  // Зашифровано
  enabled     Boolean  @default(true)
  status      String   @default("UNKNOWN") // CONNECTED, DISCONNECTED, ERROR, UNKNOWN
  lastCheck   DateTime?
  lastError   String?
  metadata    String?  @default("{}") // JSON: { region, bucket, database, storageType }
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Структура файлов

| Путь | Назначение |
|------|------------|
| **Ядро модуля** |
| `src/lib/config/index.ts` | Экспорты модуля |
| `src/lib/config/types.ts` | TypeScript типы, enums, дефолты |
| `src/lib/config/validators.ts` | Zod схемы валидации |
| `src/lib/config/encryption.ts` | AES-256-GCM шифрование credentials |
| `src/lib/config/ServiceConfigResolver.ts` | Центральный резолвер конфигураций |
| **Бизнес-логика** |
| `src/modules/settings/services/ServiceConfigurationService.ts` | CRUD операции, тестирование подключений |
| `src/modules/settings/services/connectors/BaseConnector.ts` | Абстрактный базовый класс |
| `src/modules/settings/services/connectors/RedisConnector.ts` | Коннектор Redis |
| `src/modules/settings/services/connectors/PostgreSQLConnector.ts` | Коннектор PostgreSQL |
| `src/modules/settings/services/connectors/S3Connector.ts` | Коннектор S3 (AWS, MinIO, Yandex, Selectel, custom) |
| `src/modules/settings/services/connectors/PrometheusConnector.ts` | Коннектор Prometheus |
| `src/modules/settings/services/connectors/LokiConnector.ts` | Коннектор Loki |
| `src/modules/settings/services/connectors/GrafanaConnector.ts` | Коннектор Grafana |
| `src/modules/settings/services/connectors/SentryConnector.ts` | Коннектор Sentry |
| `src/modules/settings/services/connectors/ElasticsearchConnector.ts` | Коннектор Elasticsearch |
| `src/modules/settings/services/connectors/SMTPConnector.ts` | Коннектор SMTP |
| **API endpoints** |
| `src/app/api/admin/settings/services/route.ts` | GET (список), POST (создание) |
| `src/app/api/admin/settings/services/[id]/route.ts` | GET, PUT, DELETE |
| `src/app/api/admin/settings/services/[id]/test/route.ts` | POST (тест подключения) |
| `src/app/api/admin/settings/services/[id]/toggle/route.ts` | POST (вкл/выкл) |
| `src/app/api/admin/settings/services/status/route.ts` | GET (статус всех сервисов) |
| **UI** |
| `src/app/[lang]/(dashboard)/(private)/admin/settings/services/page.tsx` | Страница управления сервисами |
| **Навигация** |
| `src/data/navigation/verticalMenuData.tsx` | Пункт меню "External Services" |
| `src/data/navigation/horizontalMenuData.tsx` | Пункт меню "External Services" |
| `src/components/layout/vertical/VerticalMenu.tsx` | Иконка в меню |
| **Seed данные** |
| `prisma/seed.ts` | 18 тестовых конфигураций (все disabled) |

### Приоритеты конфигурации

**Для большинства сервисов (ServiceConfigResolver):**
```
1️⃣ Admin (БД)  →  2️⃣ ENV (.env)  →  3️⃣ Default (Docker)
```

**Для S3/MinIO (StorageService):**
```
1️⃣ ENV (.env)  →  2️⃣ Admin (БД)
```

> ⚠️ S3 использует обратный приоритет для удобства DevOps — настройки в `.env` важнее БД.

**Пример Redis:**
- Если в БД есть активная конфигурация Redis → используется она
- Если нет в БД, но есть `REDIS_URL` в `.env` → используется ENV
- Если нет ни того, ни другого → используется `redis://localhost:6379`

**Пример S3:**
- Если есть `S3_ENDPOINT` в `.env` → используется `.env`
- Если `.env` пуст → используется БД (Admin Panel)

### Использование

```typescript
import { serviceConfigResolver } from '@/lib/config'

// Получить конфигурацию Redis
const config = await serviceConfigResolver.getConfig('redis')
console.log(config.source) // 'admin' | 'env' | 'default'
console.log(config.url)    // 'redis://localhost:6379'
console.log(config.host)   // 'localhost'
console.log(config.port)   // 6379

// Очистить кэш после изменения в админке
serviceConfigResolver.clearCache('redis')

// Получить источник конфигурации
const source = await serviceConfigResolver.getConfigSource('redis')
```

### Поддерживаемые сервисы

| Сервис | ENV переменная | Дефолтный URL | Коннектор |
|--------|----------------|---------------|-----------|
| Redis | `REDIS_URL` | `redis://localhost:6379` | ✅ RedisConnector |
| PostgreSQL | `DATABASE_URL` | `postgresql://user:pass@localhost:5432/db` | ✅ PostgreSQLConnector |
| Prometheus | `PROMETHEUS_URL` | `http://localhost:9090` | ✅ PrometheusConnector |
| Loki | `LOKI_URL` | `http://localhost:3100` | ✅ LokiConnector |
| Grafana | `GRAFANA_URL` | `http://localhost:3001` | ✅ GrafanaConnector |
| Sentry | `SENTRY_DSN` | - | ✅ SentryConnector |
| SMTP | `SMTP_URL` | `smtp://localhost:1025` | ✅ SMTPConnector |
| S3 | `S3_ENDPOINT` | `http://localhost:9000` | ✅ S3Connector |
| Elasticsearch | `ELASTICSEARCH_URL` | `http://localhost:9200` | ✅ ElasticsearchConnector |

### S3 Custom конфигурация

S3 коннектор поддерживает кастомные S3-совместимые хранилища:

| Провайдер | storageType | forcePathStyle | Регион |
|-----------|-------------|----------------|--------|
| MinIO | `minio` | ✅ true | `us-east-1` |
| AWS S3 | `aws` | ❌ false | `us-east-1` |
| DigitalOcean Spaces | `digitalocean` | ❌ false | `nyc3` |
| Yandex Object Storage | `yandex` | ❌ false | `ru-central1` |
| Selectel S3 | `selectel` | ✅ true | `ru-1` |
| Custom S3 | `custom` | ✅ true | Любой |

**Metadata для S3:**
```json
{
  "region": "us-east-1",
  "bucket": "my-bucket",
  "storageType": "minio",
  "forcePathStyle": true
}
```

### Шифрование

Credentials (пароли, токены, сертификаты) шифруются AES-256-GCM. Требуется `CREDENTIALS_ENCRYPTION_KEY` в `.env`:

```bash
# Сгенерировать ключ:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Добавить в .env:
CREDENTIALS_ENCRYPTION_KEY=your-64-char-hex-key
```

**Важно:** В seed данные могут храниться без шифрования (для удобства), но в production все credentials должны быть зашифрованы.

### Интеграция с существующими модулями

| Модуль | Статус | Файл |
|--------|--------|------|
| NotificationQueue | ✅ Интегрирован | `src/services/notifications/NotificationQueue.ts` |
| Health API | ✅ Интегрирован | `src/app/api/health/route.ts` |
| RateLimitStore | ✅ Интегрирован | `src/lib/rate-limit/stores/index.ts` |
| Role Cache | ✅ Интегрирован | `src/lib/role-cache/index.ts` |
| Socket.IO (Redis adapter) | ✅ Интегрирован | `src/lib/sockets/index.ts` |
| Sentry | ✅ Интегрирован | `src/lib/sentry.ts` |
| Monitoring Dashboard | ✅ Интегрирован | `src/app/api/admin/monitoring/dashboard/route.ts` |

### Seed данные

В `prisma/seed.ts` создаются 18 тестовых конфигураций (все с `enabled: false`):

- Redis (2): local, production
- PostgreSQL (2): local, production
- Prometheus (2): local, production
- Loki (2): local, production
- Grafana (2): local, production
- Sentry (1): production
- S3 (3): MinIO, AWS, Yandex
- SMTP (2): Gmail, SendGrid
- Elasticsearch (2): local, production

**Запуск seed:**
```bash
npx prisma db seed
```

### API endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/settings/services` | Список всех сервисов |
| POST | `/api/admin/settings/services` | Создать конфигурацию |
| GET | `/api/admin/settings/services/[id]` | Получить конфигурацию |
| PUT | `/api/admin/settings/services/[id]` | Обновить конфигурацию |
| DELETE | `/api/admin/settings/services/[id]` | Удалить конфигурацию |
| POST | `/api/admin/settings/services/[id]/test` | Тестировать подключение |
| POST | `/api/admin/settings/services/[id]/toggle` | Включить/выключить |
| GET | `/api/admin/settings/services/status` | Статус всех сервисов |

### UI страница

**Путь:** `/admin/settings/services`

**Функции:**
- ✅ Таблица со списком сервисов
- ✅ Статусы подключения (Connected/Error/Unknown)
- ✅ Создание/редактирование/удаление
- ✅ Тестирование подключения
- ✅ Включение/отключение сервисов
- ✅ S3-специфичные настройки (тип хранилища, регион, bucket, path-style)
- ✅ PostgreSQL-специфичные настройки (база данных)

### События (EventService)

| Тип | Триггер | Severity |
|-----|---------|----------|
| `service_configuration.created` | POST /api/admin/settings/services | info |
| `service_configuration.updated` | PUT /api/admin/settings/services/[id] | info |
| `service_configuration.deleted` | DELETE /api/admin/settings/services/[id] | warning |
| `service_configuration.test_success` | POST /api/admin/settings/services/[id]/test | info |
| `service_configuration.test_failed` | POST /api/admin/settings/services/[id]/test | warning |
| `service_configuration.enabled` | POST /api/admin/settings/services/[id]/toggle | info |
| `service_configuration.disabled` | POST /api/admin/settings/services/[id]/toggle | info |

> ⚠️ **Важно:** Для записи событий использовать `eventService.record()`, а не `emit()`.
> Метод `emit()` не существует в классе EventService.
> См. [Анализ бага eventService.emit](analysis/architecture/analysis-s3-eventservice-bug-2025-11-27.md)

### Связанные документы

- [Анализ модуля](analysis/architecture/analysis-service-configuration-module-2025-11-25.md)
- [Анализ бага eventService.emit](analysis/architecture/analysis-s3-eventservice-bug-2025-11-27.md)
- [План реализации](plans/active/plan-service-configuration-module-2025-11-25.md)
- [API документация](api/service-configuration.md)
- [Руководство для админов](admin/external-services.md)

---

## 💾 Redux Store с персистенцией (обновлено 2025-11-25)

### Назначение

Redux Store с `redux-persist` для сохранения состояния между перезагрузками страницы. Основное применение — **очередь сообщений чата** (unsent messages).

### Структура файлов

| Путь | Назначение |
|------|------------|
| `src/redux-store/index.ts` | Конфигурация store + persist |
| `src/redux-store/ReduxProvider.tsx` | Provider для Next.js App Router |
| `src/redux-store/slices/chatQueue.ts` | Очередь неотправленных сообщений |
| `src/redux-store/slices/chat.ts` | Состояние чата |
| `src/redux-store/slices/notifications.ts` | Состояние уведомлений |
| `src/redux-store/slices/calendar.ts` | Состояние календаря |
| `src/redux-store/slices/kanban.ts` | Состояние Kanban доски |
| `src/redux-store/slices/email.ts` | Состояние почты |

### Персистенция (redux-persist)

```typescript
// Конфигурация в src/redux-store/index.ts
const persistConfig = {
  key: 'root',
  version: 1,
  storage,           // localforage (IndexedDB) на клиенте, noop на сервере
  whitelist: ['chatQueue']  // Только chatQueue сохраняется
}
```

**Что сохраняется:**
- ✅ `chatQueue` — неотправленные сообщения чата
- ❌ `chat`, `notifications`, `calendar`, `kanban`, `email` — НЕ сохраняются

### SSR совместимость

Для работы с Next.js SSR используется **noop storage** на сервере:

```typescript
import localforage from 'localforage'

// На сервере localforage недоступен, используем заглушку
const createNoopStorage = () => ({
  getItem: () => Promise.resolve(null),
  setItem: (_key, value) => Promise.resolve(value),
  removeItem: () => Promise.resolve()
})

// localforage (IndexedDB) на клиенте, noop на сервере
const storage = typeof window !== 'undefined' 
  ? localforage 
  : createNoopStorage()
```

### Очередь сообщений (chatQueue)

| Статус | Описание |
|--------|----------|
| `pending` | Сообщение ожидает отправки |
| `sending` | Сообщение отправляется |
| `failed` | Ошибка отправки (можно повторить) |

**Actions:**
- `enqueueMessage` — добавить сообщение в очередь
- `markMessageSending` — пометить как отправляемое
- `markMessageFailed` — пометить как failed с ошибкой
- `markMessageDelivered` — удалить из очереди (успешно доставлено)
- `clearRoomMessages` — очистить сообщения комнаты

### Зависимости

```json
{
  "redux-persist": "^6.0.0",
  "@reduxjs/toolkit": "^2.3.0",
  "localforage": "^1.10.0"
}
```

**Примечание:** Используется `localforage` (IndexedDB) на клиенте для большей производительности и объёма хранения (до 50MB), с noop storage на сервере для SSR совместимости.

---

## 👤 Модуль "Система аккаунтов пользователей" (добавлено 2025-11-26)

### Назначение

Система множественных аккаунтов, позволяющая одному пользователю иметь несколько аккаунтов с разными тарифными планами:
- **Типы аккаунтов:** LISTING (объявления), COMPANY (компания), NETWORK (сеть компаний)
- **Тарифные планы:** FREE, BASIC, PRO, ENTERPRISE — привязаны к аккаунтам, не к пользователям
- **Менеджеры:** назначение других пользователей для управления аккаунтами
- **Передача аккаунтов:** возможность передать аккаунт другому пользователю

### Модели данных

```prisma
model TariffPlan {
  id          String   @id @default(cuid())
  code        String   @unique  // 'FREE', 'BASIC', 'PRO', 'ENTERPRISE'
  name        String
  description String?
  price       Float    @default(0)
  features    String?  // JSON: лимиты и возможности
  isActive    Boolean  @default(true)
  accounts    UserAccount[]
}

model UserAccount {
  id           String   @id @default(cuid())
  userId       String   // Текущий владелец
  ownerId      String   // Первоначальный владелец
  name         String
  description  String?
  type         String   // 'LISTING', 'COMPANY', 'NETWORK'
  tariffPlanId String
  status       String   @default("active")
  managers     AccountManager[]
  transfers    AccountTransfer[]
}

model AccountManager {
  id        String   @id @default(cuid())
  accountId String
  userId    String   // Назначенный пользователь
  canManage Boolean  @default(true)
  canEdit   Boolean  @default(true)
  canDelete Boolean  @default(false)
  assignedBy String
  @@unique([accountId, userId])
}

model AccountTransfer {
  id            String   @id @default(cuid())
  fromAccountId String
  toUserId      String
  status        String   @default("pending")
  requestedBy   String
}
```

### Структура файлов

| Путь | Назначение |
|------|------------|
| **Типы и валидация** |
| `src/types/accounts/types.ts` | Enums: AccountType, AccountStatus, TariffPlanCode |
| `src/types/accounts/interfaces.ts` | Интерфейсы с отношениями |
| `src/lib/validations/account-schemas.ts` | Zod-схемы валидации |
| **Сервисы** |
| `src/services/accounts/TariffPlanService.ts` | CRUD тарифных планов |
| `src/services/accounts/AccountService.ts` | CRUD аккаунтов |
| `src/services/accounts/AccountManagerService.ts` | Управление менеджерами |
| `src/services/accounts/AccountTransferService.ts` | Передача аккаунтов |
| `src/services/accounts/AccountAccessService.ts` | Проверка прав доступа |
| `src/services/accounts/AccountRulesService.ts` | Бизнес-правила (json-rules-engine) |
| **Workflow** |
| `src/services/workflows/machines/AccountMachine.ts` | XState машина аккаунта |
| `src/services/workflows/AccountWorkflowService.ts` | Сервис workflow |
| **API endpoints** |
| `src/app/api/accounts/route.ts` | GET (список), POST (создание) |
| `src/app/api/accounts/[id]/route.ts` | GET, PUT, DELETE |
| `src/app/api/accounts/[id]/switch/route.ts` | POST переключение аккаунта |
| `src/app/api/accounts/current/route.ts` | GET текущий аккаунт |
| `src/app/api/accounts/[id]/managers/route.ts` | GET/POST менеджеры |
| `src/app/api/accounts/[id]/managers/[managerId]/route.ts` | PUT/DELETE менеджер |
| `src/app/api/accounts/[id]/transfer/route.ts` | POST/GET передача |
| `src/app/api/accounts/transfers/route.ts` | GET все запросы |
| `src/app/api/accounts/transfers/[transferId]/accept/route.ts` | POST принять |
| `src/app/api/accounts/transfers/[transferId]/reject/route.ts` | POST отклонить |
| `src/app/api/accounts/transfers/[transferId]/cancel/route.ts` | POST отменить |
| `src/app/api/tariff-plans/route.ts` | GET тарифные планы |
| **React контекст** |
| `src/contexts/AccountContext.tsx` | Провайдер и хуки |
| `src/hooks/useAccount.ts` | Хуки: useCurrentAccount, useSwitchAccount |
| **UI компоненты** |
| `src/components/accounts/AccountSwitcher.tsx` | Переключатель в хедере |
| `src/components/accounts/AccountCard.tsx` | Карточка аккаунта |
| `src/components/accounts/AccountForm.tsx` | Форма создания/редактирования |
| `src/components/accounts/ManagerList.tsx` | Список менеджеров |
| `src/components/accounts/AssignManagerDialog.tsx` | Диалог назначения |
| `src/components/accounts/TransferAccountDialog.tsx` | Диалог передачи |
| **Страницы** |
| `src/app/[lang]/(dashboard)/(private)/accounts/page.tsx` | Список аккаунтов |
| `src/app/[lang]/(dashboard)/(private)/accounts/[id]/page.tsx` | Детали аккаунта |
| `src/app/[lang]/(dashboard)/(private)/accounts/[id]/managers/page.tsx` | Менеджеры аккаунта |
| `src/app/[lang]/(dashboard)/(private)/accounts/transfers/page.tsx` | Запросы на передачу |
| `src/app/[lang]/(dashboard)/(private)/accounts/tariffs/page.tsx` | Тарифные планы |
| `src/app/[lang]/(dashboard)/(private)/accounts/managers/page.tsx` | Все менеджеры |
| `src/app/[lang]/(dashboard)/(private)/accounts/create/page.tsx` | Создание аккаунта |

### Тарифные планы

| Код | Название | Цена | Срок | Описание |
|-----|----------|------|------|----------|
| `FREE` | Free | 0 | 30 дней (пробный) / бессрочный | Бесплатный тариф |
| `BASIC` | Basic | 990 | 30 дней | Базовый тариф |
| `PRO` | Pro | 2990 | 30 дней | Профессиональный тариф |
| `ENTERPRISE` | Enterprise | 9990 | 30 дней | Корпоративный тариф |

### Срок действия тарифов

**Модель подписки:** Помесячная (пакеты объявлений + доступ к модулям)

| Поле | Описание |
|------|----------|
| `tariffStartedAt` | Дата начала текущего тарифа |
| `tariffPaidUntil` | Оплачено до (null = бессрочный FREE) |
| `tariffReminderSentAt` | Когда отправлено последнее напоминание |
| `tariffAutoRenew` | Автоматическое продление |

**Напоминания об истечении:**

| Дней до истечения | Каналы | Шаблон |
|-------------------|--------|--------|
| 7 дней | email, browser | `tariff-expiring-7-days` |
| 3 дня | email, browser | `tariff-expiring-3-days` |
| 1 день | email, browser, SMS | `tariff-expiring-1-day` |
| Истёк | email, browser | `tariff-expired` |

**При истечении:** Автоматический downgrade на FREE (бессрочный)

### Типы аккаунтов

| Тип | Описание | Создается при |
|-----|----------|---------------|
| `LISTING` | Для публикации объявлений | Регистрация "Для объявлений" |
| `COMPANY` | Для размещения компании | Регистрация "Для компании" |
| `NETWORK` | Сеть компаний (множественные аккаунты) | Регистрация "Сеть компаний" |

### Seed данные

В `prisma/seed.ts` создаются демо-данные:

| Сущность | Количество | Описание |
|----------|------------|----------|
| `TariffPlan` | 4 | FREE, BASIC, PRO, ENTERPRISE |
| `UserAccount` | 4 | Демо-аккаунты для тестовых пользователей |
| `AccountManager` | 1 | editor → admin account |
| `AccountTransfer` | 1 | moderator → user (pending) |

**Демо аккаунты:**

| Пользователь | Тип | Тариф |
|--------------|-----|-------|
| admin@example.com | NETWORK | PRO |
| user@example.com | LISTING | FREE |
| moderator@example.com | COMPANY | BASIC |
| editor@example.com | LISTING | FREE |

### Навигация

В вертикальном и горизонтальном меню добавлен блок "Аккаунты":
- Мои аккаунты (`/accounts`)
- Тарифные планы (`/accounts/tariffs`)
- Менеджеры (`/accounts/managers`)
- Передача аккаунтов (`/accounts/transfers`)
- Создать аккаунт (`/accounts/create`)

### Интеграции

- **XState:** AccountMachine для управления состояниями (active, suspended, archived)
- **json-rules-engine:** AccountRulesService для бизнес-правил
- **EventService:** Логирование операций с аккаунтами
- **Регистрация:** Выбор типа аккаунта при регистрации

### Связанные документы

- [План реализации](plans/active/plan-user-accounts-system-2025-01-25.md)
- [API документация](api/accounts.md)

---

## 🔄 Модуль "Workflow & Rules Engine" (обновлено 2025-11-26)

### Назначение

Централизованная система управления жизненным циклом сущностей (workflow) и бизнес-правилами:
- **XState машины** — управление состояниями User, Listing, Account
- **json-rules-engine** — гибкие бизнес-правила с условиями и действиями
- **EventService интеграция** — автоматическая проверка правил при событиях

### Модели данных

```prisma
model WorkflowInstance {
  id        String   @id @default(cuid())
  type      String   // 'listing', 'user', 'account'
  entityId  String   // ID сущности
  state     String   // Текущее состояние
  context   String?  // JSON контекст
  version   Int      @default(1)
  transitions WorkflowTransition[]
  @@unique([type, entityId])
}

model BusinessRule {
  id          String   @id @default(cuid())
  name        String   @unique
  category    String   // 'blocking', 'notification', 'tariff'
  conditions  String   // JSON: { all: [...], any: [...] }
  event       String   // JSON: { type, params }
  priority    Int      @default(0)
  enabled     Boolean  @default(true)
  executions  RuleExecution[]
}
```

### Структура файлов

| Путь | Назначение |
|------|------------|
| **XState машины** |
| `src/services/workflows/machines/UserMachine.ts` | Workflow пользователя (active, suspended, blocked, deleted) |
| `src/services/workflows/machines/ListingMachine.ts` | Workflow объявления (draft, pending, active, rejected, sold, archived) |
| `src/services/workflows/machines/AccountMachine.ts` | Workflow аккаунта (active, suspended, archived) |
| `src/services/workflows/types.ts` | TypeScript типы для workflow |
| **Сервисы workflow** |
| `src/services/workflows/UserWorkflowService.ts` | Управление состоянием пользователей |
| `src/services/workflows/ListingWorkflowService.ts` | Управление состоянием объявлений |
| `src/services/workflows/AccountWorkflowService.ts` | Управление состоянием аккаунтов |
| `src/services/workflows/WorkflowService.ts` | Базовый сервис workflow |
| **Rules Engine** |
| `src/services/rules/RulesEngine.ts` | Обёртка над json-rules-engine |
| `src/services/rules/RulesService.ts` | CRUD правил, кэширование, выполнение |
| `src/services/rules/EventRulesHandler.ts` | Интеграция с EventService |
| `src/services/rules/facts/index.ts` | Async факты (user, listing, account, stats) |
| `src/services/rules/rules/auto-blocking-rules.ts` | Правила автоблокировок |
| `src/services/rules/rules/notification-rules.ts` | Правила уведомлений |
| `src/services/rules/initialize.ts` | Инициализация при старте |
| **API endpoints** |
| `src/app/api/admin/users/[id]/workflow/route.ts` | GET/POST workflow пользователя |
| `src/app/api/admin/users/[id]/workflow/history/route.ts` | GET история переходов |
| `src/app/api/listings/[id]/workflow/route.ts` | GET/POST workflow объявления |
| `src/app/api/listings/[id]/workflow/history/route.ts` | GET история переходов |

### Workflow состояния

**User workflow:**

| Состояние | Описание | Может войти? |
|-----------|----------|--------------|
| `active` | Активный пользователь | ✅ Да |
| `suspended` | Временно приостановлен | ❌ Нет |
| `blocked` | Заблокирован | ❌ Нет |
| `deleted` | Удалён (soft delete) | ❌ Нет |

**Listing workflow:**

| Состояние | Описание |
|-----------|----------|
| `draft` | Черновик |
| `pending` | На модерации |
| `active` | Опубликовано |
| `rejected` | Отклонено |
| `sold` | Продано |
| `archived` | В архиве |
| `deleted` | Удалено |

**Account workflow:**

| Состояние | Описание |
|-----------|----------|
| `active` | Активный аккаунт |
| `suspended` | Приостановлен |
| `archived` | Архивирован |

### Категории правил

| Категория | Описание | Примеры |
|-----------|----------|---------|
| `blocking` | Автоблокировки | При спам-жалобах, массовом постинге |
| `notification` | Уведомления | Welcome-email, одобрение объявления, напоминания о тарифах |
| `tariff` | Тарифные правила | Напоминания об истечении (7, 3, 1 день) |

### Планировщики (Schedulers)

| Планировщик | Интервал | Описание |
|-------------|----------|----------|
| `TariffExpirationScheduler` | 1 час | Проверка истекающих тарифов |

**Структура файлов:**

| Путь | Назначение |
|------|------------|
| `src/services/scheduler/index.ts` | Экспорт и инициализация планировщиков |
| `src/services/scheduler/TariffExpirationScheduler.ts` | Проверка истекающих тарифов |

**Действия планировщика тарифов:**
1. Находит аккаунты с `tariffPaidUntil` в ближайшие 7 дней
2. Отправляет события для Rules Engine (`tariff.check_expiration`)
3. Обновляет `tariffReminderSentAt` после отправки напоминания
4. Выполняет downgrade на FREE при истечении тарифа

### Seed данные

В `prisma/seed.ts` создаются демо-данные:

| Сущность | Количество | Описание |
|----------|------------|----------|
| `ListingCategory` | 5 | Категории: Недвижимость, Транспорт, Электроника, Услуги, Работа |
| `Listing` | 6 | Объявления с разными статусами workflow |
| `EmailTemplate` | 4 | Шаблоны для напоминаний о тарифах |
| `BusinessRule` | 11 | Включая 4 правила для тарифов |

**Демо аккаунты с тарифами:**

| Аккаунт | Тариф | `tariffPaidUntil` | Для теста |
|---------|-------|-------------------|-----------|
| admin (NETWORK) | PRO | +30 дней | Нормальная работа |
| user (LISTING) | FREE | +5 дней | Напоминание за 3 дня |
| moderator (COMPANY) | BASIC | +2 дня | Срочное напоминание |
| editor (LISTING) | FREE | null | Бессрочный (после downgrade) |
| `WorkflowInstance` | 6 | Экземпляры workflow для объявлений |
| `BusinessRule` | 8 | Правила блокировок и уведомлений |

**Демо объявления:**

| ID | Статус | Описание |
|----|--------|----------|
| `demo-listing-draft` | draft | Квартира (черновик) |
| `demo-listing-pending` | pending | Toyota Camry (на модерации) |
| `demo-listing-active` | active | iPhone 15 Pro Max (активное) |
| `demo-listing-rejected` | rejected | Услуги по ремонту (отклонено) |
| `demo-listing-sold` | sold | MacBook Pro M3 (продано) |
| `demo-listing-archived` | archived | Вакансия Frontend (архив) |

**Демо правила:**

| Правило | Категория | Статус |
|---------|-----------|--------|
| `auto-block-on-spam-reports` | blocking | ✅ Enabled |
| `auto-suspend-on-excessive-listings` | blocking | ✅ Enabled |
| `welcome-email-on-registration` | notification | ✅ Enabled |
| `listing-approved-notification` | notification | ✅ Enabled |
| `listing-rejected-notification` | notification | ✅ Enabled |
| `tariff-expiring-reminder` | notification | ❌ Disabled |
| `new-message-notification` | notification | ✅ Enabled |
| `password-reset-email` | notification | ✅ Enabled |

### Связанные документы

- [Анализ интеграции](analysis/architecture/analysis-rules-engine-integration-status-2025-11-25.md)
- [Сводка интеграции](analysis/architecture/analysis-rules-engine-integration-summary-2025-11-25.md)
- [Почему справочники без workflow](analysis/architecture/analysis-reference-tables-not-workflow-2025-11-25.md)

---

## 🖼️ Модуль "Media" (обновлено 2025-11-26)

### Назначение

Централизованная система управления изображениями в стиле WordPress с возможностями:
- **Обработка изображений** (sharp) — ресайз, конвертация в WebP, очистка EXIF
- **Единый максимум оригинала** — 1920×1280 для ВСЕХ типов сущностей
- **Гибкие варианты** — разные размеры для разных типов (баннеры, аватары, товары)
- **Водяные знаки** — наложение на определённые типы сущностей
- **Гибкое хранение** — Local, S3, или гибридное (local_first)
- **Синхронизация** — пакетная выгрузка/загрузка между хранилищами
- **SEO-поля** — alt, title, caption, description для каждого файла
- **Lightbox** — просмотр изображений в полном размере

### Обработка изображений

#### Единый стандарт оригинала

Все загруженные изображения автоматически обрабатываются:

```
Загружено: photo.jpg (любой размер, например 7360×4912)
     ↓
1. ОРИГИНАЛ: максимум 1920×1280 (fit: inside, сохраняет пропорции)
     ↓
2. ВАРИАНТЫ по настройкам типа сущности:
   - Баннер: 1920×480, 800×300, 400×150
   - Аватар: 200×200
   - Товар: 1200×900, 600×450, 150×150
```

**Правила:**
- Оригинал ВСЕГДА ≤ 1920×1280 (единый максимум для всех типов)
- Пропорции сохраняются (`fit: inside`)
- Варианты создаются из обработанного оригинала
- EXIF-данные удаляются для безопасности
- Изображения конвертируются в WebP для оптимизации

#### Безопасность загрузки

| Аспект | Реализация |
|--------|------------|
| Имя файла | Генерируется уникальный slug (nanoid), оригинал сохраняется в БД |
| EXIF/метаданные | Полностью удаляются |
| Размер | Ограничен настройками entityType (5-15 MB) |
| Формат | Валидация MIME-type, конвертация в WebP |
| Путь | Изолированная структура `uploads/{entityType}/{year}/{month}/` |

### Модели данных

```prisma
model Media {
  id              String   @id @default(cuid())
  filename        String   // Оригинальное имя (для истории)
  slug            String   @unique // Уникальный безопасный идентификатор
  localPath       String?  // Путь в локальном хранилище
  s3Key           String?  // Ключ в S3
  storageStatus   String   @default("local_only") // local_only, synced, s3_only
  mimeType        String
  originalMimeType String? // Исходный MIME до конвертации
  size            Int
  width           Int?     // Размеры обработанного оригинала (≤1920×1280)
  height          Int?
  variants        String   @default("{}") // JSON с вариантами размеров
  entityType      String   // user_avatar, listing_image, etc.
  entityId        String?  // ID связанной сущности
  position        Int      @default(0)
  hasWatermark    Boolean  @default(false)
  isProcessed     Boolean  @default(false)
  // SEO поля
  alt             String?  // Alt-текст для изображения
  title           String?  // Title атрибут
  caption         String?  // Подпись к изображению
  description     String?  // Развёрнутое описание
  // Автор
  uploadedBy      String?
  uploadedUser    User?    @relation("UploadedMedia", fields: [uploadedBy], references: [id])
  // Лицензии
  licenses        MediaLicenseItem[]
  
  @@index([entityType, entityId])
  @@index([storageStatus])
  @@index([slug])
  @@map("media")
}

model ImageSettings {
  id                String   @id @default(cuid())
  entityType        String   @unique // user_avatar, listing_image
  displayName       String
  description       String?
  maxFileSize       Int      @default(5242880) // 5MB
  maxFilesPerEntity Int      @default(1)
  allowedMimeTypes  String
  variants          String   // JSON: размеры вариантов (кроме original)
  convertToWebP     Boolean  @default(true)
  stripMetadata     Boolean  @default(true)
  quality           Int      @default(85)
  watermarkEnabled  Boolean  @default(false)
  watermarkId       String?
  watermarkPosition String?
  watermarkOpacity  Float    @default(0.3)
  storageStrategy   String   @default("local_first")
  @@map("image_settings")
}

model MediaSyncJob {
  id              String   @id @default(cuid())
  operation       String   // upload_to_s3, download_from_s3, delete_local
  scope           String   // all, entity_type, selected
  status          String   @default("pending")
  totalFiles      Int
  processedFiles  Int      @default(0)
  deleteSource    Boolean  @default(false)
  @@map("media_sync_jobs")
}

model Watermark {
  id              String   @id @default(cuid())
  name            String   @unique
  displayName     String
  mediaId         String?  // PNG файл водяного знака
  defaultPosition String   @default("bottom-right")
  defaultOpacity  Float    @default(0.3)
  entityTypes     String   @default("[]") // Для каких сущностей
  isDefault       Boolean  @default(false)
  @@map("watermarks")
}
```

### Структура файлов

| Путь | Назначение |
|------|------------|
| **Сервисы** |
| `src/services/media/MediaService.ts` | CRUD операции, upload с единым оригиналом 1920×1280 |
| `src/services/media/ImageProcessingService.ts` | Обработка изображений (sharp) |
| `src/services/media/WatermarkService.ts` | Водяные знаки |
| `src/services/media/storage/StorageService.ts` | Абстракция хранилища |
| `src/services/media/storage/LocalAdapter.ts` | Локальное хранилище |
| `src/services/media/storage/S3Adapter.ts` | S3 хранилище |
| `src/services/media/sync/MediaSyncService.ts` | Синхронизация хранилищ |
| **API endpoints** |
| `src/app/api/admin/media/route.ts` | GET (список с uploadedUser), POST (загрузка) |
| `src/app/api/admin/media/[id]/route.ts` | GET (с uploadedUser), PUT (SEO-поля), DELETE |
| `src/app/api/admin/media/sync/route.ts` | POST (создать sync job), GET (список) |
| `src/app/api/admin/media/sync/[jobId]/route.ts` | GET (статус), DELETE (отмена) |
| `src/app/api/admin/media/settings/route.ts` | GET, PUT, POST настроек |
| `src/app/api/admin/media/watermarks/route.ts` | CRUD водяных знаков |
| `src/app/api/admin/media/watermarks/[id]/preview/route.ts` | Превью с водяным знаком |
| **UI компоненты** |
| `src/views/admin/media/MediaLibrary.tsx` | Медиатека — сетка и таблица, два режима отображения |
| `src/views/admin/media/MediaDetailSidebar.tsx` | Боковая панель: SEO-поля, доступные размеры, Lightbox |
| `src/views/admin/media/MediaSettings.tsx` | Настройки обработки изображений |
| `src/views/admin/media/MediaSync.tsx` | Управление синхронизацией |
| `src/views/admin/media/MediaWatermarks.tsx` | Управление водяными знаками |
| `src/views/admin/media/MediaLicenses.tsx` | Список лицензий |
| `src/views/admin/media/MediaLicenseForm.tsx` | Форма создания/редактирования лицензии |
| `src/components/ImageWithLightbox.tsx` | Переиспользуемый компонент: изображение с Lightbox |
| **Типы и пресеты** |
| `src/services/media/types.ts` | TypeScript типы |
| `src/services/media/presets.ts` | Предустановленные настройки |

### UI медиатеки (WordPress-style)

#### Drag & Drop загрузка

- **react-dropzone** — множественная загрузка файлов
- **Прогресс-бар** — для каждого файла (XMLHttpRequest)
- **Превью** — до загрузки (URL.createObjectURL)
- **Валидация** — типы файлов, размер (до 15 MB)

#### Режимы отображения

| Режим | Описание |
|-------|----------|
| **Grid** | Сетка изображений 6 колонок, равная ширина, checkbox выбора |
| **List** | Таблица: превью, имя, размер, тип, статус, дата, действия |

#### MediaDetailSidebar

Боковая панель деталей (Drawer) с адаптивной шириной:

| Секция | Содержимое |
|--------|------------|
| **Изображение** | Превью с Lightbox (клик по плюсу) |
| **Информация о файле** | Имя (копируемое), размер, разрешение, тип, статус, путь |
| **URL файла** | Полный путь (копируемый с доменом) |
| **SEO-поля** | Alt, Title, Caption, Description — редактируемые |
| **Автор** | uploadedUser (имя, email) |
| **Доступные размеры** | Оригинал + варианты с разрешением, копирование URL, открытие в Lightbox |
| **Действия** | Сохранить, Удалить, На S3 (для local_only) |

**Для файлов в корзине:**

| Секция | Содержимое |
|--------|------------|
| **Статус** | Чип "В корзине" (warning) |
| **Путь** | `.trash/{mediaId}/{filename}` |
| **Действия** | Только "Восстановить" и "Удалить навсегда" |
| **SEO-поля** | Скрыты |

### Типы сущностей (entityType)

| entityType | Описание | Макс. файл | Варианты | Водяной знак |
|------------|----------|------------|----------|--------------|
| `user_avatar` | Аватар пользователя | 5 MB | 200×200 | ❌ |
| `company_logo` | Логотип компании | 2 MB | 200×200, 100×100, 50×50 | ❌ |
| `company_banner` | Баннер компании | 10 MB | 1920×480, 800×300, 400×150 | ❌ |
| `company_photo` | Фото компании | 10 MB | 1200×900, 600×450, 150×150 | ✅ |
| `listing_image` | Фото объявления | 10 MB | 1200×900, 600×450, 150×150 | ✅ |
| `site_logo` | Логотип сайта | 1 MB | 200×80, 100×40 | ❌ |
| `watermark` | Водяной знак | 1 MB | — | ❌ |
| `document` | Документы | 15 MB | — | ❌ |
| `other` | Прочие файлы | 10 MB | 1200×800, 600×400, 150×150 | ❌ |

**Важно:** Оригинал ВСЕГДА обрабатывается до 1920×1280 независимо от типа сущности.

### Стратегии хранения (storageStrategy)

| Стратегия | Описание |
|-----------|----------|
| `local_only` | Только локальное хранилище |
| `local_first` | Сначала локально, затем синхронизация на S3 |
| `s3_only` | Только S3 (локально временно при загрузке) |
| `both` | Хранить в обоих хранилищах |

### Корзина (Trash) — обновлено 2025-11-29

```
Обычные файлы:     public/uploads/{entityType}/{year}/{month}/{file}.webp
Файлы в корзине:   storage/.trash/{mediaId}/{file}.webp  ← ВНЕ public/
```

**Важно:** Корзина находится **вне** папки `public/`, поэтому файлы **недоступны по прямому URL** после удаления.

| Операция | Описание |
|----------|----------|
| **Soft Delete** | Перемещает файлы в `storage/.trash/`, удаляет с S3, устанавливает `deletedAt` |
| **Restore** | Возвращает файлы в `public/uploads/`, перезаливает на S3, очищает `deletedAt` |
| **Hard Delete** | Удаляет файлы из `storage/.trash/` и запись из БД |

**API:**

| Method | Endpoint | Описание |
|--------|----------|----------|
| `DELETE` | `/api/admin/media/[id]` | Soft delete (в корзину) |
| `DELETE` | `/api/admin/media/[id]` + `{ hard: true }` | Hard delete |
| `PATCH` | `/api/admin/media/[id]` + `{ action: 'restore' }` | Восстановить |
| `GET` | `/api/admin/media/[id]/trash?variant=original` | Файл из корзины (только для админов) |

**trashMetadata** (JSON):

```json
{
  "originalPath": "other/2025/11/abc.webp",
  "trashPath": "/abs/path/storage/.trash/cmxxx/abc.webp",
  "originalVariants": { "thumb": "...", "medium": "..." },
  "trashVariants": { "thumb": "...", "medium": "..." }
}
```

### API синхронизации

**Actions для POST /api/admin/media/sync:**

| Action | Описание |
|--------|----------|
| `upload_to_s3_with_delete` | Выгрузить на S3 и удалить локальные |
| `upload_to_s3_keep_local` | Выгрузить на S3 без удаления локальных |
| `download_from_s3` | Загрузить из S3 в локальное хранилище |
| `download_from_s3_delete_s3` | Загрузить из S3 и удалить из S3 |
| `delete_local_only` | Удалить только локальные (синхронизированные) |
| `delete_s3_only` | Удалить только из S3 |

### Seed данные

| Сущность | Количество | Описание |
|----------|------------|----------|
| `MediaGlobalSettings` | 1 | Глобальные настройки (S3 bucket: `materio-bucket`) |
| `ImageSettings` | 9 | Пресеты для всех типов сущностей (включая `other`) |
| `Watermark` | 1 | Дефолтный водяной знак (placeholder) |

### Зависимости

```json
{
  "sharp": "^0.34.x",
  "@aws-sdk/client-s3": "^3.x"
}
```

### Пример использования

```typescript
import { getMediaService, getMediaSyncService } from '@/services/media'

// Загрузка изображения
// Автоматически: оригинал → 1920×1280, варианты по entityType
const mediaService = getMediaService()
const result = await mediaService.upload(buffer, 'photo.jpg', 'image/jpeg', {
  entityType: 'listing_image',
  entityId: 'listing-123',
  uploadedBy: 'user-456',
})

// Результат: original (1920×1280), large (1200×900), medium (600×450), thumb (150×150)

// Синхронизация на S3
const syncService = getMediaSyncService()
const job = await syncService.uploadToS3KeepLocal({
  scope: 'entity_type',
  entityType: 'listing_image',
  createdBy: 'admin-789',
})
```

### Модуль лицензий медиа (добавлено 2025-11-26)

Управление лицензиями на изображения и видео для фиксации правовой информации.

#### Модели данных

```prisma
model MediaLicense {
  id              String   @id @default(cuid())
  licenseType     String   // royalty_free, rights_managed, creative_commons, editorial, exclusive, custom
  licenseTypeName String?  // Название для custom типа
  licensorName    String   // Автор/правообладатель
  licensorEmail   String?
  licensorUrl     String?
  licenseeName    String   // Получатель лицензии
  licenseeEmail   String?
  documentPath    String?  // Путь к PDF/документу
  documentName    String?
  documentSize    Int?
  documentMime    String?
  validFrom       DateTime?
  validUntil      DateTime?
  territory       String?  // Территория действия
  usageRights     String?  // Права использования
  restrictions    String?  // Ограничения
  price           Decimal?
  currency        String?  @default("RUB")
  notes           String?
  uploadedBy      String?
  uploadedAt      DateTime @default(now())
  mediaItems      MediaLicenseItem[]
  @@map("media_licenses")
}

model MediaLicenseItem {
  id          String       @id @default(cuid())
  licenseId   String
  mediaId     String
  license     MediaLicense @relation(...)
  media       Media        @relation(...)
  @@unique([licenseId, mediaId])
  @@map("media_license_items")
}
```

#### API endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/admin/media/licenses` | Список с фильтрацией |
| POST | `/api/admin/media/licenses` | Создание |
| GET | `/api/admin/media/licenses/[id]` | Получение |
| PUT | `/api/admin/media/licenses/[id]` | Обновление |
| DELETE | `/api/admin/media/licenses/[id]` | Удаление |
| POST | `/api/admin/media/licenses/[id]/document` | Загрузка документа |
| GET | `/api/admin/media/licenses/[id]/document` | Скачивание документа |

#### UI страницы

| Страница | Путь | Компонент |
|----------|------|-----------|
| Список | `/admin/media/licenses` | `MediaLicenses.tsx` |
| Форма | `/admin/media/licenses/[id]` | `MediaLicenseForm.tsx` |

#### Типы лицензий

| Тип | Описание |
|-----|----------|
| `royalty_free` | Разовый платёж, неограниченное использование |
| `rights_managed` | Оплата за каждое использование |
| `creative_commons` | Свободная лицензия с условиями |
| `editorial` | Только редакционное использование |
| `exclusive` | Эксклюзивные права |
| `custom` | Пользовательский тип |

#### Хранение документов

Документы лицензий хранятся в: `public/uploads/licenses/`

Поддерживаемые форматы: PDF, JPG, PNG (до 10 MB)

---

## 📤 Массовая загрузка медиа (добавлено 2025-11-27)

### useBulkUpload Hook

Переиспользуемый хук для массовой загрузки файлов с прогрессом.

**Интегрирован в MediaLibrary (27.11.2025):**
- Полная поддержка Pause/Resume/Cancel/Retry
- Динамический entityType через `optionsRef`
- Отображение скорости загрузки и общего прогресса

```typescript
import { useBulkUpload } from '@/hooks'

const {
  files,      // QueuedFile[] - файлы в очереди
  stats,      // UploadStats - статистика (total, pending, success, error, speed, progress)
  isUploading,
  isPaused,
  addFiles,   // (files: File[]) => void
  removeFile, // (id: string) => void
  startUpload,
  pauseUpload,
  resumeUpload,
  cancelUpload,
  retryFailed,
  clearSuccess,
  clearQueue,
} = useBulkUpload({
  endpoint: '/api/admin/media',
  parallelLimit: 5,     // 5 параллельных загрузок
  maxFiles: 10000,      // Лимит файлов
  entityType: 'listing_image',
  onComplete: (stats) => {
    toast.success(`Загружено: ${stats.success}`)
    fetchMedia()
  },
})
```

### Опции хука

| Опция | Тип | По умолчанию | Описание |
|-------|-----|--------------|----------|
| `endpoint` | `string` | `/api/admin/media` | URL для загрузки |
| `useAsyncUpload` | `boolean` | `false` | Использовать Bull Queue |
| `parallelLimit` | `number` | `3` | Параллельных загрузок |
| `maxFiles` | `number` | `1000` | Макс. файлов в очереди |
| `maxFileSize` | `number` | `15MB` | Макс. размер файла |
| `entityType` | `string` | `other` | Тип сущности |
| `maxPreviews` | `number` | `20` | Превью для первых N файлов |
| `maxRetries` | `number` | `2` | Попыток retry |

### BulkUploadProgress Component

```tsx
import { BulkUploadProgress } from '@/components/media'

<BulkUploadProgress
  stats={stats}
  isUploading={isUploading}
  isPaused={isPaused}
  onStart={startUpload}
  onPause={pauseUpload}
  onResume={resumeUpload}
  onCancel={cancelUpload}
  onRetry={retryFailed}
  onClearSuccess={clearSuccess}
  onClearAll={clearQueue}
  compact={false}
/>
```

### Структура файлов

| Путь | Назначение |
|------|------------|
| `src/hooks/useBulkUpload.ts` | Хук для массовой загрузки |
| `src/hooks/index.ts` | Экспорты хуков |
| `src/components/media/BulkUploadProgress.tsx` | UI прогресса |
| `src/components/media/index.ts` | Экспорты компонентов |

---

## 🎨 Фоновые водяные знаки (добавлено 2025-11-27)

### Архитектура

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MediaProcessingWorker                             │
│                                                                     │
│  1. Обрабатывает изображение (resize, convert)                      │
│  2. Сохраняет варианты                                              │
│  3. Проверяет: shouldApplyWatermark(entityType)?                    │
│     - entityType === 'other' (медиатека) → НЕТ                      │
│     - settings.watermarkEnabled === true → ДА                        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Если ДА
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      WatermarkQueue (Bull)                           │
│                                                                     │
│  - Concurrency: 3                                                   │
│  - Attempts: 3 с exponential backoff                                │
│  - Retention: 24h completed, 7d failed                               │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      WatermarkWorker                                 │
│                                                                     │
│  1. Загружает настройки ImageSettings                               │
│  2. Определяет варианты: watermarkOnVariants (medium,large)         │
│  3. Для каждого варианта:                                           │
│     - Загружает изображение                                         │
│     - Применяет watermark с position/opacity/scale                   │
│     - Сохраняет обратно                                             │
│  4. Обновляет media.watermarkApplied                                │
└─────────────────────────────────────────────────────────────────────┘
```

### ImageSettings (prisma/schema.prisma)

| Поле | Тип | Описание |
|------|-----|----------|
| `watermarkEnabled` | `Boolean` | Включён ли водяной знак |
| `watermarkMediaId` | `String?` | ID Media с PNG водяного знака |
| `watermarkPosition` | `String?` | Позиция: `bottom-right`, `center`, etc. |
| `watermarkOpacity` | `Float` | Прозрачность: 0.0 - 1.0 |
| `watermarkScale` | `Float` | Размер относительно изображения |
| `watermarkOnVariants` | `String` | Варианты: `medium,large` |

### Логика применения

| entityType | Водяной знак | Причина |
|------------|:------------:|---------|
| `other` | ❌ | Медиатека (admin) |
| `watermark` | ❌ | Сами водяные знаки |
| `user_avatar` | ⚙️ | По настройкам |
| `listing_image` | ✅ | По настройкам (обычно включён) |
| `company_photo` | ✅ | По настройкам |

### Prometheus метрики

| Метрика | Тип | Описание |
|---------|-----|----------|
| `watermark_jobs_added_total` | Counter | Задач добавлено |
| `watermark_jobs_completed_total` | Counter | Завершено (success/failed) |
| `watermark_duration_seconds` | Histogram | Время применения |

### Структура файлов

| Путь | Назначение |
|------|------------|
| `src/services/media/queue/WatermarkQueue.ts` | Bull Queue |
| `src/services/media/queue/WatermarkWorker.ts` | Обработчик |
| `src/services/media/WatermarkService.ts` | Применение watermark |
| `src/lib/metrics/media.ts` | Prometheus метрики |

---

## 📊 Логи, Метрики, События (добавлено 2025-11-27)

### Покрытие компонентов

| Компонент | Logger | Metrics | Events |
|-----------|:------:|:-------:|:------:|
| `MediaService.ts` | ✅ | — | ✅ |
| `WatermarkQueue.ts` | ✅ | ✅ | — |
| `WatermarkWorker.ts` | ✅ | ✅ | ✅ |
| `MediaSyncQueue.ts` | ✅ | ✅ | — |
| `MediaSyncWorker.ts` | ✅ | ✅ | ✅ |
| `MediaSyncService.ts` | ✅ | (Queue) | — |
| `MediaProcessingQueue.ts` | ✅ | ✅ | — |
| `MediaProcessingWorker.ts` | ✅ | ✅ | — |

### Prometheus метрики (`src/lib/metrics/media.ts`)

| Метрика | Тип | Labels |
|---------|-----|--------|
| `watermark_jobs_added_total` | Counter | `entity_type` |
| `watermark_jobs_completed_total` | Counter | `status` |
| `watermark_duration_seconds` | Histogram | `entity_type` |
| `media_sync_jobs_added_total` | Counter | `operation`, `queue_type` |
| `media_sync_jobs_processed_total` | Counter | `operation`, `status` |
| `media_sync_duration_seconds` | Histogram | `operation` |
| `media_processing_jobs_added_total` | Counter | `entity_type`, `queue_type` |
| `media_processing_jobs_processed_total` | Counter | `entity_type`, `status` |
| `media_file_size_bytes` | Histogram | `entity_type` |

### EventService события

| Событие | Source | Severity | Где |
|---------|--------|----------|-----|
| `media.soft_deleted` | media | info | MediaService |
| `media.hard_deleted` | media | warning | MediaService, MediaSyncWorker |
| `media.restored` | media | info | MediaService |
| `media.watermark_applied` | media | info | WatermarkWorker |

---

## 🐛 Исправления (2025-11-27)

### Prometheus метрики media не экспортировались

**Проблема:** `src/lib/metrics/media.ts` использовал `prom-client` default `register` вместо `metricsRegistry`

**Исправление:**
- Изменён импорт на `metricsRegistry` из `./registry`
- Добавлен `registers: [metricsRegistry]` при создании метрик
- В `/api/metrics/route.ts` добавлен импорт `* as mediaMetrics`
- Теперь 12 media метрик доступны через `/api/metrics`

### useBulkUpload не использовался в MediaLibrary

**Проблема:** При загрузке файлов в MediaLibrary использовалась локальная реализация без Pause/Resume/Cancel

**Исправление:**
- Интегрирован `useBulkUpload` hook
- Добавлен `optionsRef` для динамического entityType
- UI обновлён: кнопки Пауза/Продолжить/Отмена/Повторить

### Исправлены ошибки S3 синхронизации

| Ошибка | Причина | Исправление |
|--------|---------|-------------|
| `getEventService is not exported` | Неверный импорт | Заменено на `eventService` |
| `storageService.syncToS3 is not a function` | `getStorageService()` возвращает Promise, вызывался без await | Добавлен `await getStorageService()` |
| Очередь не обрабатывает задачи | `initializeMediaQueues()` не вызывался в sync API | Добавлен вызов в `/api/admin/media/sync` |

### Затронутые файлы

- `src/services/media/queue/MediaSyncWorker.ts` — await для getStorageService, eventService импорт
- `src/services/media/queue/WatermarkWorker.ts` — eventService импорт  
- `src/services/media/queue/WatermarkQueue.ts` — переписан на bull (вместо bullmq)
- `src/services/media/MediaService.ts` — eventService импорт
- `src/app/api/admin/media/sync/route.ts` — добавлен initializeMediaQueues()

### Добавленные зависимости

```bash
pnpm add bullmq  # Для WatermarkQueue (позже переписан на bull)
```

---

## 🧪 Тесты медиа модуля (добавлено 2025-11-27)

### Созданные тестовые файлы

| Путь | Тесты | Покрытие |
|------|:-----:|----------|
| `tests/unit/media/queue/WatermarkQueue.test.ts` | 7 | WatermarkQueue |
| `tests/unit/media/queue/WatermarkWorker.test.ts` | 11 | WatermarkWorker |
| `tests/unit/hooks/useBulkUpload.test.ts` | 5 | useBulkUpload hook |
| `tests/unit/components/media/BulkUploadProgress.test.tsx` | 2 | BulkUploadProgress |
| `tests/unit/media/sync/MediaSyncService.test.ts` | 8 | Batch processing |
| `tests/unit/media/MediaService.delete.test.ts` | 9 | Soft/Hard delete |
| **Всего** | **42** | |

### Запуск тестов

```bash
# Все тесты медиа модуля
pnpm vitest run tests/unit/media tests/unit/hooks tests/unit/components

# Конкретный файл
pnpm vitest run tests/unit/media/queue/WatermarkQueue.test.ts
```

### Покрытие тестами

| Компонент | Unit | Integration |
|-----------|:----:|:-----------:|
| WatermarkQueue | ✅ | — |
| WatermarkWorker | ✅ | — |
| useBulkUpload | ✅ | — |
| BulkUploadProgress | ✅ | — |
| MediaSyncService (batch) | ✅ | — |
| MediaService (delete) | ✅ | — |

---

## 🚀 S3 Sync Batch Processing (добавлено 2025-11-27)

### Конфигурация

| Параметр | Значение | Описание |
|----------|:--------:|----------|
| `batchSize` | 100 | Файлов в одном batch |
| `minFilesForBatching` | 50 | Мин. файлов для batch режима |
| `parallelLimit` | 10 | Параллельных операций в batch |

### Архитектура Parent/Child Jobs

```
┌─────────────────────────────────────────────────────────────┐
│                      API Request                            │
│                  (1000 файлов для sync)                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              MediaSyncService.createSyncJob()               │
│                                                             │
│  1. Определяет кол-во файлов > 50 → batch mode              │
│  2. Создаёт Parent Job (isParent: true)                     │
│  3. Разбивает на batches по 100 файлов                      │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
     ┌─────────┐   ┌─────────┐   ┌─────────┐
     │ Child 1 │   │ Child 2 │   │ Child N │
     │ Batch 0 │   │ Batch 1 │   │ Batch N │
     │ 100 фай │   │ 100 фай │   │ ≤100 фай│
     └────┬────┘   └────┬────┘   └────┬────┘
          │              │              │
          ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                    MediaSyncQueue                           │
│                      (Bull Queue)                           │
│  - concurrency: 5                                           │
│  - attempts: 5 с exponential backoff                        │
│  - Redis-backed                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   MediaSyncWorker                           │
│                                                             │
│  - Обрабатывает каждый файл                                 │
│  - Обновляет прогресс в БД                                  │
│  - При завершении child → проверяет parent                  │
│  - Финализирует parent когда все children done              │
└─────────────────────────────────────────────────────────────┘
```

### Prisma Schema (MediaSyncJob)

```prisma
model MediaSyncJob {
  // ... existing fields ...
  
  // Parent/Child relationship
  isParent    Boolean        @default(false)
  parentJobId String?
  parentJob   MediaSyncJob?  @relation("ParentChild", ...)
  childJobs   MediaSyncJob[] @relation("ParentChild")
  
  // Batch info
  batchIndex  Int?           // 0, 1, 2, ...
  batchSize   Int?           // usually 100
}
```

### UI Progress

- **Таблица:** Показывает количество batch'ей для parent jobs
- **Детали:** Визуальная сетка прогресса batch'ей (зелёный/красный/синий/серый)

---

## 📊 Grafana Dashboard: Media Module (добавлено 2025-11-28)

### Файл
`monitoring/grafana/dashboards/media-dashboard.json`

### Структура дашборда

| Row | Панели | Метрики |
|-----|--------|---------|
| **Overview** | Upload Rate, Processing Rate, Success %, Queue Size | stat panels |
| **Async Upload** | Requests, Duration P50/P95/P99, File Size Distribution | timeseries, barchart |
| **Processing Queue** | Jobs Added, Duration by Entity, Success/Failed Pie | timeseries, piechart |
| **S3 Sync** | Jobs by Operation, Duration, Success/Failed | timeseries, piechart |
| **Watermarks** | Jobs Added, Duration, Success Rate | timeseries, piechart |
| **Health & Errors** | Queue Mode, Errors, Retries, Fallback Events | stat, timeseries |

### Ключевые панели

| Панель | Описание | Алерт |
|--------|----------|-------|
| Upload Rate | Загрузки в минуту | - |
| Success Rate | % успешных обработок | < 98% |
| Queue Size | Размер очереди ожидания | > 100 |
| Queue Mode | Bull vs In-Memory | In-Memory = ⚠️ |
| Fallback Events | Переключения на fallback | > 0 = ⚠️ |

### Визуализация метрик

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Media Module Dashboard                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [📤 Upload: 42/min] [⚙️ Processing: 38/min] [✅ 99.2%] [📋 5] │
│                                                                 │
│  ┌── Async Upload ──────────────────────────────────────────┐  │
│  │ [Rate Graph]    [P50: 120ms, P95: 450ms]   [Size Dist]   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌── Processing ────────────────────────────────────────────┐  │
│  │ [Jobs/min]      [Duration by type]     [🟢85% 🔴15%]     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌── S3 Sync ───────────────────────────────────────────────┐  │
│  │ [upload/download/delete] [Duration]    [Success Pie]     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌── Health ────────────────────────────────────────────────┐  │
│  │ [🟢 Bull]   [Errors: 0]   [Retries: 2]   [Fallback: 0]   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Доступ
- URL: `http://localhost:9091/d/media-module`
- Требуется запущенный Grafana в Docker

---

## 🔄 Redis Fallback для очередей (добавлено 2025-11-28)

### Архитектура Fallback

Все очереди медиа модуля имеют in-memory fallback при недоступности Redis:

```
┌─────────────────────────────────────────────────────────────┐
│                       Queue Request                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              serviceConfigResolver.getConfig('redis')       │
│                                                             │
│    Redis URL есть и подключение успешно?                   │
│                                                             │
│    ДА → Bull Queue (Redis)                                 │
│         • Персистентность задач                            │
│         • Event handlers (waiting, completed, failed)       │
│         • Мониторинг в Bull Board                          │
│         • Метрики Prometheus (queue_type: 'bull')          │
│                                                             │
│    НЕТ → In-Memory Fallback                                │
│         • Массив inMemoryQueue[]                           │
│         • Обработка каждые 5 секунд (setInterval)          │
│         • Retry с exponential backoff                       │
│         • Метрики Prometheus (queue_type: 'in-memory')     │
│         • Логирование: warn при переключении               │
└─────────────────────────────────────────────────────────────┘
```

### Поддерживаемые очереди

| Очередь | Bull | In-Memory | Auto-switch | Retry |
|---------|:----:|:---------:|:-----------:|:-----:|
| `MediaProcessingQueue` | ✅ | ✅ | ✅ | 3 попытки |
| `MediaSyncQueue` | ✅ | ✅ | ✅ | 5 попыток |
| `WatermarkQueue` | ✅ | ✅ | ✅ | 3 попытки |
| `NotificationQueue` | ✅ | ✅ | ✅ | 3 попытки |

### Автоматическое переключение

```typescript
// При инициализации (Redis недоступен)
if (!redisConfig.url) {
  logger.warn('[Queue] Redis not configured, using in-memory fallback')
  this.queueAvailable = false
  return
}

// При ошибке Redis (runtime)
this.queue.on('error', (error) => {
  logger.error('[Queue] Redis error', { error })
  markQueueSwitch('bull', 'in-memory')
  this.queueAvailable = false
})

// При добавлении задачи
async add(data) {
  if (this.queueAvailable && this.queue) {
    try {
      return await this.queue.add(data)
    } catch (error) {
      // Переключаемся на fallback
      markQueueSwitch('bull', 'in-memory')
      this.queueAvailable = false
    }
  }
  // In-memory fallback
  this.inMemoryQueue.push(newJob)
  return { id: jobId, type: 'in-memory' }
}
```

### In-Memory обработчик

```typescript
// Проверка каждые 5 секунд
private startInMemoryProcessor(): void {
  this.inMemoryProcessor = setInterval(async () => {
    if (this.queueAvailable) return // Bull работает
    if (!this.processor) return      // Нет обработчика
    
    const pendingJobs = this.inMemoryQueue.filter(
      job => job.status === 'pending' && job.scheduledAt <= now
    )
    
    for (const job of pendingJobs) {
      job.status = 'processing'
      try {
        const result = await this.processor(mockJob)
        job.status = 'completed'
      } catch (error) {
        job.attempts++
        if (job.attempts >= maxAttempts) {
          job.status = 'failed'
        } else {
          job.status = 'pending' // Retry
          job.scheduledAt = new Date(Date.now() + backoffDelay)
        }
      }
    }
  }, 5000)
}
```

### Prometheus метрики

| Метрика | Labels | Описание |
|---------|--------|----------|
| `media_processing_queue_size` | `status`, `queue_type` | Размер очереди |
| `media_queue_switch_total` | `from`, `to` | Переключения между режимами |
| `media_processing_jobs_added_total` | `entity_type`, `queue_type` | Добавленные задачи |

### Логирование

```
# При недоступности Redis
warn: [MediaProcessingQueue] Redis not configured, using in-memory fallback
warn: [MediaSyncQueue] Failed to initialize Bull queue, using in-memory fallback

# При переключении (runtime error)
error: [MediaProcessingQueue:Bull] Queue error { error: "Connection refused" }
warn: [MediaProcessingQueue] Switching to in-memory fallback

# При работе in-memory
info: [MediaProcessingQueue:InMemory] Job added { jobId, entityType }
info: [MediaProcessingQueue:InMemory] Job completed { jobId }
warn: [MediaProcessingQueue:InMemory] Job retry scheduled { jobId, attempt }
error: [MediaProcessingQueue:InMemory] Job failed after max attempts { jobId }
```

### Ограничения In-Memory режима

| Аспект | Bull (Redis) | In-Memory |
|--------|:------------:|:---------:|
| Персистентность | ✅ | ❌ (теряется при рестарте) |
| Кластеризация | ✅ | ❌ |
| Bull Board UI | ✅ | ❌ |
| Задержки (delay) | ✅ | ✅ |
| Retry | ✅ | ✅ |
| Метрики | ✅ | ✅ |

### Рекомендации

- **Production:** Обязательно Redis (персистентность, масштабирование)
- **Development:** In-memory достаточен для тестирования
- **Staging:** Redis для тестирования полного функционала

---

## ⚡ Async Upload улучшения (добавлено 2025-11-28)

### Проблемы и решения

| Проблема | Решение |
|----------|---------|
| `Cannot define the same handler twice` | Promise-based lock в `initializeMediaQueues()` |
| `isS3Configured is not a function` | Добавлен экспорт функции в `storage/index.ts` |
| `preset.allowedMimeTypes.join is not a function` | Убран `.join()` в `settings.ts` (уже строка) |
| S3 sync забивает очередь при отключённом S3 | Проверка `isS3Configured()` перед созданием sync job |
| Медленная обработка | Увеличена concurrency с 3 до 5 workers |

### Архитектура async upload

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Клиент отправляет файл (5 параллельных потоков)          │
│    ↓                                                        │
│ 2. API сохраняет в temp (~50ms)                            │
│    ↓                                                        │
│ 3. Задача в Bull Queue                                      │
│    ↓                                                        │
│ 4. Ответ клиенту с tempPreview.url (мгновенно)             │
│    ↓                                                        │
│ 5. MediaProcessingWorker обрабатывает (5 параллельно)      │
│    ↓                                                        │
│ 6. WebSocket уведомление о завершении                       │
└─────────────────────────────────────────────────────────────┘
```

### Response API `/api/admin/media/upload-async`

```json
{
  "success": true,
  "status": "processing",
  "jobId": "123",
  "tempPreview": {
    "url": "/uploads/temp/1234_abc_photo.jpg",
    "filename": "photo.jpg",
    "size": 2048000,
    "mimeType": "image/jpeg"
  }
}
```

### Затронутые файлы

| Файл | Изменения |
|------|-----------|
| `src/app/api/admin/media/upload-async/route.ts` | tempPreview в response |
| `src/services/media/queue/index.ts` | Promise-based lock |
| `src/services/media/queue/MediaProcessingQueue.ts` | concurrency: 5, processorRegistered flag |
| `src/services/media/queue/MediaSyncQueue.ts` | processorRegistered flag |
| `src/services/media/queue/MediaProcessingWorker.ts` | isS3Configured check |
| `src/services/media/storage/StorageService.ts` | isS3Configured function |
| `src/services/media/storage/index.ts` | export isS3Configured |
| `src/services/media/settings.ts` | fix allowedMimeTypes |

### Метрики Prometheus

| Метрика | Тип | Описание |
|---------|-----|----------|
| `media_async_upload_requests_total` | Counter | Всего async upload запросов |
| `media_async_upload_duration_seconds` | Histogram | Длительность async upload |

### Результаты тестирования (1361 файл)

| Метрика | Значение |
|---------|----------|
| Загружено | 1361 |
| Успешно обработано | 1358 (99.78%) |
| В корзине | 0 |
| Потеряно | 3 |

---

## 📷 Модуль "Медиатека UI" (обновлено 2025-11-27)

### Адаптивная сетка

| Breakpoint | Колонки |
|------------|:-------:|
| xs (mobile) | 2 |
| sm | 3 |
| md | 4 |
| lg | 5 |
| xl (desktop) | 6 |

### Индикаторы хранилища

В заголовке медиатеки отображаются Chip-индикаторы:

| Индикатор | Цвет | Условие |
|-----------|------|---------|
| 💾 Local | warning (оранжевый) | Всегда (локальное хранилище) |
| ☁️ S3 | success (зелёный) | Если S3 сервис enabled |

```tsx
<Chip label="Local" size="small" color="warning" icon={...} />
<Chip label="S3" size="small" color="success" icon={...} />
```

### Корзина (Trash)

| Элемент | Описание |
|---------|----------|
| Табы | "Все файлы" / "Корзина" |
| Бейдж | Chip с количеством удалённых файлов |
| Bulk actions | "В корзину", "Удалить навсегда", "Восстановить" |

---

## 🗑️ Модуль "Режимы удаления медиа" (добавлено 2025-11-27)

### Режимы удаления

| Режим | Local | S3 | Корзина | Восстановление |
|-------|:-----:|:--:|:-------:|:--------------:|
| **Soft delete** | 📁 Остаётся | ☁️ Остаётся | ✅ Да | ✅ Можно |
| **Hard delete** | 🗑️ Удаляется | 🗑️ Удаляется | ❌ Нет | ❌ Нельзя |

### Структура файлов

| Путь | Назначение |
|------|------------|
| `src/views/admin/media/MediaLibrary.tsx` | UI табов "Все файлы" / "Корзина" |
| `src/views/admin/media/MediaSettings.tsx` | UI настроек удаления |
| `src/app/api/admin/media/[id]/route.ts` | DELETE `?hard=true` для hard delete |
| `src/app/api/admin/media/[id]/restore/route.ts` | POST для восстановления |
| `src/services/media/MediaService.ts` | `delete(id, hard)`, `restore(id)` |
| `src/services/media/jobs/MediaCleanupJob.ts` | Авто-очистка корзины |

### API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/admin/media?deleted=false` | GET | Только активные файлы |
| `/api/admin/media?deleted=true` | GET | Только удалённые (корзина) |
| `/api/admin/media/[id]` | DELETE | Soft delete (в корзину) |
| `/api/admin/media/[id]?hard=true` | DELETE | Hard delete (навсегда) |
| `/api/admin/media/[id]/restore` | POST | Восстановить из корзины |

### UI в медиатеке

```
┌─────────────────────────────────────────────────────────────────┐
│  📁 Медиатека                                    [Загрузить]    │
├─────────────────────────────────────────────────────────────────┤
│  [Все файлы (21)]  [🗑️ Корзина (78)]                            │
├─────────────────────────────────────────────────────────────────┤
│  Grid / List View                                               │
└─────────────────────────────────────────────────────────────────┘
```

**В табе "Все файлы":**
- Dropdown при удалении: "В корзину" / "Удалить навсегда"
- Bulk actions: "В корзину", "Удалить навсегда"

**В табе "Корзина":**
- Кнопки: "Восстановить", "Удалить навсегда"
- Bulk actions: "Восстановить все", "Удалить навсегда"

### Настройки в MediaSettings

| Настройка | Описание | По умолчанию |
|-----------|----------|--------------|
| `deleteMode` | Режим по умолчанию | `soft` |
| `softDeleteRetentionDays` | Дней до авто hard delete | `30` |
| `autoCleanupEnabled` | Авто-очистка корзины | `true` |
| `s3DeleteWithLocal` | Удалять S3 при hard delete | `true` |

### MediaCleanupJob

Ночной cron-job (рекомендуется `0 3 * * *`):
1. Проверяет `autoCleanupEnabled`
2. Находит файлы с `deletedAt < now - softDeleteRetentionDays`
3. Ставит `hard_delete` задачи в `mediaSyncQueue`

```typescript
import { runMediaCleanup } from '@/services/media/jobs/MediaCleanupJob'

// Dry run — показать что будет удалено
const result = await runMediaCleanup(true)

// Реальная очистка
const result = await runMediaCleanup(false)
```

---

## 🔄 Модуль "S3 Синхронизация медиа" (обновлено 2025-11-27)

### Исправления S3 подключения

| Проблема | Решение |
|----------|---------|
| `eventService.emit is not a function` | Заменено на `eventService.record()` в 8 файлах |
| `ENCRYPTION_KEY` непонятное имя | Переименовано в `CREDENTIALS_ENCRYPTION_KEY` |
| Неправильный пароль MinIO | `minioadmin` → `minioadmin123` в seed.ts |
| Неправильный протокол | `http://` → `http` (убрана дублирующая `://`) |
| Неправильный bucket | `test-bucket` → `materio-bucket` |
| Ошибка расшифровки | `decrypt()` → `safeDecrypt()` в StorageService |

### Управление S3 Buckets — обновлено 2025-11-29

| Method | Endpoint | Описание | Права |
|--------|----------|----------|-------|
| `GET` | `/api/admin/media/s3/buckets` | Список buckets | isSuperadmin |
| `POST` | `/api/admin/media/s3/buckets` | Создать bucket | isSuperadmin |
| `POST` | `/api/admin/media/s3/buckets/validate` | Проверить bucket | isSuperadmin |

**UI в MediaSettings:**
- Select dropdown со списком buckets
- Кнопка обновления списка
- Кнопка создания нового bucket
- Чип статуса: "✅ Bucket доступен" / "❌ Bucket недоступен"

### Структура файлов синхронизации

| Путь | Назначение |
|------|------------|
| `src/services/media/sync/MediaSyncService.ts` | Сервис синхронизации (upload, download, verify) |
| `src/services/media/storage/StorageService.ts` | Абстракция хранилища (Local + S3 + Trash) |
| `src/services/media/storage/S3Adapter.ts` | Адаптер для AWS S3 / MinIO + buckets API |
| `src/services/media/storage/LocalAdapter.ts` | Адаптер для локального хранилища + move() |
| `src/app/api/admin/media/sync/route.ts` | API синхронизации |
| `src/app/api/admin/media/s3/buckets/route.ts` | API управления buckets |
| `src/app/api/admin/media/[id]/trash/route.ts` | API файлов из корзины |
| `src/views/admin/media/MediaSync.tsx` | UI управления синхронизацией |
| `src/views/admin/media/MediaDetailSidebar.tsx` | Боковая панель с кнопками синхронизации |
| `storage/.trash/` | Директория корзины (вне public/) |

### Операции синхронизации

| Действие | API action | Описание |
|----------|------------|----------|
| Выгрузить на S3 | `upload_to_s3_keep_local` | Копирует на S3, оставляет локально |
| Выгрузить и удалить | `upload_to_s3_with_delete` | Перемещает на S3 |
| Загрузить из S3 | `download_from_s3` | Скачивает локально |
| Проверить статусы | `verify_status` | Сверяет БД с реальностью S3 |

### Статусы хранения

| storageStatus | Отображение | Описание |
|---------------|-------------|----------|
| `local_only` | Только локально | Файл только на диске |
| `s3_only` | Только S3 | Файл только в облаке |
| `synced` | S3 + Локально | Файл в обоих местах |

### Улучшения синхронизации — 2025-11-29

| Улучшение | Описание |
|-----------|----------|
| **Атомарные инкременты** | Использование `{ increment: 1 }` вместо `++` для предотвращения race conditions |
| **Параллельное добавление в очередь** | `Promise.all` вместо последовательного `for...of` |
| **S3 Bucket в задаче** | Каждая задача сохраняет bucket для отслеживания |
| **Автор задачи** | `createdBy` + кликабельная ссылка на профиль |
| **MUI Dialog** | Замена `window.confirm` на современные диалоги |
| **Reset singleton** | `resetStorageService()` при изменении настроек |
| `sync_error` | Ошибка синхр. | Проблема синхронизации |
| `sync_pending` | Ожидает синхр. | В очереди |

### Параметр overwrite

При `overwrite: true` — перезаписывает файлы на S3, даже если они уже синхронизированы.
Используется кнопкой "Перезалить" для восстановления удалённых с S3 файлов.

### Верификация статусов (verify_status)

Проверяет реальное наличие файлов:
1. Проверяет `localPath` через `LocalAdapter.exists()`
2. Проверяет `s3Key` через `S3Adapter.exists()`
3. Обновляет `storageStatus` в БД согласно реальности
4. Очищает `s3Key` если файла нет на S3

### Шифрование credentials

| Переменная | Назначение |
|------------|------------|
| `CREDENTIALS_ENCRYPTION_KEY` | 64-символьный hex ключ для AES-256-GCM |

**Генерация ключа:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Функции шифрования (`src/lib/config/encryption.ts`):**
- `encrypt(plaintext)` — шифрует, требует ключ
- `decrypt(ciphertext)` — расшифровывает, требует ключ
- `safeDecrypt(text)` — расшифровывает или возвращает plaintext
- `isEncryptionAvailable()` — проверяет наличие ключа

---

## 📝 Конфигурация .env (обновлено 2025-11-28)

Все настройки серверов централизованы в `.env` файле.

### Серверы подключения

| Сервис | Переменные | Порт |
|--------|------------|------|
| **PostgreSQL** | `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD` | 5432 |
| **Redis** | `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT` | 6379 |
| **S3/MinIO** | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET` | 9000 |

### Мониторинг

| Сервис | Переменные | Credentials |
|--------|------------|-------------|
| **Grafana** | `GRAFANA_URL`, `GRAFANA_USER`, `GRAFANA_PASSWORD` | `admin/admin` |
| **Prometheus** | `PROMETHEUS_URL` | — |
| **Loki** | `LOKI_URL` | — |
| **Bull Board** | `BULL_BOARD_URL` | — |

### Приоритет S3 конфигурации

```
.env (S3_ENDPOINT, S3_ACCESS_KEY...) → приоритет
         ↓ если пусто
Admin Panel (БД) → fallback
```

### Защита для Production

Раскомментировать в `.env`:
```env
REDIS_PASSWORD=your-secure-password
PROMETHEUS_USER=admin
PROMETHEUS_PASSWORD=your-secure-password
GRAFANA_PASSWORD=strong-password  # Изменить с 'admin'
```

### Docker синхронизация

Docker Compose читает credentials из `.env`:
```yaml
# docker-compose.dev.yml
grafana:
  environment:
    - GF_SECURITY_ADMIN_USER=${GRAFANA_USER:-admin}
    - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}
```

---

## 🐳 Docker Development Environment (обновлено 2025-11-28)

### Unified docker-compose.dev.yml

Один файл `docker-compose.dev.yml` объединяет все сервисы для разработки:

| Сервис | Порт | Описание |
|--------|------|----------|
| Redis | 6379 | Кэш, сессии, очереди |
| Bull Board | 3030 | UI мониторинга очередей |
| Prometheus | 9090 | Сбор метрик |
| Grafana | 9091 | Визуализация (admin/admin) |
| Loki | 3100 | Агрегация логов |
| Promtail | — | Сборщик логов |
| MinIO (S3) | 9000, 9001 | Объектное хранилище |

### NPM скрипты (упрощённые)

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Базовый Next.js (без Docker) |
| `pnpm dev:socket` | Next.js + WebSocket сервер |
| `pnpm dev:full` | **Всё!** PostgreSQL + Redis + MinIO + WebSocket |
| `pnpm docker:up` | Запустить все Docker сервисы |
| `pnpm docker:down` | Остановить все Docker сервисы |
| `pnpm docker:logs` | Логи всех сервисов |

### Быстрый старт

```bash
# Первоначальная настройка (один раз)
pnpm pg:setup

# Рекомендуемый способ разработки
pnpm dev:full
```

---

## 🐘 PostgreSQL

PostgreSQL — основная база данных проекта.

### NPM скрипты PostgreSQL

| Команда | Описание |
|---------|----------|
| `pnpm pg:up` | Запустить PostgreSQL контейнер |
| `pnpm pg:down` | Остановить PostgreSQL |
| `pnpm pg:setup` | Полная настройка (schema + seed) |
| `pnpm pg:psql` | Консоль psql |
| `pnpm pg:studio` | Prisma Studio |

### Документация

| Документ | Ссылка |
|----------|--------|
| README | `postgresql/README.md` |
| Миграция PostgreSQL | `docs/reports/migrations/report-postgresql-migration-2025-11-28.md` |
| Обновление .env | `docs/reports/migrations/report-env-configuration-update-2025-11-28.md` |

---

## 🎯 Быстрая навигация

- **Найти документацию** → `README.md`
- **Создать документ** → `DOCUMENTATION_STANDARDS.md` (шаблоны)
- **Проверить статусы** → `STATUS_INDEX.md`
- **Для AI** → `AI_WORKFLOW_GUIDE.md`, `AI_MODULE_STANDARDS.md`
- **Быстрый справочник** → `QUICK_START.md`
- **⚠️ Координация агентов** → `coordination/agent-coordination-2025-11-24.md` (ВАЖНО: проверьте перед началом работы!)
