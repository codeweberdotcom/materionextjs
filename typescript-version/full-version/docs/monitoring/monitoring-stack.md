# Monitoring Stack (Prometheus + Grafana + Loki)

This guide explains how to run the local monitoring stack for the Next.js app: metrics collection with Prometheus, log aggregation with Loki, and visualization with Grafana.

## Prerequisites

- Node/PNPM stack ready; Next.js dev server must be running locally (default `http://localhost:3000`).
- Docker + Docker Compose installed.

## Folder Layout

```
typescript-version/full-version/monitoring/
├── docker-compose.yml
├── promtail-config.yml
├── prometheus/
│   └── prometheus.yml
└── grafana/
    ├── provisioning/
    │   ├── datasources/
    │   │   └── datasource.yml
    │   └── dashboards/
    │       └── dashboards.yml
    └── dashboards/
        ├── rate-limit-dashboard.json
        ├── notifications-dashboard.json
        ├── redis-dashboard.json
        └── socket-dashboard.json
```

- `prometheus.yml` scrapes `http://host.docker.internal:3000/api/metrics`.
- `promtail-config.yml` configures Promtail to collect logs from `logs/` directory and send to Loki.
- Grafana is pre-provisioned with Prometheus and Loki datasources, and dashboard JSONs.

## Grafana Dashboards

| Dashboard | UID | Description |
|-----------|-----|-------------|
| **Materio Rate Limit Overview** | `materio-rl` | Rate limiting: checks, blocks, fallback, performance |
| **Materio Notifications & Queue Overview** | `materio-notifications` | Bull queue monitoring for notifications (email, sms, browser, telegram) |
| **Materio Redis Overview** | `materio-redis` | Redis monitoring: connections, operations, performance, memory |
| **Materio Socket.IO Overview** | `materio-socket` | Socket.IO monitoring: connections, messages, rooms, performance |
| **Materio Application Operations** | `materio-operations` | Application operations: API errors, bulk ops, events, import/export, roles, translations |
| **Materio System Overview** | `materio-system` | HTTP API and Database: requests, latency, queries, connections |
| **Materio Security Overview** | `materio-security` | Authentication and Storage: logins, sessions, uploads, downloads |

### Rate Limit Dashboard Panels

| Row | Panels |
|-----|--------|
| 📊 Overview Stats | Redis Failures, Unknown Modules, Total Checks, Blocked, Active Blocks, Backend |
| 📈 Backend & Fallback | Backend Status, Fallback Switches |
| ⚡ Performance | Consume Duration (p50/p95/p99), Check Duration (p50/p95/p99) |
| 🔒 Rate Limiting | Checks by Module, Events (Warnings & Blocks) |
| 🚫 Blocks | Blocks by Type, Active Blocks Distribution (Pie) |
| 📋 Fallback Duration | Fallback Duration (time in Prisma) |

**Metrics used:**
- `rate_limit_store_backend` — Active backend (Redis/Prisma)
- `rate_limit_fallback_switch_total` — Backend switches
- `rate_limit_redis_failures_total` — Redis failures
- `rate_limit_fallback_duration_seconds` — Time in fallback
- `rate_limit_consume_duration_seconds` — store.consume() time
- `rate_limit_check_duration_seconds` — checkLimit() time
- `rate_limit_unknown_module_total` — Unknown modules
- `rate_limit_checks_total` — Total checks (allowed/blocked)
- `rate_limit_events_total` — Events (warning/block)
- `rate_limit_blocks_total` — Blocks by type
- `rate_limit_active_blocks` — Active blocks gauge

**Access:** http://localhost:9091/d/materio-rl

---

### Notifications Dashboard Panels

| Row | Panels |
|-----|--------|
| 📊 Overview Stats | Queue Size, Jobs Added, Jobs Processed, Failures, Retries, Queue Type |
| 📈 Queue Activity | Queue Size Over Time, Queue Switches (Bull ↔ In-memory) |
| 📧 Notifications by Channel | Sent by Channel, Failed by Channel |
| ⚡ Performance | Send Duration (p50/p95/p99), Jobs Throughput |
| 🔄 Retries & Errors | Retries by Attempt, Error Types Distribution |
| 📋 Scenarios | Scenario Executions |

**Access:** http://localhost:9091/d/materio-notifications

---

### Redis Dashboard Panels

| Row | Panels |
|-----|--------|
| 📊 Connection Status | Connection Status, Active Connections, Connection Errors, Reconnections, Uptime, Total Keys |
| 📈 Operations | Operations Rate, Operations by Status |
| ⚡ Performance | Operation Duration (p50/p95/p99), Duration by Operation |
| 💾 Memory & Storage | Memory Usage, Keys Count |
| 🔧 Commands | Commands Rate, Commands Distribution (Pie) |
| 🚨 Errors | Connection Errors, Failed Operations |

