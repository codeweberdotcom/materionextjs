# Анализ: Ошибка подключения S3 — eventService.emit is not a function

**Дата проведения:** 2025-11-27  
**Статус:** ✅ Исправлено и протестировано  
**Приоритет:** Критический (блокировал S3 интеграцию)

---

## 🎯 Цель анализа

Найти и устранить причину ошибки `eventService.emit is not a function` при тестировании подключения к S3 (MinIO) через админ-панель.

---

## 📊 Текущее состояние

### Что анализируется:

- API endpoint тестирования подключения к внешним сервисам
- Модуль `EventService` для логирования событий
- Все файлы, использующие `eventService`

### Методология:

- Анализ серверных логов
- Поиск по кодовой базе `eventService.emit`
- Сравнение с API класса `EventService`

---

## 🔍 Результаты анализа

### 1. Описание проблемы

При тестировании подключения к S3 (MinIO) через админ-панель возникала ошибка:

```
error: [API:Services] Failed to test connection {
  "error": "_services_events_EventService__WEBPACK_IMPORTED_MODULE_3__.eventService.emit is not a function",
  "id": "cmifqj3nj0076h158i65d8nbt"
}
POST /api/admin/settings/services/cmifqj3nj0076h158i65d8nbt/test 500 in 150ms
```

**Важно:** Само подключение к S3 было **успешным** (`success: true`, `latency: 30ms`), ошибка происходила **после** успешного теста при попытке записать событие в лог.

### 2. Причина ошибки

#### 2.1 Неверный вызов метода

В 8 файлах использовался несуществующий метод `eventService.emit()`:

```typescript
// ❌ НЕВЕРНО - метод emit НЕ существует в классе EventService
await eventService.emit({
  source: 'api',
  module: 'settings',
  type: 'service_configuration.test_success',
  actorType: 'user',
  actorId: user.id,
  ...
})
```

#### 2.2 Правильный метод

В классе `EventService` (`src/services/events/EventService.ts`) есть только метод `record()`:

```typescript
// ✅ ПРАВИЛЬНО - метод record существует
await eventService.record({
  source: 'api',
  module: 'settings',
  type: 'service_configuration.test_success',
  actor: { type: 'user', id: user.id },
  ...
})
```

#### 2.3 Различие в формате параметров

| Параметр | emit() (неверно) | record() (правильно) |
|----------|------------------|---------------------|
| Actor | `actorType`, `actorId` | `actor: { type, id }` |
| Subject | `subjectType`, `subjectId` | `subject: { type, id }` |

---

## 📁 Затронутые файлы

| # | Файл | Количество замен | Описание |
|---|------|------------------|----------|
| 1 | `src/app/api/admin/settings/services/[id]/test/route.ts` | 1 | Тест подключения |
| 2 | `src/app/api/admin/settings/services/[id]/toggle/route.ts` | 1 | Включение/выключение сервиса |
| 3 | `src/app/api/admin/settings/services/[id]/route.ts` | 2 | CRUD операции (PUT, DELETE) |
| 4 | `src/app/api/admin/settings/services/route.ts` | 1 | Создание сервиса (POST) |
| 5 | `src/services/rules/RulesService.ts` | 3 | Rules Engine |
| 6 | `src/services/scheduler/TariffExpirationScheduler.ts` | 2 | Планировщик тарифов |
| 7 | `src/services/workflows/WorkflowService.ts` | 1 | Workflow базовый |
| 8 | `src/services/workflows/ListingWorkflowService.ts` | 1 | Workflow объявлений |

**Всего исправлено:** 12 вызовов в 8 файлах

---

## 💡 Исправление

### Пример замены

```typescript
// БЫЛО:
await eventService.emit({
  source: 'api',
  module: 'settings',
  type: 'service_configuration.test_success',
  severity: 'info',
  actorType: 'user',
  actorId: user.id,
  subjectType: 'service_configuration',
  subjectId: id,
  message: 'Тест подключения успешен',
  payload: { serviceName, serviceType, latency }
})

// СТАЛО:
await eventService.record({
  source: 'api',
  module: 'settings',
  type: 'service_configuration.test_success',
  severity: 'info',
  actor: {
    type: 'user',
    id: user.id
  },
  subject: {
    type: 'service_configuration',
    id: id
  },
  message: 'Тест подключения успешен',
  payload: { serviceName, serviceType, latency }
})
```

---

## 🧪 Тестирование после исправления

### Результаты тестирования S3 MinIO:

| Тест | Latency | Результат |
|------|---------|-----------|
| 1-й (с компиляцией) | 25149ms | ✅ Подключено |
| 2-й (без компиляции) | 249ms | ✅ Подключено |

### Шаги воспроизведения:

1. Запустить сервер: `pnpm dev:with-socket:monitoring:with-redis:with-bull:with-s3`
2. Открыть админ-панель: http://localhost:3000/en/admin/settings/services
3. Найти "S3 MinIO (Local)"
4. Нажать "Тестировать подключение"
5. Убедиться что статус = "Подключено! Версия: MinIO"

---

## 📝 Выводы

1. **Причина ошибки:** Использование несуществующего метода `emit()` вместо `record()`
2. **Влияние:** Блокировало функциональность тестирования подключений к внешним сервисам
3. **Решение:** Замена 12 вызовов в 8 файлах
4. **Результат:** S3 подключение работает корректно (latency ~250ms)

---

## 🔗 Связанные документы

- [План модуля конфигурации внешних сервисов](../../plans/active/plan-service-configuration-module-2025-11-25.md)
- [Отчёт об исправлении](../../reports/testing/report-fix-eventservice-emit-bug-2025-11-27.md)
- [EventService](../../../src/services/events/EventService.ts)
- [S3 README](../../s3/README.md)

---

*Анализ создан: 2025-11-27*  
*Исправление выполнено: 2025-11-27*
