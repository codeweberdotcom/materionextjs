# Rate Limit Dashboard

**UID:** `materio-rl`  
**Файл:** `monitoring/grafana/dashboards/rate-limit-dashboard.json`  
**URL:** http://localhost:9091/d/materio-rl

---

## 📊 Обзор

Мониторинг rate limiting: запросы, блокировки, лимиты.

---

## 📈 Панели

### Row 1: Overview

| Панель | Метрика | Описание |
|--------|---------|----------|
| Total Requests | `rate_limit_requests_total` | Всего запросов |
| Blocked | `rate_limit_blocked_total` | Заблокировано |
| Block Rate | — | % блокировок |
| Unique IPs | `rate_limit_unique_ips` | Уникальные IP |

### Row 2: By Endpoint

| Панель | Метрика | Описание |
|--------|---------|----------|
| Top Endpoints | `rate_limit_requests_total{endpoint}` | Топ endpoints |
| Most Blocked | `rate_limit_blocked_total{endpoint}` | Наиболее блокируемые |
| Limits Config | — | Настройки лимитов |

### Row 3: By IP

| Панель | Метрика | Описание |
|--------|---------|----------|
| Top IPs | `rate_limit_requests_total{ip}` | Топ IP адресов |
| Blocked IPs | `rate_limit_blocked_total{ip}` | Заблокированные IP |
| Blacklist | `rate_limit_blacklist_size` | Чёрный список |

### Row 4: Timing

| Панель | Метрика | Описание |
|--------|---------|----------|
| Window Usage | `rate_limit_window_usage` | Использование окна |
| Reset Time | `rate_limit_reset_seconds` | До сброса |
| Burst Usage | `rate_limit_burst_usage` | Burst лимит |

---

## ⚠️ Alerts

| Alert | Условие | Severity |
|-------|---------|----------|
| High Block Rate | `block_rate > 10%` | warning |
| DDoS Suspected | `requests/sec > 1000` | critical |
| IP Abuse | `single_ip_requests > 100/min` | warning |

---

## 🔗 Связанные

- [Security Dashboard](./security-dashboard.md)
- [Monitoring Stack](../monitoring-stack.md)