**Metrics used:**
- `redis_connection_status` — Connection status (1 = connected)
- `redis_active_connections` — Active connections count
- `redis_connection_errors_total` — Connection errors by type
- `redis_reconnections_total` — Reconnection attempts
- `redis_uptime_seconds` — Server uptime
- `redis_keys_total` — Keys count by database
- `redis_operations_total` — Operations by type and status
- `redis_operation_duration_seconds` — Operation latency
- `redis_memory_usage_bytes` — Memory usage
- `redis_commands_total` — Commands by type

**Access:** http://localhost:9091/d/materio-redis

---

### Socket.IO Dashboard Panels

| Row | Panels |
|-----|--------|
| 📊 Connection Status | Active Connections, Active Users, Active Rooms, Connections (5m), Errors (5m), Server Uptime |
| 📈 Connections | Active Connections Over Time, Connection Rate |
| 💬 Messages | Messages Rate, Messages by Event |
| ⚡ Performance | Message Duration (p50/p95/p99), Message Size |
| 🔐 Authentication | Auth Events, Auth Success Rate (Pie) |
| 🚨 Errors & Disconnects | Errors by Type, Disconnects by Reason |

### Application Operations Dashboard Panels

| Row | Panels |
|-----|--------|
| 🚨 API Errors | API Errors (5m), API Errors by Route, Errors by Status (Pie) |
| 📦 Bulk Operations | Bulk Success (5m), Bulk Failed (5m), Bulk Operations by Type, Bulk Duration (p95) |
| 📋 Events | Events Recorded (5m), Events Failed (5m), Events by Type, Event Recording Duration |
| 📤 Import/Export | Exports (5m), Imports (5m), Import/Export Operations, Import/Export Duration |
| 🔐 Roles | Role Operations (5m), Cache Errors (5m), Role Operations by Type, Role Cache Switches |
| 🌐 Translations | Translation Ops (5m), Translation Import (5m), Translation Operations, Translation Duration |

### System Overview Dashboard Panels

| Row | Panels |
|-----|--------|
| 📊 HTTP Overview | Total Requests (5m), Error Rate (5m), Active Requests, Avg Response Time, Server Errors, Client Errors |
| 📈 HTTP Traffic | Requests Over Time, Requests by Status (Pie), Requests by Method (Pie) |
| ⚡ HTTP Performance | Response Time Percentiles (p50/p95/p99), Response Size (p50/p95) |
| 🗄️ Database Overview | Total Queries (5m), Query Errors (5m), Active Connections, Slow Queries (5m), Transactions (5m), Pool Size |
| 📈 Database Performance | Query Duration Percentiles (p50/p95/p99), Queries by Model |

### Security Overview Dashboard Panels

| Row | Panels |
|-----|--------|
| 🔐 Auth Overview | Login Success (5m), Login Failed (5m), Active Sessions, Registrations (5m), Password Resets (5m), Token Refreshes (5m) |
| 📈 Auth Activity | Logins Over Time, Login Success Rate (Donut), Logins by Provider (Pie) |
| 🔄 Sessions | Session Duration Distribution (p50/p95), Sessions Created/Expired |
| 📦 Storage Overview | Uploads (5m), Downloads (5m), Storage Errors (5m), Active Uploads, Bytes Uploaded (5m), Bytes Downloaded (5m) |
| 📈 Storage Activity | Storage Operations Over Time, File Sizes (Upload/Download p50/p95) |

**Metrics used:**
- `socket_active_connections` — Active connections by namespace
- `socket_active_users` — Unique active users
- `socket_active_rooms` — Active rooms
- `socket_connections_total` — Total connections (success/failed)
- `socket_disconnects_total` — Disconnections by reason
- `socket_messages_total` — Messages by event and direction
- `socket_message_duration_seconds` — Message handling latency
- `socket_message_size_bytes` — Message size
- `socket_errors_total` — Errors by type
- `socket_auth_events_total` — Authentication events
- `socket_server_uptime_seconds` — Server uptime

**Access:** http://localhost:9091/d/materio-socket

---

### Application Operations Dashboard (`operations-dashboard.json`)

**Metrics used:**
- `api_errors_total` — API errors by route/status/code
- `bulk_operations_success_total` — Successful bulk operations
- `bulk_operations_failure_total` — Failed bulk operations
- `bulk_operations_duration_seconds` — Bulk operation latency
- `events_recorded_total` — Events recorded by type
- `events_record_failures_total` — Event recording failures
- `events_record_duration_seconds` — Event recording latency
- `export_operations_total` — Export operations by entity
- `import_operations_total` — Import operations by entity
- `export_duration_seconds` — Export latency
- `import_duration_seconds` — Import latency
- `role_operations_total` — Role CRUD operations
- `role_cache_errors_total` — Role cache errors
- `role_cache_switches_total` — Cache backend switches
- `translation_operations_total` — Translation operations
- `translation_import_total` — Translation imports
- `translation_operation_duration_seconds` — Translation latency

