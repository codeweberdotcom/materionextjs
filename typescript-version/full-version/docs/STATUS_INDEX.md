# Индекс статусов документации

Этот документ отслеживает статус всех ТЗ, планов, анализов и отчетов для быстрого понимания текущего состояния проекта.

**Последнее обновление:** 2026-03-16 (Login: исправлен редирект после логина — теперь применяется текущая локаль)

---

## 🤖 Инструкция для AI

**Важно для AI-ассистентов:** При работе с внедрением новых функций или доработками, обязательно следуйте инструкции:

👉 **[Инструкция для AI: Работа с внедрением новых функций и доработками](AI_WORKFLOW_GUIDE.md)**

Эта инструкция описывает четкий процесс работы:
1. **АНАЛИЗ** → 2. **ПЛАН** → 3. **РЕАЛИЗАЦИЯ** → 4. **ОТЧЕТ** → 5. **ДОКУМЕНТАЦИЯ**

---

---

## 📌 Важно

Все документы должны обновляться при изменении статуса:
- При создании нового документа → добавить в соответствующий раздел
- При изменении статуса → переместить между разделами
- При завершении → переместить в "Завершено" и обновить статистику

---

## 📋 В планах

### Технические задания

- Нет активных ТЗ

### Планы работ

- [План: Регистрация и вход через Yandex ID](plans/active/plan-auth-yandex-oauth-2026-03-16.md) ⏳ (Планируется 2026-03-16 — 5 этапов: schema, env, backend routes, i18n, UI)
- [План: Редирект после логина — применять текущую локаль](plans/active/plan-login-locale-redirect-2026-03-16.md) ✅ (Завершено 2026-03-16 — Login.tsx: срезать locale-префикс из redirectTo)
- [План: Forgot/Reset Password](plans/active/plan-forgot-password-implementation-2026-03-16.md) ✅ (Завершено 2026-03-16 — все 5 этапов выполнены)
- [План: Доработка модуля SMS.ru](plans/active/plan-sms-ru-improvements-2026-03-16.md) ✅ (Завершено 2026-03-16 — все 6 этапов: gitignore, smsManagement permissions, audit events, метрики, типизация, i18n)

- [План: Улучшение схемы модели Event](plans/active/plan-events-schema-improvement-2026-03-15.md) ✅ (Завершено 2026-03-16 — payload/metadata→Json, ip поле, убрана ручная сериализация)
- [План: Добавление недостающего event logging](plans/active/plan-missing-event-logging-2026-03-16.md) ✅ (Завершено 2026-03-16 — 30 операций в 24 файлах, 5 фаз)
- [Анализ: Незалогированные операции в системе событий](analysis/architecture/analysis-missing-event-logging-2026-03-16.md) ✅ (Завершён — 30 операций в 22 файлах по 4 приоритетам)
- [План: Интеграционный тест параллельных bulk-операций](plans/active/plan-bulk-concurrent-integration-2026-03-15.md) ✅ (Завершено 2026-03-15 — 3 теста, без дедлоков)
- [План: Тестовое покрытие Import/Bulk Operations](plans/active/plan-test-coverage-import-bulk-2026-03-15.md) ✅ (Завершено 2026-03-15 — +83 теста, 804 unit-тестов)
- [План: withApiHandler — унификация API routes](plans/active/plan-api-handler-wrapper-2026-03-15.md) ✅ (Завершено 2026-03-15 — 183 routes мигрированы, 3 нестандартных оставлены)
- [План: Динамическая система языков (i18n)](plans/active/plan-i18n-dynamic-languages-2026-03-14.md) ✅ (Завершено 2026-03-14)
- [План: Рефакторинг WebSocket на standalone архитектуру](plans/active/plan-websocket-standalone-refactor-2025-12-02.md) ✅ (Завершено 2025-12-03)
- [План: Настройки синхронизации медиа с S3](plans/active/plan-media-s3-sync-settings-2025-11-30.md) ⏳ (Согласовано, готов к реализации)
- [План реализации модуля сценариев уведомлений](plans/active/plan-notification-scenarios-module-2025-01-24.md) ⏳ (В работе, ~75% - Этапы 1-4 завершены)
- [План реализации модуля конфигурации внешних сервисов](plans/active/plan-service-configuration-module-2025-11-25.md) ⏳ (В работе, ~80% - Этапы 1-8 завершены)

