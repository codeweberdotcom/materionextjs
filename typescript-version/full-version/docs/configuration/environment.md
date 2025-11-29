# Environment Variables Configuration

Все настройки серверов и сервисов централизованы в файле `.env`.

## 🗄️ Database (PostgreSQL)

```env
DATABASE_URL="postgresql://materio:materio123@localhost:5432/materio?schema=public"
DATABASE_USER=materio
DATABASE_PASSWORD=materio123
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=materio
```

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Prisma connection string | Required |
| `DATABASE_USER` | PostgreSQL username | `materio` |
| `DATABASE_PASSWORD` | PostgreSQL password | `materio123` |
| `DATABASE_HOST` | Database host | `localhost` |
| `DATABASE_PORT` | Database port | `5432` |
| `DATABASE_NAME` | Database name | `materio` |

---

## 📦 Redis

```env
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your-secure-redis-password  # Uncomment for production
```

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password (optional) | — |

---

## ☁️ S3 / MinIO Storage

```env
S3_ENDPOINT=http://localhost:9000
S3_CONSOLE_URL=http://localhost:9001
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=materio-bucket
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

| Variable | Description | Default |
|----------|-------------|---------|
| `S3_ENDPOINT` | S3 API endpoint | `http://localhost:9000` |
| `S3_CONSOLE_URL` | MinIO Console URL | `http://localhost:9001` |
| `S3_ACCESS_KEY` | Access key | `minioadmin` |
| `S3_SECRET_KEY` | Secret key | `minioadmin123` |
| `S3_BUCKET` | Default bucket name | `materio-bucket` |
| `S3_REGION` | AWS region | `us-east-1` |
| `S3_FORCE_PATH_STYLE` | Use path-style URLs | `true` |

### Priority

S3 configuration priority:
1. **Database** (`MediaGlobalSettings.s3DefaultBucket`) — highest priority for bucket
2. **`.env`** variables — credentials and fallback bucket
3. **Default** values

📖 **Подробнее:** [S3 Storage Configuration](./s3-storage.md)

---

## 📊 Monitoring

### Grafana

```env
GRAFANA_URL=http://localhost:9091
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
```

| Variable | Description | Default |
|----------|-------------|---------|
| `GRAFANA_URL` | Grafana URL | `http://localhost:9091` |
| `GRAFANA_USER` | Admin username | `admin` |
| `GRAFANA_PASSWORD` | Admin password | `admin` |

### Prometheus & Loki

```env
PROMETHEUS_URL=http://localhost:9090
LOKI_URL=http://localhost:3100
BULL_BOARD_URL=http://localhost:3030
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PROMETHEUS_URL` | Prometheus URL | `http://localhost:9090` |
| `LOKI_URL` | Loki URL | `http://localhost:3100` |
| `BULL_BOARD_URL` | Bull Board URL | `http://localhost:3030` |

---

## 🌐 Application

```env
BASEPATH=
NEXT_PUBLIC_APP_URL=http://localhost:3000
API_URL=http://localhost:3000/api
NEXT_PUBLIC_API_URL=${API_URL}
```

---

## 🔌 Socket.IO

```env
NEXT_PUBLIC_ENABLE_SOCKET_IO=true
NEXT_PUBLIC_SOCKET_URL=
NEXT_PUBLIC_SOCKET_PATH=/socket.io
```

---

## 📝 Logging

```env
LOG_LEVEL=info
LOG_DIR=logs
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d
```

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `info` |
| `LOG_DIR` | Logs directory | `logs` |
| `LOG_MAX_SIZE` | Max log file size | `20m` |
| `LOG_MAX_FILES` | Log retention | `14d` |

---

## 🔐 Security

```env
CREDENTIALS_ENCRYPTION_KEY=your-64-char-hex-key
RATE_LIMIT_SECRET=your-secret-key
AUTH_JWT_SECRET=your-jwt-secret
```

| Variable | Description | Required |
|----------|-------------|----------|
| `CREDENTIALS_ENCRYPTION_KEY` | AES-256 key for encrypting service credentials | Yes |
| `RATE_LIMIT_SECRET` | Secret for hashing IPs/emails | Yes |
| `AUTH_JWT_SECRET` | JWT signing secret | Recommended |

### Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔒 Production Security

For production, uncomment and set strong passwords:

```env
# Redis
REDIS_PASSWORD=your-secure-redis-password

# Grafana
GRAFANA_PASSWORD=your-strong-grafana-password

# Optional: Prometheus/Loki auth (requires nginx proxy)
# PROMETHEUS_USER=admin
# PROMETHEUS_PASSWORD=your-prometheus-password
# LOKI_USER=admin
# LOKI_PASSWORD=your-loki-password
```

---

## 📋 Quick Reference

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| Next.js | http://localhost:3000 | — |
| PostgreSQL | localhost:5432 | `materio` / `materio123` |
| Redis | localhost:6379 | — |
| MinIO API | http://localhost:9000 | `minioadmin` / `minioadmin123` |
| MinIO Console | http://localhost:9001 | `minioadmin` / `minioadmin123` |
| Grafana | http://localhost:9091 | `admin` / `admin` |
| Prometheus | http://localhost:9090 | — |
| Loki | http://localhost:3100 | — |
| Bull Board | http://localhost:3030 | — |

---

## Docker Sync

Docker Compose reads credentials from `.env`:

```yaml
# docker-compose.dev.yml
grafana:
  environment:
    - GF_SECURITY_ADMIN_USER=${GRAFANA_USER:-admin}
    - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}

minio:
  environment:
    MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minioadmin}
    MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minioadmin123}
```

Changing values in `.env` and restarting Docker will apply new credentials.

