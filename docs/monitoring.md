# Monitoring Stack (Prometheus + Grafana)

This guide explains how to run the local monitoring stack for the Next.js app and inspect rate-limit metrics.

## Prerequisites

- Node/PNPM stack ready; Next.js dev server must be running locally (default `http://localhost:3000`).
- Docker + Docker Compose installed.

## Folder Layout

```
typescript-version/full-version/monitoring/
├── docker-compose.yml
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
- Grafana is pre-provisioned with a Prometheus datasource and the rate-limit dashboard JSON.

## Running the stack

1. Start the Next.js app (`pnpm run dev`) or use the combined helper below.
2. From `typescript-version/full-version` (корень Next.js-пакета) выполните:

```powershell
cd monitoring
docker compose up -d
```

   _Shortcut_: `pnpm run dev:with-socket:monitoring` — first brings up `docker compose` then starts the Socket.IO dev server.
3. Open Prometheus at http://localhost:9090 and verify the `materio-nextjs` target is UP.
4. Open Grafana at http://localhost:9091 (default login `admin/admin`) to view dashboards.

## Alerts (optional extension)

- Add custom Prometheus alert rules under `monitoring/prometheus/rules/*.yml` and reference them from `prometheus.yml` via `rule_files`.
- For Junie rate-limit alerts (`RateLimitUnknownModule`, `RateLimitFallbackTooLong`), implement expressions based on the metrics exported by `/api/metrics`.

## Troubleshooting

- **Target DOWN**: ensure the Next.js server is reachable from Docker (`host.docker.internal:3000` on macOS/Windows; on Linux use `host.docker.internal` support or expose via `host.docker.internal` alternative such as `172.17.0.1`).
- **No data in Grafana**: check Prometheus graph tab; if there are errors, inspect the Prometheus logs (`docker compose logs prometheus`).
- **Dashboard edits**: update JSON under `monitoring/grafana/dashboards/` and restart Grafana to pick up changes (or enable UI updates since provisioning allows it).
