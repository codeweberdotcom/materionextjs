# Socket.IO Dashboard

**Дата обновления:** 2025-12-03  
**UID:** `materio-socket`  
**Файл:** `monitoring/grafana/dashboards/socket-dashboard.json`  
**URL:** http://localhost:9091/d/materio-socket  
**Auto-refresh:** 10 секунд

---

## 📊 Обзор

Мониторинг standalone WebSocket сервера (Port 3001) через Socket.IO с Prometheus метриками.

**Фильтры:**
- **Environment:** development / production / all
- **Namespace:** / (root), /chat, /notifications, all

---

## 📈 Структура панелей

### 📊 Row 1: Connection Status

| Панель | Метрика | Thresholds |
|--------|---------|------------|
| **Active Connections** | `socket_active_connections` | 🟢<100, 🟡<500, 🔴≥500 |
| **Active Users** | `socket_active_users` | 🔵 info |
| **Active Rooms** | `socket_active_rooms` | 🔵 info |
| **Server Uptime** | `socket_server_uptime_seconds` | - |

### 📈 Row 2: Connection Activity

| Панель | Метрика | Визуализация |
|--------|---------|--------------|
| **Connections/min** | `rate(socket_connections_total[1m])` | Time series graph |
| **Disconnects by Reason** | `socket_disconnects_total{reason}` | Pie chart |

**Disconnect reasons:**
- `client` - клиент закрыл соединение
- `server` - сервер закрыл
- `timeout` - таймаут ping/pong
- `transport` - ошибка транспорта
- `error` - другие ошибки

### 💬 Row 3: Messages

| Панель | Метрика | Описание |
|--------|---------|----------|
| **Messages/sec** | `rate(socket_messages_total[1m])` | Throughput |
| **Inbound vs Outbound** | `socket_messages_total{direction}` | Bar gauge |
| **Messages by Event** | `socket_messages_total{event}` | Table |

**Events:**
- `sendMessage` - отправка сообщения
- `receiveMessage` - получение
- `getOrCreateRoom` - создание комнаты
- `markMessagesRead` - прочтение
- `newNotification` - уведомление
- `ping` - heartbeat

### ⚡ Row 4: Performance

| Панель | Метрика | Buckets |
|--------|---------|---------|
| **Message Latency P50** | `socket_message_duration_seconds{quantile="0.5"}` | 1-1000ms |
| **Message Latency P95** | `socket_message_duration_seconds{quantile="0.95"}` | 1-1000ms |
| **Message Latency P99** | `socket_message_duration_seconds{quantile="0.99"}` | 1-1000ms |
| **Message Size Distribution** | `socket_message_size_bytes` | Histogram |

**Buckets для size:**
- 100B, 500B, 1KB, 5KB, 10KB, 50KB, 100KB, 500KB, 1MB

### 🔐 Row 5: Auth & Errors

| Панель | Метрика | Описание |
|--------|---------|----------|
| **Auth Events** | `socket_auth_events_total{status}` | success/failed/expired |
| **Errors by Type** | `socket_errors_total{error_type}` | Pie chart |

**Error types:**
- `connection` - ошибки подключения
- `auth` - ошибки аутентификации
- `message` - ошибки сообщений
- `timeout` - таймауты
- `other` - прочие

---

## ⚠️ Alerts (рекомендуемые)

| Alert | Условие | Severity | Action |
|-------|---------|----------|--------|
| **Too Many Connections** | `connections > 1000` | Warning | Масштабировать WebSocket |
| **High Latency** | `P95 > 500ms` | Warning | Проверить нагрузку |
| **Connection Drops** | `disconnects/min > 50` | Warning | Проверить сеть/сервер |
| **Auth Failures** | `auth_failed > 10/min` | Critical | Проверить JWT/сессии |
| **High Error Rate** | `errors > 5%` | Critical | Проверить логи |

---

## 🧪 Проверка дашборда

### 1. Запустить сервисы:
```bash
pnpm full
```

### 2. Открыть Grafana:
http://localhost:9091

**Логин:** admin / admin

### 3. Найти дашборд:
Dashboards → Browse → "Materio Socket.IO Overview"

или прямая ссылка: http://localhost:9091/d/materio-socket

### 4. Сгенерировать активность:

Откройте несколько вкладок с чатом:
- http://localhost:3000/apps/chat

Отправьте сообщения, дашборд обновится через 10 сек.

---

## 📊 Примеры запросов PromQL

### Текущие подключения:
```promql
sum(socket_active_connections{environment="development"})
```

### Сообщений в минуту:
```promql
rate(socket_messages_total{namespace="/chat"}[1m]) * 60
```

### P95 latency:
```promql
histogram_quantile(0.95, rate(socket_message_duration_seconds_bucket[5m]))
```

### Успешность auth:
```promql
rate(socket_auth_events_total{status="success"}[5m]) 
/ 
rate(socket_auth_events_total[5m]) * 100
```

---

## 🔗 Связанные документы

- [Notifications Dashboard](notifications-dashboard.md)
- [System Dashboard](system-dashboard.md)
- [Monitoring Stack](../monitoring-stack.md)
- [Socket Requirements](../../configuration/socket-requirements.md)