---

## 🔄 В работе

### Технические задания
- Нет ТЗ в работе

### Планы работ
- [План: PostgreSQL Docker Setup](plans/active/plan-postgresql-docker-setup-2025-11-28.md) ✅ (Завершено 2025-11-28)
- [План: Медиатека — Удаление, S3 Sync, Массовая загрузка, Тесты](plans/completed/plan-media-delete-modes-2025-11-27.md) ✅ (Завершено 100%, bugfixes 2025-11-27)
- [План доработок модуля RateLimit](plans/active/ratelimit-improvements-plan.md) ⏳ (Активный, готовность ~98%)
- [План реализации E2E тестов для Rate Limit](plans/active/plan-rate-limit-e2e-tests-2025-11-23.md) ⏳ (В работе, ~75%)
- [План улучшений модуля Импорта/Экспорта](plans/active/plan-import-export-improvements-2025-01-24.md) ⏳ (В работе, ~25%)
- [План улучшения E2E тестов - создание пользователей через API](plans/active/plan-e2e-test-improvements-user-creation-2025-01-24.md) ✅ (Завершено 2025-01-24 — все 8 этапов выполнены)
- [План тестового покрытия модуля User](plans/active/plan-user-module-test-coverage-2025-11-24.md) ⏳ (В работе, ~95% - тесты созданы, требуется запуск E2E)
- [Оставшиеся задачи для модуля User](plans/active/plan-user-module-remaining-tasks-2025-11-24.md) ⏳ (В работе, ~50% - DTO/валидаторы завершены, остались bulk-операции)
- [План рефакторинга модуля массовых операций](plans/active/plan-bulk-operations-refactoring-2025-11-24.md) ✅ (Завершен, ~98% - Этапы 1-2 выполнены, все тесты созданы, метрики и события подключены, оптимизация для больших объемов, тесты производительности)
- [План рефакторинга регистрации пользователей](plans/active/plan-user-registration-refactoring-2025-11-24.md) ⏳ (Планируется, ~0%)
- [План рефакторинга модуля Socket](plans/active/plan-socket-refactoring-2025-01-24.md) ⏳ (Планируется, ~0%)
- [План реализации модуля сценариев уведомлений](plans/active/plan-notification-scenarios-module-2025-01-24.md) ⏳ (Планируется, ~0%)

### Анализы

