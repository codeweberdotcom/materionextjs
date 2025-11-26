# External Services Configuration - Admin Guide

## 📋 Overview

This guide explains how to configure and manage external services (Redis, PostgreSQL, Prometheus, Loki, Grafana, Sentry, S3, SMTP, Elasticsearch) through the admin panel.

## 🎯 Purpose

The External Services module allows you to:
- Configure connections to external services without code changes
- Manage credentials securely (encrypted in database)
- Test connections before enabling services
- Switch between local Docker containers and production servers
- Monitor service connection status

## 🏁 Getting Started

### Access the Module

1. Log in to the admin panel
2. Navigate to **Admin & Settings** → **External Services**
3. URL: `/admin/settings/services`

### Requirements

- **Role**: `SUPERADMIN` or `ADMIN`
- **Encryption Key**: Must be configured in environment variables (`ENCRYPTION_KEY`)

## 🔄 Configuration Priority

The system uses a priority order when resolving service configurations:

```
1️⃣ Admin Panel (Database)  →  2️⃣ Environment Variables  →  3️⃣ Default (Docker)
```

**Example:**
- If Redis is configured in the admin panel → uses admin panel config
- If not in admin panel but `REDIS_URL` is set → uses environment variable
- If neither exists → uses default Docker configuration (`redis://localhost:6379`)

## 📝 Adding a Service Configuration

### Step 1: Navigate to Services Page

Go to `/admin/settings/services` in the admin panel.

### Step 2: Click "Add Service"

Click the **"Add Service"** button at the top right.

### Step 3: Fill in Service Details

#### Basic Information
- **Service Type**: Select from dropdown (Redis, PostgreSQL, Prometheus, etc.)
- **Host**: Server hostname or IP address
- **Port**: Server port number
- **Protocol**: Connection protocol (`http://`, `https://`, `redis://`, etc.)

#### Authentication
- **Username**: Optional username
- **Password**: Optional password (will be encrypted automatically)
- **Token/API Key**: Optional token or API key (will be encrypted)

#### Security
- **TLS Enabled**: Enable/disable TLS encryption
- **Enabled**: Enable/disable this configuration

#### Advanced (Metadata)
- **Metadata**: JSON string with service-specific configuration
  - For S3: `{"region": "us-east-1", "bucket": "my-bucket", "forcePathStyle": false}`
  - For PostgreSQL: `{"database": "dbname", "rejectUnauthorized": true}`

### Step 4: Test Connection (Recommended)

Before enabling, click the **"Test"** button to verify the connection:
- ✅ **Success**: Shows latency, version, and connection details
- ❌ **Failure**: Shows error message to help troubleshoot

### Step 5: Save Configuration

Click **"Save"** to create the configuration.

## 🔧 Service-Specific Guides

### Redis

**Basic Configuration:**
- **Host**: `redis.example.com`
- **Port**: `6379`
- **Protocol**: `redis://` or `rediss://` (for TLS)
- **Username**: (optional)
- **Password**: (optional)
- **TLS Enabled**: Check if using `rediss://`

**Use Cases:**
- Bull queue backend
- Rate limiting storage
- Role caching
- Socket.IO adapter (for scaling)

### PostgreSQL

**Basic Configuration:**
- **Host**: `postgres.example.com`
- **Port**: `5432`
- **Protocol**: `postgresql://`
- **Username**: `postgres`
- **Password**: Database password
- **Metadata**: `{"database": "mydb"}`

**Use Cases:**
- Primary database connection
- Backup/replica connections

### S3 (AWS/MinIO/Custom)

**Basic Configuration:**
- **Host**: `s3.amazonaws.com` or `minio.example.com`
- **Port**: `443` (AWS) or `9000` (MinIO)
- **Protocol**: `https://` or `http://`
- **TLS Enabled**: Check for HTTPS

**Metadata Required:**
```json
{
  "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
  "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "region": "us-east-1",
  "bucket": "my-bucket",
  "forcePathStyle": false
}
```

**For Custom S3 (MinIO, DigitalOcean Spaces, etc.):**
- Set `forcePathStyle: true` in metadata
- Use custom endpoint in Host field

**Use Cases:**
- File uploads
- Static assets
- Backups

### Prometheus

**Basic Configuration:**
- **Host**: `prometheus.example.com`
- **Port**: `9090`
- **Protocol**: `http://` or `https://`
- **TLS Enabled**: Check for HTTPS

