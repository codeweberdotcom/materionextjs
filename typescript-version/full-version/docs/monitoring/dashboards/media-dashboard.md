# Media Dashboard

**UID:** `media-module`  
**Файл:** `monitoring/grafana/dashboards/media-dashboard.json`  
**URL:** http://localhost:9091/d/media-module

---

## 📊 Обзор

Дашборд для мониторинга медиа-модуля: загрузки, обработка, очереди, S3 синхронизация.

---

## 📈 Панели

### Row 1: Uploads Overview

| Панель | Метрика | Описание |
|--------|---------|----------|
| Upload Rate | `media_uploads_total` | Загрузки/мин по entityType |
| Active Uploads | `media_active_uploads` | Текущие активные загрузки |
| Upload Errors | `media_errors_total{operation="upload"}` | Ошибки загрузки |
| Avg Upload Duration | `media_upload_duration_seconds` | Среднее время загрузки |

### Row 2: Processing Queue

| Панель | Метрика | Описание |
|--------|---------|----------|
| Queue Size | `media_processing_queue_size` | Размер очереди обработки |
| Processing Rate | `media_processing_jobs_total` | Задач/мин |
| Processing Duration | `media_processing_duration_seconds` | Время обработки |
| Processing Errors | `media_errors_total{operation="processing"}` | Ошибки обработки |

### Row 3: Async Upload (NEW)

| Панель | Метрика | Описание |
|--------|---------|----------|
| Async Upload Rate | `async_upload_requests_total` | Асинхронные загрузки/мин |
| Async Duration | `async_upload_duration_seconds` | Время добавления в очередь |
| Async Errors | `media_errors_total{operation="async_upload"}` | Ошибки async upload |

### Row 4: S3 Sync

| Панель | Метрика | Описание |
|--------|---------|----------|
| Sync Queue Size | `media_sync_queue_size` | Размер очереди S3 |
| S3 Uploads | `s3_uploads_total` | Загрузки в S3/мин |
| S3 Duration | `s3_upload_duration_seconds` | Время загрузки в S3 |
| S3 Errors | `s3_errors_total` | Ошибки S3 |

### Row 5: File Statistics

| Панель | Метрика | Описание |
|--------|---------|----------|
| Total Files | `media_files_total` | Всего файлов |
| Files by Type | `media_files_by_type` | По entityType |
| Storage Used | `media_storage_bytes` | Использовано места |
| Avg File Size | `media_upload_size_bytes` | Средний размер |

### Row 6: System Health

| Панель | Метрика | Описание |
|--------|---------|----------|
| Queue Type | `media_queue_type` | bull / in-memory |
| Fallback Events | `notification_queue_switches_total` | Переключения Redis→Memory |
| DB Retries | `db_retry_total` | Повторы БД операций |
| Failed Jobs | `media_processing_jobs_total{status="failed"}` | Провалившиеся задачи |

---

## 🎛️ Variables

| Variable | Описание | Значения |
|----------|----------|----------|
| `$interval` | Интервал агрегации | 1m, 5m, 15m, 1h |
| `$entity_type` | Фильтр по entityType | all, user_avatar, company_photo, ... |

---

## ⚠️ Alerts

| Alert | Условие | Severity |
|-------|---------|----------|
| High Queue Size | `media_processing_queue_size > 100` | warning |
| Queue Overflow | `media_processing_queue_size > 500` | critical |
| High Error Rate | `rate(media_errors_total[5m]) > 10` | warning |
| S3 Unavailable | `s3_errors_total{type="connection"} > 0` | critical |
| Fallback Active | `notification_queue_switches_total{to="in-memory"} > 0` | warning |

---

## 📷 Скриншот

```
┌─────────────────────────────────────────────────────────────────┐
│ UPLOADS OVERVIEW                                                 │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐        │
│ │ Rate     │ │ Active   │ │ Errors   │ │ Duration │        │
│ │  125/min │ │    12    │ │     2    │ │   1.2s   │        │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘        │
├─────────────────────────────────────────────────────────────────┤
│ PROCESSING QUEUE                                                 │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Queue Size: 45  │  Rate: 89/min  │  Avg: 0.8s  │  Err: 0 │  │
│ └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│ S3 SYNC                                                          │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Sync Queue: 12  │  S3 Rate: 45/min  │  Latency: 120ms    │  │
│ └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Связанные

- [Media API](../../api/media.md)
- [Queues API](../../api/queues.md)
- [Monitoring Stack](../monitoring-stack.md)