**Access:** http://localhost:9091/d/materio-operations

---

### System Overview Dashboard (`system-dashboard.json`)

**Metrics used:**
- `http_requests_total` — Total HTTP requests by method/route/status
- `http_errors_total` — HTTP errors by type
- `http_request_duration_seconds` — Request latency
- `http_response_size_bytes` — Response sizes
- `http_active_requests` — Currently processing requests
- `prisma_query_total` — Database queries by model/operation
- `prisma_query_duration_seconds` — Query latency
- `prisma_connections_active` — Active DB connections
- `prisma_slow_queries_total` — Slow queries count
- `prisma_transaction_total` — Transactions count
- `prisma_pool_size` — Connection pool size

**Access:** http://localhost:9091/d/materio-system

---

### Security Overview Dashboard (`security-dashboard.json`)

**Metrics used:**
- `auth_login_total` — Login attempts by status/provider
- `auth_logout_total` — Logout events
- `auth_registration_total` — Registration attempts
- `auth_password_reset_total` — Password reset attempts
- `auth_token_refresh_total` — Token refresh attempts
- `auth_session_created_total` — Sessions created
- `auth_session_expired_total` — Sessions expired
- `auth_session_duration_seconds` — Session duration
- `auth_active_sessions` — Currently active sessions
- `s3_operations_total` — S3 operations by type
- `s3_errors_total` — S3 errors
- `s3_bytes_uploaded_total` — Total bytes uploaded
- `s3_bytes_downloaded_total` — Total bytes downloaded
- `s3_upload_size_bytes` — Upload file sizes
- `s3_download_size_bytes` — Download file sizes
- `s3_active_uploads` — Currently uploading

**Access:** http://localhost:9091/d/materio-security

## Running the stack

1. Start the Next.js app (`pnpm run dev`) or use the combined helper below.
2. From `typescript-version/full-version` (корень Next.js-пакета) выполните:

```powershell
cd monitoring
docker compose up -d
```

   _Shortcut_: `pnpm run dev:with-socket:monitoring` — first brings up `docker compose` then starts the Socket.IO dev server.
3. Open Prometheus at http://localhost:9090 and verify the `materio-nextjs` target is UP.
4. Open Loki at http://localhost:3100 to inspect logs directly (optional).
5. Open Grafana at http://localhost:9091 (default login `admin/admin`) to view dashboards and explore logs via Loki datasource.

## Logs (Winston + Loki + Sentry integration)

- **Winston Logger**: Central logging system with multiple transports:
  - **File transport**: Daily rotated logs in `logs/` directory (application.log, error.log).
  - **Loki transport**: Direct log shipping to Loki for centralized storage.
  - **Sentry transport**: Error logs (level 'error') sent to Sentry for tracking (requires `SENTRY_DSN` env var).
  - **Console transport**: Development logging.
- **Promtail**: Collects logs from files and sends to Loki as backup.
- **Sentry**: Error monitoring and alerting (integrates with Winston for structured error logs).
- In Grafana, use Loki datasource for log queries (e.g., `{service="materio-nextjs"} |= "error"`).

## Alerts (optional extension)

- Add custom Prometheus alert rules under `monitoring/prometheus/rules/*.yml` and reference them from `prometheus.yml` via `rule_files`.
- For Junie rate-limit alerts (`RateLimitUnknownModule`, `RateLimitFallbackTooLong`), implement expressions based on the metrics exported by `/api/metrics`.

## Troubleshooting

- **Target DOWN**: ensure the Next.js server is reachable from Docker (`host.docker.internal:3000` on macOS/Windows; on Linux use `host.docker.internal` support or expose via `host.docker.internal` alternative such as `172.17.0.1`).
- **No metrics in Grafana**: check Prometheus graph tab; if there are errors, inspect the Prometheus logs (`docker compose logs prometheus`).
- **No logs in Loki/Grafana**: check Promtail logs (`docker compose logs promtail`) and ensure `logs/` directory is accessible. Verify Loki at http://localhost:3100/ready.
- **Loki connection errors**: Winston may log errors if Loki is down; logs still go to files as fallback.
- **Sentry errors not appearing**: ensure `SENTRY_DSN` is set in environment; check Winston logs for Sentry transport errors.
- **Dashboard edits**: update JSON under `monitoring/grafana/dashboards/` and restart Grafana to pick up changes (or enable UI updates since provisioning allows it).








