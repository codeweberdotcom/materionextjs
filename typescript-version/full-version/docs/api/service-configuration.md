# Service Configuration API Documentation

## 📋 Overview

The Service Configuration API provides comprehensive management of external service connections (Redis, PostgreSQL, Prometheus, Loki, Grafana, Sentry, S3, SMTP, Elasticsearch) through an admin panel with hybrid configuration mode:
- **Development**: Docker containers from project folders (localhost)
- **Staging**: Environment variables (.env)
- **Production**: Configuration through admin panel (Database)

## 🏗️ Architecture

### Components
- **Service Configuration API**: RESTful endpoints for CRUD operations
- **ServiceConfigResolver**: Central resolver with priority order (Admin → ENV → Default)
- **Connectors**: Test connections to various external services
- **Encryption**: AES-256-GCM encryption for sensitive credentials
- **Database Models**: `ServiceConfiguration` model in Prisma schema
- **Validation**: Zod schemas for request validation

### Key Files
- `src/app/api/admin/settings/services/route.ts` - Service collection endpoints
- `src/app/api/admin/settings/services/[id]/route.ts` - Individual service endpoints
- `src/app/api/admin/settings/services/[id]/test/route.ts` - Connection testing endpoint
- `src/app/api/admin/settings/services/[id]/toggle/route.ts` - Enable/disable service
- `src/app/api/admin/settings/services/status/route.ts` - Status of all services
- `src/lib/config/ServiceConfigResolver.ts` - Configuration resolver
- `src/modules/settings/services/connectors/` - Service connectors
- `prisma/schema.prisma` - Database schema

### Configuration Priority

```
1️⃣ Admin Panel (DB)  →  2️⃣ ENV Variables  →  3️⃣ Default (Docker)
```

The `ServiceConfigResolver` automatically resolves configurations based on this priority order.

## 🔐 Authentication & Authorization

All endpoints require:
- **Authentication**: Valid session token
- **Authorization**: `SUPERADMIN` or `ADMIN` role only

## 📡 Service Configuration Management

### GET `/api/admin/settings/services`

Get list of all service configurations (credentials are encrypted/hidden).

**Query Parameters:**
- `type`: Filter by service type (`redis`, `postgresql`, `prometheus`, etc.)
- `enabled`: Filter by enabled status (`true`/`false`)
- `status`: Filter by connection status (`connected`, `disconnected`, `error`)

**Permissions Required:** `SUPERADMIN` or `ADMIN`

**Example Request:**
```
GET /api/admin/settings/services?enabled=true&type=redis
```

