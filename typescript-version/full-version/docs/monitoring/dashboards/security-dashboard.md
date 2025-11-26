# Security Overview Dashboard

**UID:** `materio-security`  
**Файл:** `monitoring/grafana/dashboards/security-dashboard.json`  
**URL:** http://localhost:9091/d/materio-security

---

## 📊 Описание

Дашборд для мониторинга аутентификации и файлового хранилища (S3). Показывает активность пользователей и безопасность системы.

---

## 🏷️ Tags

`security`, `auth`, `authentication`, `s3`, `storage`

---

## 📦 Variables

| Variable | Type | Options | Default |
|----------|------|---------|---------|
| `environment` | custom | All, development, production | All |

---

## 📋 Panels

### Row 1: 🔐 Authentication Overview

| Panel | Type | Metric | Description |
|-------|------|--------|-------------|
| Login Success (5m) | Stat | `auth_login_total{status="success"}` | Успешные входы |
| Login Failed (5m) | Stat | `auth_login_total{status="failed"}` | Неудачные входы |
| Active Sessions | Stat | `auth_active_sessions` | Активные сессии |
| Registrations (5m) | Stat | `auth_registration_total` | Регистрации |
| Password Resets (5m) | Stat | `auth_password_reset_total` | Сбросы пароля |
| Token Refreshes (5m) | Stat | `auth_token_refresh_total` | Обновления токенов |

### Row 2: 📈 Auth Activity

| Panel | Type | Metric | Description |
|-------|------|--------|-------------|
| Logins Over Time | Time Series | `auth_login_total` rate | Входы по времени |
| Login Success Rate | Pie Chart (donut) | `auth_login_total` by status | Успешность входов |
| Logins by Provider | Pie Chart | `auth_login_total` by provider | Входы по провайдерам |

### Row 3: 🔄 Sessions

| Panel | Type | Metric | Description |
|-------|------|--------|-------------|
| Session Duration Distribution | Time Series | `auth_session_duration_seconds` p50/p95 | Длительность сессий |
| Sessions Created/Expired | Time Series | `auth_session_created_total`, `auth_session_expired_total` | Создание/истечение |

### Row 4: 📦 Storage Overview

| Panel | Type | Metric | Description |
|-------|------|--------|-------------|
| Uploads (5m) | Stat | `s3_operations_total{operation="upload"}` | Загрузки файлов |
| Downloads (5m) | Stat | `s3_operations_total{operation="download"}` | Скачивания файлов |
| Storage Errors (5m) | Stat | `s3_errors_total` | Ошибки хранилища |
| Active Uploads | Stat | `s3_active_uploads` | Текущие загрузки |
| Bytes Uploaded (5m) | Stat | `s3_bytes_uploaded_total` | Загружено байт |
| Bytes Downloaded (5m) | Stat | `s3_bytes_downloaded_total` | Скачано байт |

### Row 5: 📈 Storage Activity

| Panel | Type | Metric | Description |
|-------|------|--------|-------------|
| Storage Operations Over Time | Time Series | `s3_operations_total` rate | Операции по времени |
| File Sizes | Time Series | `s3_upload_size_bytes`, `s3_download_size_bytes` | Размеры файлов |

---

## 📊 Используемые метрики

### Authentication Metrics (`src/lib/metrics/auth.ts`)

```typescript
auth_login_total{status, provider, environment}             // Counter
auth_logout_total{environment}                              // Counter
auth_registration_total{status, environment}                // Counter
auth_password_reset_total{status, environment}              // Counter
auth_token_refresh_total{status, environment}               // Counter
auth_session_created_total{provider, environment}           // Counter
auth_session_expired_total{environment}                     // Counter
auth_session_duration_seconds{environment}                  // Histogram
auth_login_duration_seconds{provider, environment}          // Histogram
auth_active_sessions{environment}                           // Gauge
```

### Storage Metrics (`src/lib/metrics/storage.ts`)

```typescript
s3_operations_total{operation, bucket, status, environment} // Counter
s3_errors_total{operation, error_type, environment}         // Counter
s3_bytes_uploaded_total{bucket, environment}                // Counter
s3_bytes_downloaded_total{bucket, environment}              // Counter
s3_operation_duration_seconds{operation, environment}       // Histogram
s3_upload_size_bytes{bucket, environment}                   // Histogram
s3_download_size_bytes{bucket, environment}                 // Histogram
s3_active_uploads{environment}                              // Gauge
s3_active_downloads{environment}                            // Gauge
```

---

## 🔧 Thresholds

| Metric | Yellow | Red |
|--------|--------|-----|
| Login Failed | 5 | 20 |
| Storage Errors | 1 | 5 |
| Active Uploads | 10 | 50 |