- [Анализ: Регистрация и вход через Yandex ID](analysis/architecture/analysis-auth-yandex-oauth-2026-03-16.md) ✅ (Завершён 2026-03-16 — Account модель готова, нужны nullable password + 2 API routes + UI кнопки + i18n)
- [Анализ: Реализация Forgot/Reset Password](analysis/architecture/analysis-forgot-password-implementation-2026-03-16.md) ✅ (Завершён 2026-03-16 — инфраструктура готова, нужны 2 API routes + 1 страница + обновить 2 компонента + i18n)
- [Анализ модуля SMS.ru](analysis/architecture/analysis-sms-ru-module-2026-03-16.md) ✅ (Завершён 2026-03-16 — 10 проблем: 1 критическая, 3 высоких, 4 средних, 2 низких)
- [Анализ: Улучшение схемы и формата Event](analysis/architecture/analysis-events-schema-improvement-2026-03-15.md) ✅ (Завершен 2026-03-15)
- [Анализ: Параллельные bulk-операции — интеграционный тест](analysis/architecture/analysis-bulk-concurrent-integration-2026-03-15.md) ✅ (Завершен 2026-03-15)
- [Анализ: Тестовое покрытие Import/Bulk Operations](analysis/architecture/analysis-test-coverage-import-bulk-2026-03-15.md) ✅ (Завершен 2026-03-15)
- [Сводный анализ архитектуры (верифицированный)](analysis/architecture/analysis-consolidated-architecture-review-2026-03-15.md) ✅ (Завершен 2026-03-15 — ревизия 39 анализов, 12 удалено, 9 архивировано)
- [Анализ: Рефакторинг bulk-операций справочников](analysis/architecture/analysis-bulk-references-refactoring-2026-03-15.md) ✅ (Завершен 2026-03-15)
- [Анализ: Прямой доступ к S3 в медиатеке](analysis/architecture/analysis-media-s3-direct-access-2025-12-01.md) ⏳ (Требует перепроверки)
- [Анализ: Настройки синхронизации медиа с S3](analysis/architecture/analysis-media-s3-sync-settings-2025-11-30.md) ⏳ (Требует перепроверки)
- [Анализ SQLite ограничений для миграции на PostgreSQL](analysis/architecture/analysis-sqlite-limitations-for-postgresql-migration-2025-11-28.md) ⏳ (Roadmap)
- [Анализ модуля массовых операций](analysis/architecture/analysis-bulk-operations-module-2025-11-24.md) ⏳ (Частично реализовано)
- [Анализ рефакторинга регистрации пользователей](analysis/architecture/analysis-user-registration-refactoring-2025-11-24.md) ⏳ (Roadmap — бизнес-решение)
- [Анализ модуля сценариев уведомлений](analysis/architecture/analysis-notification-scenarios-module-2025-01-24.md) ⏳ (Roadmap — бизнес-решение)

---

## ✅ Завершено

### Технические задания
- Нет завершенных ТЗ

### Планы работ
- [План: Рефакторинг bulk-операций справочников](plans/completed/plan-bulk-references-refactoring-2026-03-15.md) ✅ (Завершен 2026-03-15)
- [План: Рефакторинг WebSocket на standalone архитектуру](plans/active/plan-websocket-standalone-refactor-2025-12-02.md) ✅ (Завершен 2025-12-03)
- [План: Прямой доступ к S3 в медиатеке](plans/completed/plan-media-s3-direct-access-2025-12-01.md) ✅ (Завершен 2025-12-01)
- [План реализации модуля лицензий медиа](plans/completed/plan-media-licenses-module-2025-11-26.md) ✅ (Завершен 2025-11-26)
- [План улучшений медиатеки](plans/completed/plan-media-library-improvements-2025-11-26.md) ✅ (Завершен 2025-11-26)
- [План интеграции Bull Queue с Media](plans/completed/plan-media-bull-queue-integration-2025-11-26.md) ✅ (Завершен 2025-11-26)
- [План улучшений модуля Event](plans/completed/plan-event-module-improvements-2025-01-24.md) ✅ (Завершен 2025-01-24)
- [План внедрения тестов для экспорта/импорта](plans/completed/testing-plan-export-import.md) ✅
- [План интеграции Events](plans/completed/events-integration-plan-export-import.md) ✅
- [План реализации инструмента импорта/экспорта](plans/completed/import-export-tool-plan.md) ✅
- [План исправления Redis connection race condition](plans/completed/plan-fix-redis-connection-race-2025-11-23.md) ✅
- [План миграции Tailwind CSS → MUI](plans/roadmap/tailwind-to-mui-migration-plan.md) ⚠️ (В roadmap - миграция не требуется, Tailwind часть оригинального шаблона)
- [План: useFormMedia - хук для форм объявлений](plans/roadmap/plan-use-form-media-hook-2025-11-28.md) 📋 (В roadmap - ожидает готовности UI)
- [Roadmap: Интеграция RulesEngine с RateLimitService](plans/roadmap/plan-rules-engine-ratelimit-integration-roadmap.md) 📋 (В roadmap — связать два параллельных инструмента защиты через события)
- [Roadmap: Верификация личности через внешних провайдеров](plans/roadmap/plan-identity-verification-providers-roadmap.md) 📋 (В roadmap — Госуслуги/Сбер ID/Яндекс ID для автоматической верификации документов)
- [План: Bull Queue Docker Setup](plans/active/plan-bull-queue-docker-setup-2025-11-25.md) ✅ (Завершен 2025-11-25)
- [План: S3/MinIO Docker Setup](plans/completed/plan-s3-minio-docker-setup-2025-11-26.md) ✅ (Завершен 2025-11-26)
- [План улучшений модуля "Роли пользователей"](plans/completed/plan-roles-module-improvements-2025-01-24.md) ✅ (Завершён 2025-11-25)
- [План рефакторинга ролей для переименования](plans/completed/plan-roles-renaming-refactoring-2025-11-25.md) ✅ (Завершён 2025-11-25)
- [План: Множественные формы (Pluralization) для модуля переводов](plans/completed/plan-translations-module-pluralization-2025-01-24.md) ✅ (Завершён 2025-01-24)
- [План реализации системы аккаунтов пользователей](plans/active/plan-user-accounts-system-2025-01-25.md) ✅ (Завершён 2025-11-26)

