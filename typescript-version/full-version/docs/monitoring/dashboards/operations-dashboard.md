# Operations Dashboard

**UID:** `materio-operations`  
**Файл:** `monitoring/grafana/dashboards/operations-dashboard.json`  
**URL:** http://localhost:9091/d/materio-operations

---

## Обзор

Операционный мониторинг: API ошибки, bulk операции, события.

---

## Панели

### API Errors

| Панель | Метрика |
|--------|---------|
| Total Errors | `http_errors_total` |
| By Status | `http_errors_total{status}` |
| By Endpoint | `http_errors_total{endpoint}` |

### Bulk Operations

| Панель | Метрика |
|--------|---------|
| Bulk Ops | `bulk_operations_total` |
| Items Processed | `bulk_items_processed_total` |
| Avg Duration | `bulk_operation_duration_seconds` |

### Events

| Панель | Метрика |
|--------|---------|
| Events Total | `events_total` |
| By Category | `events_total{category}` |

---

## Alerts

| Alert | Условие |
|-------|---------|
| High Error Rate | `error_rate > 5%` |
| 5xx Errors | `5xx_errors > 10/min` |

---

## Связанные

- [System Dashboard](./system-dashboard.md)
- [Monitoring Stack](../monitoring-stack.md)










