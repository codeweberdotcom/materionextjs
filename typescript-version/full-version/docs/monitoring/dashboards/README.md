# Grafana Dashboards Documentation

**Дата создания:** 2025-11-26  
**Версия:** 1.0

---

## 📊 Обзор дашбордов

Все дашборды расположены в `monitoring/grafana/dashboards/` и автоматически загружаются через provisioning.

| Dashboard | UID | Файл | Описание |
|-----------|-----|------|----------|
| Rate Limit | `materio-rl` | `rate-limit-dashboard.json` | Rate limiting метрики |
| Notifications | `materio-notifications` | `notifications-dashboard.json` | Bull queue мониторинг |
| Redis | `materio-redis` | `redis-dashboard.json` | Redis сервер |
| Socket.IO | `materio-socket` | `socket-dashboard.json` | WebSocket соединения |
| Operations | `materio-operations` | `operations-dashboard.json` | API errors, bulk ops, events |
| **System** | `materio-system` | `system-dashboard.json` | HTTP API + Database |
| **Security** | `materio-security` | `security-dashboard.json` | Auth + Storage |

---

## 📁 Структура JSON файлов

Каждый дашборд использует стандартную структуру Grafana:

```json
{
  "id": null,
  "uid": "unique-identifier",
  "title": "Dashboard Title",
  "description": "Dashboard description",
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "10s",
  "tags": ["tag1", "tag2"],
  "templating": {
    "list": [/* variables */]
  },
  "panels": [/* dashboard panels */]
}
```

---

## 📝 Документация каждого дашборда

- [system-dashboard.json](./system-dashboard.md) - HTTP API + Database
- [security-dashboard.json](./security-dashboard.md) - Authentication + Storage
- [rate-limit-dashboard.json](./rate-limit-dashboard.md) - Rate Limiting
- [notifications-dashboard.json](./notifications-dashboard.md) - Notifications/Bull
- [redis-dashboard.json](./redis-dashboard.md) - Redis
- [socket-dashboard.json](./socket-dashboard.md) - Socket.IO
- [operations-dashboard.json](./operations-dashboard.md) - Application Operations

---

## 🔧 Provisioning

Дашборды загружаются автоматически через:

```yaml
# monitoring/grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1
providers:
  - name: 'default'
    folder: ''
    type: file
    options:
      path: /etc/grafana/dashboards
```

---

## 🌐 Доступ к дашбордам

| Dashboard | URL |
|-----------|-----|
| System | http://localhost:9091/d/materio-system |
| Security | http://localhost:9091/d/materio-security |
| Rate Limit | http://localhost:9091/d/materio-rl |
| Notifications | http://localhost:9091/d/materio-notifications |
| Redis | http://localhost:9091/d/materio-redis |
| Socket.IO | http://localhost:9091/d/materio-socket |
| Operations | http://localhost:9091/d/materio-operations |