### Анализы

- [Анализ: Динамическая система языков (i18n)](analysis/i18n-dynamic-languages-analysis-2026-03-14.md) ✅ (2026-03-14)
- [Анализ Socket.IO архитектуры](analysis/socket-io-analysis.md) ✅ (Обновлён 2025-12-03)
- [Рекомендации по типам (Junie)](analysis/architecture/junie_type_recomendation.md) ✅ (203 `as any` — подтверждено)
- [Анализ модуля Импорта/Экспорта](analysis/architecture/analysis-import-export-module-2025-01-24.md) ✅
- [Анализ модуля Event](analysis/architecture/analysis-event-module-2025-01-24.md) ✅
- [Анализ модуля "Роли пользователей"](analysis/architecture/analysis-roles-module-2025-01-24.md) ✅
- [Анализ модуля Email Templates](analysis/email-templates-module-analysis.md) ✅
- [Анализ: Grafana Dashboard для Bull/Notifications](analysis/monitoring/analysis-bull-grafana-dashboard-2025-11-26.md) ✅
- [Анализ: Недостающие метрики и дашборды Grafana](analysis/monitoring/analysis-missing-grafana-dashboards-2025-11-26.md) ✅
- 9 архивированных анализов в [analysis/architecture/archived/](analysis/architecture/archived/) (реализованы)

### Планы (активные)

- [План: Расширение метрик и дашбордов Grafana](plans/active/plan-grafana-dashboards-extension-2025-11-26.md) ✅ (завершён)

### Отчеты

