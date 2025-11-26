# Анализ: Grafana Dashboard для Bull/Notifications Queue

**Дата проведения:** 2025-11-26  
**Статус:** Завершен  
**Приоритет:** Средний

---

## 🎯 Цель анализа

Определить требования и архитектуру для создания Grafana Dashboard для мониторинга Bull очередей (уведомления) и интеграции с существующей системой метрик.

---

## 📊 Текущее состояние

### Что анализируется:

1. **Существующие метрики Bull/Notifications**
2. **Интеграция с Prometheus**
3. **Существующие дашборды Grafana**
4. **Интеграция с другими системами мониторинга**

### Методология:

- Анализ файла `src/lib/metrics/notifications.ts`
- Анализ `NotificationQueue.ts` на предмет использования метрик
- Проверка конфигурации Prometheus и Grafana
- Сравнение с существующим `rate-limit-dashboard.json`

---

## 🔍 Результаты анализа

### Существующие Prometheus метрики

| Метрика | Тип | Labels | Описание |
|---------|-----|--------|----------|
| `notifications_sent_total` | Counter | channel, status, environment | Отправленные уведомления |
| `notifications_failed_total` | Counter | channel, error_type, environment | Ошибки отправки |
| `notification_send_duration_seconds` | Histogram | channel, environment | Время отправки |
| `notification_queue_size` | Gauge | queue_type, environment | Размер очереди |
| `notification_jobs_added_total` | Counter | channel, delayed, environment | Добавленные задачи |
| `notification_jobs_processed_total` | Counter | channel, status, environment | Обработанные задачи |
| `notification_queue_switches_total` | Counter | from_type, to_type, environment | Переключения Bull↔in-memory |
| `notification_retries_total` | Counter | channel, attempt, environment | Повторные попытки |
| `scenario_executions_total` | Counter | scenario_id, status, environment | Выполнения сценариев |

### Найденные проблемы

1. **Отсутствие Grafana Dashboard**
   - Описание: Метрики существуют, но нет визуализации
   - Влияние: Среднее
   - Приоритет: Средний

2. **Несоответствие функций в notifications.ts**
   - Описание: Функции `markJobAdded`, `markJobProcessed` в notifications.ts принимают `channel` и `delayed/status`, но в NotificationQueue.ts вызываются с `channel` и `queue_type` (bull/in-memory)
   - Влияние: Низкое (метрики работают, но labels могут быть неточными)
   - Приоритет: Низкий

3. **Отсутствие метрик для job duration**
   - Описание: `startJobTimer` используется в NotificationQueue.ts, но не экспортируется из notifications.ts
   - Влияние: Низкое
   - Приоритет: Низкий

### Найденные возможности

1. **Создание комплексного дашборда**
   - Описание: Визуализация всех 9 метрик в одном дашборде
   - Потенциальная выгода: Полная видимость работы очередей

2. **Унификация с существующим rate-limit-dashboard**
   - Описание: Использование того же стиля и структуры
   - Потенциальная выгода: Консистентность UI

---

## 🏗️ Рекомендуемая архитектура дашборда

### Структура панелей

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ROW 1: Overview Stats                             │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────┤
│   Queue     │   Jobs      │   Jobs      │  Failures   │  Retries    │
│   Size      │   Added     │  Processed  │   (5m)      │   (5m)      │
│   (Gauge)   │   (5m)      │   (5m)      │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    ROW 2: Queue Status                               │
├─────────────────────────────────┬───────────────────────────────────┤
│   Queue Type (Bull/In-memory)   │   Queue Switches Timeline         │
│         (Gauge)                 │        (Graph)                    │
└─────────────────────────────────┴───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    ROW 3: Notifications by Channel                   │
├─────────────────────────────────┬───────────────────────────────────┤
│   Sent by Channel (Graph)       │   Failed by Channel (Graph)       │
│   email/sms/browser/telegram    │   email/sms/browser/telegram      │
└─────────────────────────────────┴───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    ROW 4: Performance                                │
├─────────────────────────────────┬───────────────────────────────────┤
│   Send Duration (p50, p95, p99) │   Jobs Throughput (jobs/sec)      │
│        (Histogram)              │        (Rate Graph)               │
└─────────────────────────────────┴───────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    ROW 5: Retries & Errors                           │
├─────────────────────────────────┬───────────────────────────────────┤
│   Retries by Attempt (Graph)    │   Error Types Distribution (Pie)  │
└─────────────────────────────────┴───────────────────────────────────┘
```

### PromQL запросы для панелей

| Панель | PromQL |
|--------|--------|
| Queue Size | `notification_queue_size{queue_type="bull"}` |
| Jobs Added (5m) | `increase(notification_jobs_added_total[5m])` |
| Jobs Processed (5m) | `increase(notification_jobs_processed_total[5m])` |
| Failures (5m) | `increase(notifications_failed_total[5m])` |
| Retries (5m) | `increase(notification_retries_total[5m])` |
| Send Duration p95 | `histogram_quantile(0.95, sum(rate(notification_send_duration_seconds_bucket[5m])) by (le, channel))` |
| Queue Switches | `increase(notification_queue_switches_total[5m])` |
| Sent by Channel | `sum(rate(notifications_sent_total[5m])) by (channel)` |
| Failed by Channel | `sum(rate(notifications_failed_total[5m])) by (channel)` |

---

## 📋 План реализации

### Этап 1: Создание дашборда
- Создать `monitoring/grafana/dashboards/notifications-dashboard.json`
- Добавить все панели согласно структуре выше
- Настроить переменные (environment)

### Этап 2: Исправление метрик (опционально)
- Исправить несоответствие в `markJobAdded` и `markJobProcessed`
- Добавить недостающую метрику `notification_job_duration_seconds`

### Этап 3: Обновление provisioning
- Добавить новый дашборд в `dashboards.yml`

### Этап 4: Документация
- Обновить `ROOT_FILES_DESCRIPTION.md`
- Добавить описание дашборда в документацию мониторинга

---

## ✅ Критерии приемки

- [ ] Дашборд создан и загружается в Grafana
- [ ] Все метрики отображаются корректно
- [ ] Дашборд соответствует стилю rate-limit-dashboard
- [ ] Документация обновлена

---

## 📚 Связанные документы

- [ROOT_FILES_DESCRIPTION.md](../../ROOT_FILES_DESCRIPTION.md) - Документация проекта
- [monitoring/docker-compose.yml](../../../monitoring/docker-compose.yml) - Конфигурация мониторинга
- [src/lib/metrics/notifications.ts](../../../src/lib/metrics/notifications.ts) - Метрики уведомлений
- [src/services/notifications/NotificationQueue.ts](../../../src/services/notifications/NotificationQueue.ts) - Очередь уведомлений

---

## 🔗 Следующий шаг

После утверждения анализа → Создать план реализации в `docs/plans/active/plan-bull-grafana-dashboard-2025-11-26.md`


