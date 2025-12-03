# Notifications Dashboard

**UID:** `materio-notifications`  
**Файл:** `monitoring/grafana/dashboards/notifications-dashboard.json`  
**URL:** http://localhost:9091/d/materio-notifications

---

## 📊 Обзор

Мониторинг системы уведомлений: очередь, отправка, ошибки.

---

## 📈 Панели

### Row 1: Queue Overview

| Панель | Метрика | Описание |
|--------|---------|----------|
| Queue Size | `notification_queue_size` | Размер очереди |
| Queue Type | `notification_queue_type` | bull / in-memory |
| Active Jobs | `notification_active_jobs` | Активные |
| Pending Jobs | `notification_pending_jobs` | Ожидающие |

### Row 2: Sending Rate

| Панель | Метрика | Описание |
|--------|---------|----------|
| Sent/min | `notifications_sent_total` | Отправлено/мин |
| By Channel | `notifications_sent_total{channel}` | По каналам |
| Success Rate | — | % успешных |
| Avg Duration | `notification_send_duration_seconds` | Среднее время |

### Row 3: Channels

| Панель | Метрика | Описание |
|--------|---------|----------|
| Email | `notifications_sent_total{channel="email"}` | Email |
| Browser | `notifications_sent_total{channel="browser"}` | Push |
| Telegram | `notifications_sent_total{channel="telegram"}` | Telegram |
| Database | `notifications_sent_total{channel="database"}` | In-app |

### Row 4: Errors

| Панель | Метрика | Описание |
|--------|---------|----------|
| Failed | `notifications_failed_total` | Ошибки |
| By Reason | `notifications_failed_total{reason}` | По причине |
| Retry Queue | `notification_retry_queue_size` | Повторы |

---

## ⚠️ Alerts

| Alert | Условие | Severity |
|-------|---------|----------|
| Queue Overflow | `notification_queue_size > 500` | warning |
| High Error Rate | `error_rate > 5%` | warning |
| Channel Down | `notifications_failed{channel} > 10` | critical |

---

## 🔗 Связанные

- [Queues API](../../api/queues.md)
- [Redis Dashboard](./redis-dashboard.md)