- [Отчёт: Rate Limits — метка источника авто-блоков + детали блокировки](reports/improve/report-rate-limits-block-source-label-2026-03-16.md) ✅ (Завершен 2026-03-16 — Авто/Ручная, тип цели, email/IP, конфиг лимита)
- [Отчёт: Forgot/Reset Password — полная реализация](reports/improve/report-forgot-password-implementation-2026-03-16.md) ✅ (Завершен 2026-03-16 — 2 API routes, 2 компонента, i18n, rate limit, events)
- [Отчёт: Исправления TypeScript сборки (build fixes)](reports/fixes/report-ts-build-fixes-2026-03-16.md) ✅ (Завершен 2026-03-16 — JsonValue касты в 5 местах, удалён SMSFreeInfo)
- [Отчёт: Исправление переводов типов уведомлений и SMS.ru i18n](reports/fixes/report-notifications-i18n-type-chips-2026-03-16.md) ✅ (Завершен 2026-03-16 — notificationTypes раздел, smsRu* ключи перемещены из navigation)
- [Отчёт: Исправление сессии при смене языка и NaN баланса SMS.ru](reports/fixes/report-auth-session-renewal-sms-balance-2026-03-16.md) ✅ (Завершен 2026-03-16 — withSessionCookie в middleware, getBalance() fix)
- [Отчёт: Публичный endpoint регистрации и демо-уведомления seed](reports/fixes/report-registration-public-endpoint-seed-2026-03-16.md) ✅ (Завершен 2026-03-16 — GET /api/settings/registration публичный, 16 демо-уведомлений)
- [Отчёт: Улучшение схемы модели Event](reports/deployment/report-events-schema-improvement-2026-03-16.md) ✅ (Завершен 2026-03-16 — payload/metadata→Json, ip поле, убрана сериализация)
- [Отчёт: Интеграционный тест параллельных bulk-операций](reports/testing/report-bulk-concurrent-integration-2026-03-15.md) ✅ (Завершен 2026-03-15 — 3 теста, без дедлоков)
- [Отчёт: Тестовое покрытие Import/Bulk Operations](reports/testing/report-test-coverage-import-bulk-2026-03-15.md) ✅ (Завершен 2026-03-15 — +83 теста, 804 unit-тестов)
- [Отчёт: References — расширение City, i18n таблиц, seed-данные](reports/improve/report-references-i18n-city-model-seed-2026-03-15.md) ✅ (Завершен 2026-03-15)
- [Отчёт: References — двусторонняя связь район-город, UX диалогов](reports/improve/report-references-districts-city-relation-2026-03-15.md) ✅ (Завершен 2026-03-15)
- [Отчёт: Динамическая система языков (i18n)](reports/improve/report-i18n-dynamic-languages-2026-03-14.md) ✅ (Завершен 2026-03-14)
- [Отчёт: Рефакторинг WebSocket на standalone](reports/deployment/report-websocket-standalone-2025-12-03.md) ✅ (Завершен 2025-12-03)
- [Отчёт: Обновление .env и удаление SQLite](reports/migrations/report-env-configuration-update-2025-11-28.md) ✅ (Завершен 2025-11-28)
- [Отчёт: Миграция на PostgreSQL](reports/migrations/report-postgresql-migration-2025-11-28.md) ✅ (Завершен 2025-11-28)
- [Отчёт: Исправления Media Sync и SQLite timeout](reports/fixes/report-media-sync-sqlite-fixes-2025-11-28.md) ✅ (Завершен 2025-11-28)
- [Отчёт: Улучшения async upload медиа](reports/testing/report-media-async-upload-improvements-2025-11-28.md) ✅ (Завершен 2025-11-28)
- [Отчёт: S3 Sync Batch Processing](reports/testing/report-s3-sync-batch-processing-2025-11-27.md) ✅ (Завершен 2025-11-27)
- [Отчёт: Исправление бага eventService.emit](reports/testing/report-fix-eventservice-emit-bug-2025-11-27.md) ✅ (Завершен 2025-11-27)
- [Отчёт: Модуль Media (полный)](reports/report-media-module-2025-11-26.md) ✅ (Завершен 2025-11-26)
- [Отчёт: Модуль лицензий медиа](reports/report-media-licenses-module-2025-11-26.md) ✅ (Завершен 2025-11-26)
- [Отчёт: Bull Queue интеграция с Media](reports/report-media-bull-queue-integration-2025-11-26.md) ✅ (Завершен 2025-11-26)
- [Отчёт: Grafana Dashboard для Bull/Notifications](reports/monitoring/report-bull-grafana-dashboard-2025-11-26.md) ✅ (новый)
- [Отчет о реализации модуля сценариев уведомлений - Этап 1](reports/testing/report-notification-scenarios-module-stage1-2025-01-24.md) ⏳ (В процессе, Этап 1 частично завершен)
- [Отчет: Мониторинг и статистика уведомлений](reports/testing/report-notification-monitoring-2025-11-25.md) ✅ (Завершен)
- [Отчет о реализации улучшений модуля Event](reports/testing/report-event-module-improvements-2025-01-24.md) ✅ (Завершен 2025-01-24)
- [Отчет о реализации E2E тестов для Rate Limit](reports/testing/report-rate-limit-e2e-tests-2025-11-23.md) ⏳ (В процессе, ~70%)
- [Отчет Этапа 1 - Критические исправления](reports/testing/report-import-export-improvements-stage1-2025-01-24.md) ✅ (Завершен)
- [Результаты тестирования экспорта/импорта](reports/testing/testing-results-export-import.md) ✅
- [Результаты интеграции Events](reports/testing/events-integration-results.md) ✅
- [Отчет о исправлении: Race condition при подключении к Redis](reports/testing/report-fix-redis-connection-race-2025-11-23.md) ✅
- [Отчёт: Bull Queue Docker Setup](reports/deployment/report-bull-queue-docker-setup-2025-11-25.md) ✅
- [Отчёт: S3/MinIO Docker Setup](reports/deployment/report-s3-minio-docker-setup-2025-11-26.md) ✅ (новый)
- [Отчет о рефакторинге: Удаление функции isAdmin()](reports/testing/report-roles-refactoring-isadmin-removal-2025-11-25.md) ✅ (новый)
- [Отчет о реализации: Система аккаунтов пользователей](reports/testing/report-user-accounts-system-2025-11-26.md) ✅ (Завершен 2025-11-26)