**Response:**
```json
[
  {
    "id": "service-id-1",
    "name": "redis",
    "host": "redis.example.com",
    "port": 6379,
    "protocol": "redis://",
    "username": "admin",
    "password": null, // Hidden in response
    "token": null,
    "tlsEnabled": true,
    "enabled": true,
    "basePath": "",
    "metadata": "{}",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

**AI Agent Usage:**
- Load all service configurations for admin interface
- Filter by `enabled=true` to show only active configurations
- Credentials are never returned in responses (encrypted in DB)

### POST `/api/admin/settings/services`

Create new service configuration.

**Permissions Required:** `SUPERADMIN` or `ADMIN`

**Request Body:**
```json
{
  "name": "redis",
  "host": "redis.example.com",
  "port": 6379,
  "protocol": "redis://",
  "username": "admin",
  "password": "secret123", // Will be encrypted
  "tlsEnabled": true,
  "enabled": true,
  "basePath": "",
  "metadata": "{\"custom\": \"data\"}"
}
```

**Response:**
```json
{
  "id": "new-service-id",
  "name": "redis",
  "host": "redis.example.com",
  "port": 6379,
  "protocol": "redis://",
  "username": "admin",
  "password": "encrypted:...", // Encrypted
  "tlsEnabled": true,
  "enabled": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**Validation:**
- `name`: Required, must be one of: `redis`, `postgresql`, `prometheus`, `loki`, `grafana`, `sentry`, `smtp`, `s3`, `elasticsearch`
- `host`: Required, valid hostname or IP
- `port`: Optional, valid port number (1-65535)
- `protocol`: Optional, valid protocol (`http://`, `https://`, `redis://`, etc.)
- `password`, `token`: Optional, will be encrypted automatically
- `metadata`: Optional, valid JSON string

**AI Agent Usage:**
- Passwords and tokens are automatically encrypted using AES-256-GCM
- Requires `CREDENTIALS_ENCRYPTION_KEY` in environment variables
- After creation, `ServiceConfigResolver` cache is automatically cleared

### GET `/api/admin/settings/services/[id]`

Get specific service configuration by ID.

**Permissions Required:** `SUPERADMIN` or `ADMIN`

**Response:**
```json
{
  "id": "service-id",
  "name": "redis",
  "host": "redis.example.com",
  "port": 6379,
  "protocol": "redis://",
  "username": "admin",
  "password": null, // Never returned in response
  "tlsEnabled": true,
  "enabled": true,
  "metadata": "{}",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `404`: Service configuration not found

### PUT `/api/admin/settings/services/[id]`

Update existing service configuration.

**Permissions Required:** `SUPERADMIN` or `ADMIN`

**Request Body:**
```json
{
  "host": "updated-redis.example.com",
  "port": 6380,
  "enabled": false
}
```

**Response:**
```json
{
  "id": "service-id",
  "name": "redis",
  "host": "updated-redis.example.com",
  "port": 6380,
  "enabled": false,
  "updatedAt": "2025-01-01T01:00:00.000Z"
}
```

**AI Agent Usage:**
- Partial updates are supported (only send fields to update)
- If `password` or `token` is updated, it will be re-encrypted
- Cache is automatically cleared after update

### DELETE `/api/admin/settings/services/[id]`

Delete service configuration.

**Permissions Required:** `SUPERADMIN` or `ADMIN`

**Response:**
```json
{
  "success": true,
  "message": "Service configuration deleted"
}
```

**AI Agent Usage:**
- After deletion, `ServiceConfigResolver` will fallback to ENV or Default
- Cache is automatically cleared

## 🔌 Connection Testing

### POST `/api/admin/settings/services/[id]/test`

Test connection to external service.

**Permissions Required:** `SUPERADMIN` or `ADMIN`

**Response:**
```json
{
  "success": true,
  "latency": 45, // milliseconds
  "version": "7.0.0",
  "details": {
    "usedMemory": "1.00M",
    "ping": "PONG"
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Connection refused",
  "latency": 5000
}
```

**AI Agent Usage:**
- Tests actual connection using appropriate connector (Redis, PostgreSQL, S3, etc.)
- Returns latency and version information if available
- Used in admin UI to verify configurations before enabling

## 🎛️ Service Control

### POST `/api/admin/settings/services/[id]/toggle`

Toggle service enabled/disabled status.

**Permissions Required:** `SUPERADMIN` or `ADMIN`

**Response:**
```json
{
  "id": "service-id",
  "enabled": true,
  "updatedAt": "2025-01-01T01:00:00.000Z"
}
```

**AI Agent Usage:**
- When disabled, `ServiceConfigResolver` will ignore this configuration
- Falls back to ENV or Default automatically
- Cache is automatically cleared

## 📊 Service Status

### GET `/api/admin/settings/services/status`

Get connection status of all enabled services.

**Permissions Required:** `SUPERADMIN` or `ADMIN`

**Response:**
```json
{
  "redis": {
    "status": "connected",
    "latency": 12,
    "source": "admin"
  },
  "postgresql": {
    "status": "connected",
    "latency": 5,
    "source": "env"
  },
  "prometheus": {
    "status": "disconnected",
    "error": "Connection timeout",
    "source": "default"
  }
}
```

**AI Agent Usage:**
- Shows overall health of all external services
- Useful for monitoring dashboard
- Tests connections for all enabled services

## 🔑 Encryption

All sensitive credentials (passwords, tokens, API keys) are encrypted using AES-256-GCM before storage in the database.

**Requirements:**
- `CREDENTIALS_ENCRYPTION_KEY` must be set in environment variables
- Key must be 32 bytes (64 hex characters)

**Generate Encryption Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📝 Service-Specific Configuration

### Redis
- **Default**: `redis://localhost:6379`
- **ENV Variable**: `REDIS_URL`
- **Metadata**: None required

### PostgreSQL
- **Default**: `postgresql://user:password@localhost:5432/database`
- **ENV Variable**: `DATABASE_URL`
- **Metadata**: `{"database": "dbname", "rejectUnauthorized": true}`

### S3 (AWS/MinIO/Custom)
- **Default**: `http://localhost:9000`
- **ENV Variable**: `S3_ENDPOINT`
- **Metadata**: 
```json
{
  "accessKeyId": "AKIA...",
  "secretAccessKey": "wJalr...",
  "region": "us-east-1",
  "bucket": "my-bucket",
  "forcePathStyle": false
}
```

### Prometheus
- **Default**: `http://localhost:9090`
- **ENV Variable**: `PROMETHEUS_URL`

### Loki
- **Default**: `http://localhost:3100`
- **ENV Variable**: `LOKI_URL`

### Grafana
- **Default**: `http://localhost:3001`
- **ENV Variable**: `GRAFANA_URL`

### Sentry
- **Default**: None
- **ENV Variable**: `SENTRY_DSN` or `GLITCHTIP_DSN`
- **Metadata**: Can store token/DSN in `url` or `apiKey` field

### SMTP
- **Default**: `smtp://localhost:1025`
- **ENV Variable**: `SMTP_URL`
- **Connector**: `SMTPConnector`
- **Authentication**: Basic Auth (LOGIN), OAuth2
- **Metadata options**:
  - `secure` - использовать SSL/TLS (автоматически true для порта 465)
  - `ignoreTLS` - игнорировать STARTTLS
  - `requireTLS` - требовать STARTTLS
  - `connectionTimeout` - таймаут подключения (мс)
  - `greetingTimeout` - таймаут приветствия (мс)
  - `from` - email отправителя для тестового письма
  - `pool` - использовать пул соединений
  - `maxConnections` - максимум соединений в пуле

**Test Connection Response**:
```json
{
  "success": true,
  "latency": 120,
  "details": {
    "host": "smtp.example.com",
    "port": 587,
    "secure": false,
    "authMethod": "LOGIN",
    "tls": true
  }
}
```

**Supported Providers**: SendGrid, Mailgun, AWS SES, Postmark, Gmail, Outlook, любой SMTP-сервер

### Elasticsearch
- **Default**: `http://localhost:9200`
- **ENV Variable**: `ELASTICSEARCH_URL`
- **Connector**: `ElasticsearchConnector`
- **Authentication**: Basic Auth, API Key, Bearer Token, TLS Certificate
- **Metadata options**:
  - `index` - Test index name for verification
  - `apiKeyId` - API Key ID (alternative to username/password)
  - `apiKey` - API Key value (encrypted)
  - `caFingerprint` - CA fingerprint for TLS

**Test Connection Response**:
```json
{
  "success": true,
  "latency": 45,
  "version": "8.11.0",
  "details": {
    "clusterName": "my-cluster",
    "clusterHealth": "green",
    "numberOfNodes": 3,
    "activeShards": 150,
    "indicesCount": 25,
    "documentsCount": 1500000,
    "storageSize": "2.5 GB"
  }
}
```

## 🔄 Integration with ServiceConfigResolver

The `ServiceConfigResolver` is used throughout the application to get service configurations:

```typescript
import { serviceConfigResolver } from '@/lib/config'

// Get Redis configuration
const redisConfig = await serviceConfigResolver.getConfig('redis')
console.log(redisConfig.source) // 'admin' | 'env' | 'default'
console.log(redisConfig.url)    // 'redis://localhost:6379'

// Get only URL
const redisUrl = await serviceConfigResolver.getServiceUrl('redis')

// Clear cache after admin panel changes
serviceConfigResolver.clearCache('redis')
```

## 📊 Events

The API automatically logs events using `EventService`:

- `service_configuration.created` - When new service is created
- `service_configuration.updated` - When service is updated
- `service_configuration.deleted` - When service is deleted
- `service_configuration.test_success` - When connection test succeeds
- `service_configuration.test_failed` - When connection test fails
- `service_configuration.enabled` - When service is enabled
- `service_configuration.disabled` - When service is disabled

## 🧪 Testing

Integration tests are available at:
- `tests/integration/config/service-configuration-api.integration.test.ts`

Run tests:
```bash
pnpm test:integration -- tests/integration/config/
```

## 💡 Usage Examples

### Example 1: Get Redis Configuration

```typescript
import { serviceConfigResolver } from '@/lib/config'

// Get Redis configuration
const redisConfig = await serviceConfigResolver.getConfig('redis')

console.log('Source:', redisConfig.source) // 'admin' | 'env' | 'default'
console.log('URL:', redisConfig.url)       // 'redis://localhost:6379'

// Use in Redis client
import Redis from 'ioredis'
const redis = new Redis(redisConfig.url, {
  tls: redisConfig.tls ? {} : undefined
})
```

### Example 2: Update Configuration via API

```typescript
// Create a new Redis configuration
const response = await fetch('/api/admin/settings/services', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: 'redis',
    host: 'production-redis.example.com',
    port: 6379,
    protocol: 'redis://',
    username: 'admin',
    password: 'secret-password',
    tlsEnabled: true,
    enabled: true
  })
})

const service = await response.json()
console.log('Created service:', service.id)

// Test connection
const testResponse = await fetch(`/api/admin/settings/services/${service.id}/test`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
})

const testResult = await testResponse.json()
console.log('Connection test:', testResult.success) // true | false
```

### Example 3: Integration with Existing Code

```typescript
// Before: Direct env access
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

// After: Using ServiceConfigResolver
import { serviceConfigResolver } from '@/lib/config'

const redisConfig = await serviceConfigResolver.getConfig('redis')
const redisUrl = redisConfig.url || 'redis://localhost:6379'

// Log source for debugging
logger.info('Using Redis config', { source: redisConfig.source })
```

### Example 4: Clear Cache After Admin Update

```typescript
// After updating configuration in admin panel
import { serviceConfigResolver } from '@/lib/config'

// Clear cache to force reload from database
serviceConfigResolver.clearCache('redis')

// Next call will fetch from database
const newConfig = await serviceConfigResolver.getConfig('redis')
```

### Example 5: Check Configuration Source

```typescript
import { serviceConfigResolver } from '@/lib/config'

// Check if service is configured in admin panel
const isConfigured = await serviceConfigResolver.isConfiguredInAdmin('redis')

if (isConfigured) {
  console.log('Using admin panel configuration')
} else {
  console.log('Using environment variable or default')
}

// Get all services status
const status = await serviceConfigResolver.getAllServicesStatus()
console.log('Redis source:', status.redis.source)
console.log('Redis configured:', status.redis.configured)
```

## 📚 Related Documentation

- [Service Configuration Module](../../ROOT_FILES_DESCRIPTION.md#-модуль-конфигурация-внешних-сервисов-добавлено-2025-11-25)
- [Admin Guide: External Services](../admin/external-services.md)
- [Encryption Configuration](../configuration/authentication.md#encryption)

