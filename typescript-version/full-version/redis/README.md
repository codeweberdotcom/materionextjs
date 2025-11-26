# Redis (Presence Store)

Запусти локальный инстанс:

```bash
docker compose -f redis/docker-compose.yml up -d
# или старая команда
docker run -d \
  --name materio-redis \
  -p 6379:6379 \
  -v materio-redis-data:/data \
  redis:7-alpine --appendonly yes
```

Проверка:

```bash
redis-cli -h localhost -p 6379 ping
```

В `.env` проекта добавь:

```
REDIS_URL=redis://localhost:6379
```

Дальше presence-store и Socket.IO adapter могут использовать этот URL.
