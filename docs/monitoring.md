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
        └── rate-limit-dashboard.json
```

- `prometheus.yml` scrapes `http://host.docker.internal:3000/api/metrics`.
- `promtail-config.yml` configures Promtail to collect logs from `logs/` directory and send to Loki.
- Grafana is pre-provisioned with Prometheus and Loki datasources, and the rate-limit dashboard JSON.

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