**Use Cases:**
- Metrics collection
- Monitoring dashboard

### Loki

**Basic Configuration:**
- **Host**: `loki.example.com`
- **Port**: `3100`
- **Protocol**: `http://` or `https://`
- **TLS Enabled**: Check for HTTPS

**Use Cases:**
- Log aggregation
- Log querying

### Grafana

**Basic Configuration:**
- **Host**: `grafana.example.com`
- **Port**: `3001`
- **Protocol**: `http://` or `https://`
- **TLS Enabled**: Check for HTTPS

**Use Cases:**
- Data visualization
- Dashboards

### Sentry

**Basic Configuration:**
- **Host**: `sentry.io` or custom Sentry instance
- **Protocol**: `https://`
- **Token/API Key**: Sentry DSN or API token

**Metadata:**
- Can store DSN in `url` field
- Or API token in `token` field

**Use Cases:**
- Error tracking
- Performance monitoring

### SMTP

**Basic Configuration:**
- **Host**: `smtp.gmail.com` or `mail.example.com`
- **Port**: `587` (TLS) or `465` (SSL)
- **Protocol**: `smtp://`
- **Username**: Email username
- **Password**: Email password
- **TLS Enabled**: Check for TLS/STARTTLS

**Use Cases:**
- Email notifications
- Transactional emails

### Elasticsearch

**Basic Configuration:**
- **Host**: `elasticsearch.example.com`
- **Port**: `9200`
- **Protocol**: `http://` or `https://`
- **TLS Enabled**: Check for HTTPS

**Use Cases:**
- Search functionality
- Log indexing

## 🔍 Testing Connections

### Before Enabling

Always test connections before enabling a service configuration:

1. Fill in service details
2. Click **"Test Connection"** button
3. Wait for result:
   - ✅ **Success**: Shows connection details and latency
   - ❌ **Failure**: Shows error message

### Common Issues

**Connection Refused:**
- Check host and port
- Verify firewall rules
- Ensure service is running

**Authentication Failed:**
- Verify username and password
- Check credentials are correct
- For S3, verify access keys

**TLS Errors:**
- Check "TLS Enabled" checkbox matches protocol
- Verify SSL certificate validity
- For PostgreSQL, adjust `rejectUnauthorized` in metadata

## 🔄 Managing Services

### Enable/Disable

Click the toggle button to enable/disable a service configuration:
- **Enabled**: Service will be used by `ServiceConfigResolver`
- **Disabled**: Service will be ignored, falls back to ENV or Default

### Edit Configuration

1. Click on a service in the list
2. Modify fields as needed
3. Click **"Save"**

**Note**: Changing password/token will re-encrypt automatically.

### Delete Configuration

1. Click on a service in the list
2. Click **"Delete"** button
3. Confirm deletion

**Warning**: After deletion, the system will fall back to ENV or Default configuration.

## 📊 Monitoring Status

### Connection Status Indicators

The services list shows connection status:
- 🟢 **Connected**: Service is reachable and responding
- 🔴 **Disconnected**: Service is unreachable
- 🟡 **Error**: Connection test failed

### Status Endpoint

Use `/api/admin/settings/services/status` to get overall status of all enabled services.

## 🔐 Security Best Practices

### Credentials Management

1. **Never share credentials**: Use encrypted storage
2. **Rotate regularly**: Update passwords/tokens periodically
3. **Use separate credentials**: Different credentials for dev/staging/production
4. **Limit access**: Only admins can configure services

### Encryption

All passwords, tokens, and API keys are automatically encrypted using AES-256-GCM before storage.

**Requirements:**
- `ENCRYPTION_KEY` must be set in environment variables
- Key must be 32 bytes (64 hex characters)

**Generate Key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🔄 Environment Variables Fallback

If a service is not configured in the admin panel, the system will use environment variables:

### Redis
```env
REDIS_URL=redis://user:pass@redis.example.com:6379
REDIS_TLS=true
```

### PostgreSQL
```env
DATABASE_URL=postgresql://user:pass@postgres.example.com:5432/dbname
```

### S3
```env
S3_ENDPOINT=http://s3.example.com:9000
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=wJalr...
S3_REGION=us-east-1
S3_BUCKET=my-bucket
```

