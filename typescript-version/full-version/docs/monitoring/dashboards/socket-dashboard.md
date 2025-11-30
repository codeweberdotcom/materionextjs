# Socket.IO Dashboard

**UID:** `materio-socket`  
**Файл:** `monitoring/grafana/dashboards/socket-dashboard.json`  
**URL:** http://localhost:9091/d/materio-socket

---

## 📊 Обзор

Мониторинг WebSocket соединений через Socket.IO.

---

## 📈 Панели

### Row 1: Connections

| Панель | Метрика | Описание |
|--------|---------|----------|
| Active Connections | `socket_connections_active` | Активные |
| Total Connected | `socket_connections_total` | Всего подключений |
| Disconnections | `socket_disconnections_total` | Отключения |
| Connection Rate | — | Подключений/мин |

### Row 2: Events

| Панель | Метрика | Описание |
|--------|---------|----------|
| Events Sent | `socket_events_sent_total` | Отправлено событий |
| Events Received | `socket_events_received_total` | Получено |
| By Type | `socket_events_total{event}` | По типу события |
| Error Events | `socket_errors_total` | Ошибки |

### Row 3: Rooms

| Панель | Метрика | Описание |
|--------|---------|----------|
| Active Rooms | `socket_rooms_active` | Активные комнаты |
| Users per Room | `socket_room_users` | Пользователей в комнате |
| Broadcasts | `socket_broadcasts_total` | Broadcast сообщения |

### Row 4: Performance

| Панель | Метрика | Описание |
|--------|---------|----------|
| Latency | `socket_latency_seconds` | Задержка |
| Message Size | `socket_message_size_bytes` | Размер сообщений |
| Memory | `socket_memory_bytes` | Память |

---

## ⚠️ Alerts

| Alert | Условие | Severity |
|-------|---------|----------|
| Too Many Connections | `connections > 10000` | warning |
| High Latency | `latency > 500ms` | warning |
| Connection Drops | `disconnections/min > 100` | warning |

---

## 🔗 Связанные

- [System Dashboard](./system-dashboard.md)
- [Monitoring Stack](../monitoring-stack.md)