---

## 🐛 Требует улучшений

### Критические баги
- Нет критических багов

### Технический долг
- Нет записей технического долга

### Улучшения функционала
- Нет записей улучшений

---

## 📊 Статистика

### По типам документов
- **ТЗ**: 0 активных, 0 в работе, 0 завершенных
- **Планы**: 12 активных, 8 в работе, 8 завершенных, 1 в roadmap
- **Анализы**: 0 активных, 2 в работе, 17 завершенных
- **Отчеты**: 1 активных, 1 в работе, 10 завершенных
- **Улучшения**: 0 открытых, 0 в работе, 0 закрытых

### По модулям
- **Import/Export**: 2 плана, 1 отчет ✅
- **Events**: 2 плана ✅, 2 отчёта ✅, 2 анализа ✅ (schema improvement завершено 2026-03-16)
- **Rate Limits**: 3 исправления ✅, Grafana dashboard v3 ✅ ($module фильтр, Events by Module, Block Rate %)
- **User Operations**: 2 документации ✅
- **User Module**: 1 план ⏳ (тестовое покрытие, ~95%)
- **Roles Management**: 2 анализа ✅, 2 плана ✅, 1 отчет ✅ (рефакторинг isAdmin завершён 2025-11-25)
- **Redux Store**: SSR fix ✅ (localforage → localStorage с noop fallback)
- **Socket Module**: 1 план ⏳ (рефакторинг, ~0%)
- **Notification Scenarios**: 2 анализа ✅, 2 плана ✅ (модуль сценариев + мониторинг, завершено)
- **Service Configuration**: 2 анализа ✅, 1 план ⏳, 1 исправление ✅ (модуль конфигурации внешних сервисов, ~95% завершено, S3 интеграция работает)
- **Media Module**: 3 анализа ✅, 4 плана (3✅, 1⏳), 5 отчётов ✅, UI/UX паттерны ✅ (медиатека, лицензии, Bull Queue интеграция, async upload, SQLite fixes завершено, S3 sync settings в работе)

---

## 🔗 Быстрые ссылки

### Активные документы
- [Все активные ТЗ](requirements/active/)
- [Все активные планы](plans/active/)
- [Все открытые улучшения](improvements/)

### Завершенные документы
- [Все завершенные ТЗ](requirements/completed/)
- [Все завершенные планы](plans/completed/)
- [Все отчеты](reports/)

### По категориям
- [Все анализы](analysis/)
- [Все исправления](fixes/)
- [Все улучшения](improvements/)

---

## 📝 Как обновлять этот индекс

1. При создании нового документа - добавить в соответствующий раздел
2. При изменении статуса - переместить между разделами
3. При завершении - переместить в "Завершено" и обновить статистику
4. Еженедельно - проверять актуальность всех статусов

---

**Примечание:** Этот индекс должен обновляться регулярно для поддержания актуальности информации о состоянии проекта.

