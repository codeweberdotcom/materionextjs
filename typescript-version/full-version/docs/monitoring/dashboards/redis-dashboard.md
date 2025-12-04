# Redis Dashboard

**UID:** `materio-redis`  
**Файл:** `monitoring/grafana/dashboards/redis-dashboard.json`  
**URL:** http://localhost:9091/d/materio-redis

---

## 📊 Обзор

Мониторинг Redis сервера и очередей Bull.

---

## 📈 Панели

### Row 1: Connection Status

| Панель | Метрика | Описание |
|--------|---------|----------|
| Redis Status | `up{job="redis"}` | Статус подключения |
| Connected Clients | `redis_connected_clients` | Клиенты |
| Memory Used | `redis_memory_used_bytes` | Память |
| Keys | `redis_db_keys` | Количество ключей |

### Row 2: Operations

| Панель | Метрика | Описание |
|--------|---------|----------|
| Commands/sec | `redis_commands_processed_total` | Команд/сек |
| Hits/Misses | `redis_keyspace_hits_total` | Попадания в кеш |
| Hit Rate | — | % попаданий |
| Evicted Keys | `redis_evicted_keys_total` | Вытесненные ключи |

### Row 3: Bull Queues

| Панель | Метрика | Описание |
|--------|---------|----------|
| Queue Size (All) | `bull_queue_size` | Размер всех очередей |
| Active Jobs | `bull_active_jobs` | Активные задачи |
| Completed/min | `bull_completed_total` | Завершённые/мин |
| Failed Jobs | `bull_failed_total` | Ошибки |

### Row 4: Fallback Status

| Панель | Метрика | Описание |
|--------|---------|----------|
| Queue Type | `notification_queue_type` | bull / in-memory |
| Switch Events | `notification_queue_switches_total` | Переключения |
| In-Memory Queue | `notification_in_memory_queue_size` | Размер in-memory |

---

## ⚠️ Alerts

| Alert | Условие | Severity |
|-------|---------|----------|
| Redis Down | `up{job="redis"} == 0` | critical |
| High Memory | `redis_memory_used_bytes > 1GB` | warning |
| Low Hit Rate | `hit_rate < 80%` | warning |
| Queue Overflow | `bull_queue_size > 1000` | critical |

---

## 🔗 Связанные

- [Queues API](../../api/queues.md)
- [Monitoring Stack](../monitoring-stack.md)










