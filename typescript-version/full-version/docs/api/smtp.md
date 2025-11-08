# SMTP Configuration API Documentation

## 📋 Overview

The SMTP configuration system provides comprehensive email server management with secure credential storage, connection testing, and email sending capabilities. It supports multiple SMTP providers and advanced security features for reliable email delivery.

## 🏗️ Architecture

### Components
- **SMTP Settings API**: Configuration management endpoints
- **Connection Testing**: Real-time SMTP validation
- **Test Email Sending**: Functional verification
- **File-based Storage**: JSON configuration persistence
- **Environment Fallback**: Environment variable support

### Key Files
- `src/app/api/settings/smtp/route.ts` - Main SMTP configuration
- `src/app/api/settings/smtp/test/route.ts` - Connection testing
- `src/app/api/settings/smtp/send-test/route.ts` - Test email sending
- `smtp-settings.json` - Configuration storage
- `src/utils/email.ts` - Email utilities integration

## 🔌 SMTP Configuration Structure

### Settings Format
```json
{
  "host": "smtp.gmail.com",
  "port": "587",
  "username": "user@gmail.com",
  "password": "app-password",
  "encryption": "tls",
  "fromEmail": "user@gmail.com",
  "fromName": "Your App Name",
  "updatedAt": "2024-01-01T10:00:00Z"
}
```

### Supported Providers
- **Gmail**: smtp.gmail.com:587 (TLS) or 465 (SSL)
- **Outlook**: smtp-mail.outlook.com:587 (TLS)
- **Yahoo**: smtp.mail.yahoo.com:587 (TLS)
- **SendGrid**: smtp.sendgrid.net:587 (TLS)
- **Mailgun**: smtp.mailgun.org:587 (TLS)
- **AWS SES**: email-smtp.region.amazonaws.com:587 (TLS)

## 📡 API Endpoints

### GET `/api/settings/smtp`
Get current SMTP configuration (admin only).

**Permissions Required:** `smtpManagement.read`

**Response:**
```json
{
  "host": "smtp.gmail.com",
  "port": "587",
  "username": "user@gmail.com",
  "password": "***provided***",
  "encryption": "tls",
  "fromEmail": "user@gmail.com",
  "fromName": "Your App Name"
}
```

**AI Agent Usage:**
- Load current SMTP settings for display
- Check if configuration exists
- Validate settings before operations

### POST `/api/settings/smtp`
Save SMTP configuration (admin only).

**Permissions Required:** `smtpManagement.update`

**Request Body:**
```json
{
  "host": "smtp.gmail.com",
  "port": "587",
  "username": "user@gmail.com",
  "password": "app-password",
  "encryption": "tls",
  "fromEmail": "user@gmail.com",
  "fromName": "Your App Name"
}
```

**Response:**
```json
{
  "message": "SMTP settings saved successfully"
}
```

**AI Agent Usage:**
- Update SMTP configuration
- Save new provider settings
- Modify connection parameters

### POST `/api/settings/smtp/test`
Test SMTP connection (admin only).

**Permissions Required:** `smtpManagement.update`

**Request Body:**
```json
{
  "host": "smtp.gmail.com",
  "port": "587",
  "username": "user@gmail.com",
  "password": "app-password",
  "encryption": "tls"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "SMTP connection successful"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "message": "Authentication failed"
}
```

**AI Agent Usage:**
- Validate SMTP credentials before saving
- Test connection after configuration changes
- Troubleshoot email delivery issues

### POST `/api/settings/smtp/send-test`
Send test email to verify configuration (admin only).

**Permissions Required:** `smtpManagement.update`

**Request Body:**
```json
{
  "host": "smtp.gmail.com",
  "port": "587",
  "username": "user@gmail.com",
  "password": "app-password",
  "encryption": "tls",
  "fromEmail": "user@gmail.com",
  "fromName": "Your App Name",
  "recipientEmail": "test@example.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Test email sent successfully"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "message": "Failed to send test email: Invalid credentials"
}
```

**AI Agent Usage:**
- End-to-end testing of email configuration
- Verify email delivery works
- Test with different recipient addresses

## 🗄️ Configuration Storage

### File-based Storage (Demo)
```json
// smtp-settings.json
{
  "host": "smtp.gmail.com",
  "port": "587",
  "username": "user@gmail.com",
  "password": "encrypted-password",
  "encryption": "tls",
  "fromEmail": "noreply@yourapp.com",
  "fromName": "Your App",
  "updatedAt": "2024-01-01T10:00:00Z"
}
```

### Production Database Schema
```prisma
model SmtpConfig {
  id          String   @id @default(cuid())
  host        String
  port        Int
  username    String
  password    String   // Encrypted
  encryption  String   @default("tls")
  fromEmail   String
  fromName    String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Environment Variables (Fallback)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=user@gmail.com
SMTP_PASSWORD=app-password
SMTP_ENCRYPTION=tls
SMTP_FROM_EMAIL=noreply@yourapp.com
SMTP_FROM_NAME=Your App
```