### Prometheus
```env
PROMETHEUS_URL=http://prometheus.example.com:9090
```

### Sentry
```env
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/1234567
```

## 🐛 Troubleshooting

### Service Not Connecting

1. **Check Configuration**:
   - Verify host, port, and protocol
   - Check TLS settings match protocol
   - Verify credentials are correct

2. **Test Connection**:
   - Use "Test Connection" button
   - Check error message for details

3. **Check Logs**:
   - Application logs show connection attempts
   - Look for authentication errors

### Configuration Not Taking Effect

1. **Clear Cache**:
   - ServiceConfigResolver caches configurations for 1 minute
   - Wait for cache to expire, or restart application

2. **Check Priority**:
   - Admin config takes priority over ENV
   - Disable admin config to use ENV

3. **Verify Enabled Status**:
   - Only enabled configurations are used
   - Check toggle button status

### Encryption Errors

If you see encryption errors:

1. **Verify ENCRYPTION_KEY**:
   ```bash
   echo $ENCRYPTION_KEY
   ```

2. **Generate New Key** (if missing):
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Update Existing Configs**:
   - Delete and recreate configurations
   - Credentials will be re-encrypted

## 📚 Related Documentation

- [API Documentation](../api/service-configuration.md)
- [Service Configuration Module](../../ROOT_FILES_DESCRIPTION.md#-модуль-конфигурация-внешних-сервисов-добавлено-2025-11-25)
- [Monitoring Setup](../monitoring/monitoring-stack.md)

## 💡 Tips

- **Test First**: Always test connections before enabling
- **Start with Defaults**: Use Docker defaults for local development
- **Use ENV for Staging**: Environment variables work well for staging
- **Admin Panel for Production**: Use admin panel for production flexibility
- **Monitor Status**: Regularly check service connection status
- **Backup Configs**: Export/backup configurations before major changes

## 📖 Usage Examples

### Example 1: Setting Up Redis for Production

**Scenario**: You need to configure Redis for a production environment.

1. Navigate to `/admin/settings/services`
2. Click "Add Service"
3. Fill in the form:
   - **Service Type**: Redis
   - **Host**: `prod-redis.example.com`
   - **Port**: `6379`
   - **Protocol**: `redis://`
   - **Username**: `admin` (optional)
   - **Password**: `your-secure-password`
   - **TLS Enabled**: Check if using `rediss://`
   - **Enabled**: Check
4. Click "Test Connection" to verify
5. If test succeeds, click "Save"

**Result**: All Redis-dependent modules (Bull queues, rate limiting, role cache, Socket.IO adapter) will automatically use this configuration.

### Example 2: Switching Between Environments

**Development** (using Docker):
- Leave admin panel empty
- System uses default: `redis://localhost:6379`

**Staging** (using environment variables):
- Add to `.env`: `REDIS_URL=redis://staging-redis.example.com:6379`
- System uses ENV configuration

**Production** (using admin panel):
- Configure in admin panel as shown in Example 1
- System uses admin panel configuration (highest priority)

### Example 3: Configuring Custom S3 Storage

1. Click "Add Service"
2. Fill in:
   - **Service Type**: S3
   - **Host**: `s3.minio.example.com`
   - **Port**: `9000`
   - **Protocol**: `http://` (or `https://`)
   - **TLS Enabled**: Uncheck for HTTP
3. In **Metadata** field, enter:
```json
{
  "accessKeyId": "your-access-key",
  "secretAccessKey": "your-secret-key",
  "region": "us-east-1",
  "bucket": "my-bucket",
  "forcePathStyle": true
}
```
4. Test connection
5. Save

### Example 4: Monitoring Connection Status

1. Go to `/admin/settings/services`
2. Review the status column:
   - 🟢 **Connected**: Service is working
   - 🔴 **Disconnected**: Service unavailable
   - 🟡 **Error**: Connection test failed
3. Click on a service to view details
4. Use "Test Connection" to refresh status

### Example 5: Troubleshooting a Connection Issue

**Problem**: Redis shows "Disconnected" status

1. Click on the Redis service
2. Click "Test Connection"
3. Check the error message:
   - **"Connection refused"**: Check host/port
   - **"Authentication failed"**: Check username/password
   - **"Timeout"**: Check firewall/network
4. Update configuration based on error
5. Test again
6. Enable when test succeeds

