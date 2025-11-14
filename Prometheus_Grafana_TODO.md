# ТЗ: запуск Prometheus + Grafana для мониторинга rate-limit

## Цель
Поднять локальный стек Prometheus/Grafana, который будет снимать метрики с Next.js приложения по эндпоинту `/api/metrics` и отображать их в дашборде/алертах.

## Директория
В корне репозитория создать папку `typescript-version/full-version/monitoring/` со следующей структурой:
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
    │       └── dashboard.json (опционально)
    └── dashboards/ (если будут дополнительные JSON)
```

## docker-compose.yml
- Сервис `prometheus` (образ `prom/prometheus:latest`):
  - порты: `9090:9090`
  - volume: `./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml`
- Сервис `grafana` (образ `grafana/grafana:latest`):
  - порты: `9091:3000`
  - volumes: `./grafana:/etc/grafana`
  - зависит от `prometheus`.

## Конфигурация Prometheus (`prometheus.yml`)
- `global.scrape_interval: 15s`
- `scrape_configs`:
  ```yaml
  - job_name: 'materio-nextjs'
    metrics_path: /api/metrics
    static_configs:
      - targets: ['host.docker.internal:3000']  # заменить на адрес, где крутится Next.js
  ```
- При необходимости добавить дополнительные target’ы (stage/prod).

## Конфигурация Grafana
### Datasource (`grafana/provisioning/datasources/datasource.yml`)
```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

### Дашборды
- Можно подключить готовый JSON (например, с метриками `rate_limit_*`) через `grafana/provisioning/dashboards`.
- Минимально – оставить пустым, добавлять вручную через UI.

## Запуск
1. Убедиться, что Next.js сервер доступен локально (например, `pnpm run dev`).
2. В корне репозитория: `cd typescript-version/full-version/monitoring && docker compose up -d`.
3. Проверить:
   - Prometheus: http://localhost:9090 — в Targets должен быть `materio-nextjs` со статусом UP.
   - Grafana: http://localhost:9091 — логин `admin/admin` (по умолчанию), настроить дашборд.

## Алерты (опционально)
- В `prometheus.yml` можно добавить `rule_files` с выражениями из Junie Metrics Plan (RateLimitUnknownModule, RateLimitFallbackTooLong).

## Документация
- Добавить шаги запуска/остановки в README или отдельный раздел `docs/monitoring.md`.