## 🛡️ Security Features

### Credential Protection
- **Password Masking**: Passwords never returned in API responses
- **File Permissions**: Secure file access controls
- **Environment Variables**: Sensitive data in env vars
- **Access Control**: Role-based permissions

### Connection Security
- **TLS Encryption**: Secure transport layer
- **SSL Support**: Legacy SSL connections
- **Certificate Validation**: Server certificate verification
- **Authentication**: Username/password validation

## 🚀 Usage Examples

### Configure Gmail SMTP
```typescript
const response = await fetch('/api/settings/smtp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    host: 'smtp.gmail.com',
    port: '587',
    username: 'your-email@gmail.com',
    password: 'your-app-password',
    encryption: 'tls',
    fromEmail: 'your-email@gmail.com',
    fromName: 'Your App Name'
  })
})
```

### Test Connection Before Saving
```typescript
// Test connection
const testResult = await fetch('/api/settings/smtp/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    host: 'smtp.gmail.com',
    port: '587',
    username: 'your-email@gmail.com',
    password: 'your-app-password',
    encryption: 'tls'
  })
})

if (testResult.success) {
  // Save configuration
  await fetch('/api/settings/smtp', {
    method: 'POST',
    body: JSON.stringify(smtpConfig)
  })
}
```

### Send Test Email
```typescript
const response = await fetch('/api/settings/smtp/send-test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    host: 'smtp.gmail.com',
    port: '587',
    username: 'your-email@gmail.com',
    password: 'your-app-password',
    encryption: 'tls',
    fromEmail: 'your-email@gmail.com',
    fromName: 'Your App Name',
    recipientEmail: 'test@example.com'
  })
})
```

### Load Current Configuration
```typescript
const config = await fetch('/api/settings/smtp')
const settings = await config.json()
// Password will be masked as "***provided***"
```

## 🔧 Gmail Setup Guide

### 1. Enable 2-Factor Authentication
- Go to Google Account settings
- Enable 2-Step Verification

### 2. Generate App Password
- Visit Google App Passwords
- Select "Mail" and "Other (custom name)"
- Generate and copy the 16-character password

### 3. Configure SMTP Settings
```json
{
  "host": "smtp.gmail.com",
  "port": "587",
  "username": "your-email@gmail.com",
  "password": "abcd-efgh-ijkl-mnop", // App password
  "encryption": "tls",
  "fromEmail": "your-email@gmail.com",
  "fromName": "Your App Name"
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify app password (not regular password)
   - Check 2FA is enabled
   - Ensure app password is correct

2. **Connection Timeout**
   - Check firewall settings
   - Verify port accessibility
   - Try different ports (587 vs 465)

3. **TLS Errors**
   - Ensure encryption is set correctly
   - Check server certificate validity
   - Try SSL instead of TLS

4. **Rate Limiting**
   - Gmail limits: 500 emails/day for free accounts
   - Check sending limits for your provider
   - Implement queuing for bulk emails

### Debug Commands
```bash
# Test SMTP connection manually
telnet smtp.gmail.com 587

# Check if port is open
nc -zv smtp.gmail.com 587

# View saved configuration
cat smtp-settings.json
```

## 🤖 AI Agent Integration Guide

### Core Workflow for AI Agents

1. **Configuration Management**
   ```typescript
   // Load current settings
   const settings = await fetch('/api/settings/smtp')

   // Update configuration
   await fetch('/api/settings/smtp', {
     method: 'POST',
     body: JSON.stringify(newConfig)
   })

   // Test connection
   const test = await fetch('/api/settings/smtp/test', {
     method: 'POST',
     body: JSON.stringify(testConfig)
   })
   ```

2. **Email Testing**
   ```typescript
   // Send test email
   const result = await fetch('/api/settings/smtp/send-test', {
     method: 'POST',
     body: JSON.stringify({
       ...smtpConfig,
       recipientEmail: 'test@example.com'
     })
   })

   if (result.success) {
     console.log('SMTP configuration verified')
   }
   ```

3. **Provider Setup**
   ```typescript
   // Gmail setup
   const gmailConfig = {
     host: 'smtp.gmail.com',
     port: '587',
     encryption: 'tls',
     // ... credentials
   }

   // Outlook setup
   const outlookConfig = {
     host: 'smtp-mail.outlook.com',
     port: '587',
     encryption: 'tls',
     // ... credentials
   }
   ```

### Error Handling for AI Agents

- **401 Unauthorized**: Check user permissions
- **400 Bad Request**: Validate required fields
- **Connection Failed**: Verify credentials and network
- **Send Failed**: Check recipient email and spam filters

### Best Practices

- **Test Before Save**: Always test connection before saving
- **Secure Storage**: Never log passwords in plain text
- **Provider Selection**: Choose provider based on sending volume
- **Monitoring**: Implement email delivery monitoring
- **Backup Config**: Keep backup of working configurations

---

*This documentation is designed for AI agents to understand and maintain the SMTP configuration system functionality.*