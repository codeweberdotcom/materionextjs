# Email System API Documentation

## 📋 Overview

The email system provides comprehensive email functionality with advanced security features, scheduling, and delivery tracking. Built on top of Nodemailer with extensions for DKIM signing, S/MIME encryption, and webhook notifications.

## 🏗️ Architecture

### Components
- **Core**: Nodemailer for SMTP transport
- **Security**: DKIM signing and S/MIME encryption
- **Scheduling**: Cron-based email queue system
- **Tracking**: Webhook notifications for delivery events
- **Templates**: HTML templates with variable substitution
- **Attachments**: File attachments and embedded images

### Key Files
- `src/utils/email.ts` - Main email utilities and functions
- `smtp-settings.json` - SMTP configuration storage
- `src/app/api/settings/smtp/` - SMTP settings API
- `src/app/api/settings/email-templates/` - Email templates API

## 🔌 Configuration

### SMTP Settings Structure
```json
{
  "host": "smtp.gmail.com",
  "port": "587",
  "username": "user@gmail.com",
  "password": "app-password",
  "encryption": "tls",
  "fromEmail": "user@gmail.com",
  "fromName": "Your App",
  "dkim": {
    "domainName": "yourdomain.com",
    "keySelector": "default",
    "privateKey": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
  },
  "smime": {
    "cert": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
    "passphrase": "certificate-password"
  },
  "webhook": {
    "url": "https://yourapp.com/webhooks/email",
    "secret": "webhook-secret"
  }
}
```

## 📡 Core Functions

### sendEmail(options: ExtendedEmailOptions)
Send email with advanced features.

**Parameters:**
```typescript
interface ExtendedEmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  templateId?: string
  variables?: Record<string, string>
  attachments?: Array<{
    filename: string
    path?: string
    content?: Buffer | string
    contentType?: string
    cid?: string
  }>
  embeddedImages?: Array<{
    filename: string
    path: string
    cid: string
  }>
  dkim?: boolean
  smime?: {
    sign?: boolean
    encrypt?: boolean
    cert?: string
  }
  schedule?: {
    cron: string
    timezone?: string
  }
  webhook?: {
    delivery?: boolean
    bounce?: boolean
    complaint?: boolean
  }
  metadata?: Record<string, any>
}
```

**Example:**
```typescript
// Basic email
await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Hello World</h1>'
})

// Email with attachments
await sendEmail({
  to: 'user@example.com',
  subject: 'Document',
  html: '<p>Please find attached document</p>',
  attachments: [{
    filename: 'document.pdf',
    path: '/path/to/document.pdf'
  }]
})

// Email with embedded images
await sendEmail({
  to: 'user@example.com',
  subject: 'Image Email',
  html: '<img src="cid:logo-image" alt="Logo">',
  embeddedImages: [{
    filename: 'logo.png',
    path: '/path/to/logo.png',
    cid: 'logo-image'
  }]
})

// Scheduled email
await sendEmail({
  to: 'user@example.com',
  subject: 'Scheduled Message',
  html: '<p>This will be sent later</p>',
  schedule: {
    cron: '0 9 * * *' // Every day at 9 AM
  }
})

// Secure email with S/MIME
await sendEmail({
  to: 'user@example.com',
  subject: 'Secure Message',
  html: '<p>Encrypted content</p>',
  smime: {
    sign: true,
    encrypt: true,
    cert: 'recipient-certificate.pem'
  }
})
```

### testSmtpConnection()
Test SMTP connection and configuration.

**Returns:**
```typescript
{
  success: boolean
  message: string
}
```

## 🛡️ Security Features

### DKIM Signing
DomainKeys Identified Mail (DKIM) provides email authentication by cryptographically signing emails.

**Setup:**
1. Generate DKIM key pair for your domain
2. Add public key to DNS as TXT record
3. Configure private key in SMTP settings

**DNS Record Example:**
```
default._domainkey.yourdomain.com IN TXT "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
```

### S/MIME Encryption
Secure/Multipurpose Internet Mail Extensions provides email encryption and digital signatures.

**Certificate Requirements:**
- X.509 certificate for signing
- Private key for signing
- Recipient's certificate for encryption (optional)

**Usage:**
```typescript
// Sign only
smime: { sign: true }

// Encrypt only (requires recipient cert)
smime: { encrypt: true, cert: 'recipient-cert.pem' }

// Both signing and encryption
smime: {
  sign: true,
  encrypt: true,
  cert: 'recipient-cert.pem'
}
```

## 📅 Email Scheduling

### Cron Expressions
Emails can be scheduled using cron expressions:

- `"0 9 * * *"` - Daily at 9:00 AM
- `"0 */2 * * *"` - Every 2 hours
- `"0 9 * * 1"` - Every Monday at 9:00 AM
- `"*/15 * * * *"` - Every 15 minutes

### Queue Management
```typescript
// Get scheduled emails
const queue = getEmailQueue()

// Cancel scheduled email
cancelScheduledEmail(emailId)
```

## 🪝 Webhook Notifications

### Supported Events
- `delivered` - Email successfully delivered
- `bounced` - Email bounced (permanent failure)
- `complained` - Recipient marked as spam

### Webhook Payload
```json
{
  "event": "delivered",
  "email": "user@example.com",
  "messageId": "message-id@domain.com",
  "timestamp": "2024-01-01T10:00:00Z",
  "metadata": {
    "customField": "value"
  }
}
```

### Configuration
```typescript
webhook: {
  delivery: true,
  bounce: true,
  complaint: true
}
```

## 📎 Attachments & Images

### File Attachments
```typescript
attachments: [{
  filename: 'document.pdf',
  path: '/path/to/file.pdf',
  contentType: 'application/pdf'
}]
```

### Embedded Images
```typescript
// HTML content
html: '<img src="cid:logo-image" alt="Logo"> <img src="cid:header-image" alt="Header">'

// Embedded images
embeddedImages: [{
  filename: 'logo.png',
  path: '/path/to/logo.png',
  cid: 'logo-image'
}, {
  filename: 'header.jpg',
  path: '/path/to/header.jpg',
  cid: 'header-image'
}]
```

## 📝 Template System

### Handlebars Templates
The email system now uses **Handlebars** templating engine for advanced template rendering with conditional logic, loops, and custom helpers.

### Basic Variable Substitution
```handlebars
<h1>Welcome {{name}}!</h1>
<p>Thank you for joining us. Your account has been created successfully.</p>
<p>Your email: {{email}}</p>
```

### Conditional Logic
```handlebars
{{#if user.premium}}
  <div class="premium-banner">
    <h3>🎉 Premium Account!</h3>
    <p>You have access to all premium features.</p>
  </div>
{{else}}
  <div class="upgrade-banner">
    <p>Upgrade to premium for additional features!</p>
  </div>
{{/if}}
```

### Loops and Iterations
```handlebars
<h3>Your Order Items:</h3>
<ul>
  {{#each order.items}}
    <li>{{name}} - ${{price}} x {{quantity}}</li>
  {{/each}}
</ul>
```

### Built-in Helpers

#### Comparison Helpers
```handlebars
{{#ifCond attempts ">" 3}}
  <p>⚠️ Multiple attempts detected!</p>
{{/ifCond}}

{{#ifCond status "===" "active"}}
  <p>Account is active</p>
{{/ifCond}}
```

#### String Helpers
```handlebars
<p>Hello {{uppercase name}}!</p>
<p>{{lowercase email}}</p>
```

#### Date Formatting
```handlebars
<p>Registered: {{formatDate createdAt "short"}}</p>
<p>Expires: {{formatDate expiryDate}}</p>
```

### Complex Template Example
```handlebars
<div class="email-container">
  <h1>Welcome {{user.name}}!</h1>

  {{#if user.premium}}
    <div class="premium-notice">
      <h3>🎉 Premium Account Activated!</h3>
      <p>You now have access to:</p>
      <ul>
        {{#each premiumFeatures}}
          <li>{{this}}</li>
        {{/each}}
      </ul>
    </div>
  {{/if}}

  {{#ifCond loginAttempts ">" 5}}
    <div class="warning">
      <p>⚠️ Unusual login activity detected</p>
    </div>
  {{/ifCond}}

  <div class="order-summary">
    <h3>Recent Orders:</h3>
    {{#each orders}}
      <div class="order">
        <p>Order #{{id}} - {{formatDate date "short"}}</p>
        <p>Total: ${{total}}</p>
        <p>Status: {{uppercase status}}</p>
      </div>
    {{/each}}
  </div>

  <div class="actions">
    <a href="{{loginUrl}}" class="btn">Login Now</a>
    <a href="{{supportUrl}}" class="btn-secondary">Contact Support</a>
  </div>

  <p class="footer">
    © {{year}} {{companyName}}. All rights reserved.
  </p>
</div>
```

**Usage:**
```typescript
await sendEmail({
  templateId: 'welcome-email',
  variables: {
    name: 'John Doe',
    email: 'john@example.com',
    user: {
      name: 'John Doe',
      premium: true,
      profile: { avatar: '/avatar.jpg' }
    },
    premiumFeatures: ['Priority Support', 'Advanced Analytics'],
    loginAttempts: 2,
    orders: [
      { id: '123', date: '2024-01-01', total: 99.99, status: 'completed' }
    ],
    loginUrl: 'https://app.com/login',
    supportUrl: 'https://app.com/support',
    year: new Date().getFullYear(),
    companyName: 'Your Company'
  }
})
```

## 🔧 Certificate Management

### Loading Certificates
```typescript
// Load from file
const cert = loadCertificate('/path/to/cert.pem')
const key = loadPrivateKey('/path/to/key.pem')

// Use in configuration
const smtpConfig = {
  smime: {
    cert: cert,
    key: key,
    passphrase: 'certificate-password'
  }
}
```

### Certificate Formats
- **PEM**: Base64 encoded with `-----BEGIN/END CERTIFICATE-----`
- **DER**: Binary format (less common for email)
- **PFX/P12**: Password-protected container format

## 📊 Monitoring & Logging

### Email Queue Status
```typescript
const queue = getEmailQueue()
// Returns array of scheduled emails with status
```

### SMTP Connection Testing
```typescript
const result = await testSmtpConnection()
console.log(result.message) // "SMTP connection successful"
```

### Delivery Tracking
- Webhook events logged automatically
- Email queue status monitoring
- Failed email retry logic

## 🚀 Advanced Usage

### Bulk Email Sending
```typescript
const recipients = ['user1@example.com', 'user2@example.com']
const promises = recipients.map(email =>
  sendEmail({
    to: email,
    subject: 'Bulk Message',
    html: '<p>Personalized content</p>',
    variables: { recipient: email }
  })
)
await Promise.all(promises)
```

### Conditional Encryption
```typescript
const shouldEncrypt = user.preferences.encryptEmails

await sendEmail({
  to: user.email,
  subject: 'Secure Message',
  html: content,
  smime: shouldEncrypt ? {
    sign: true,
    encrypt: true,
    cert: user.certificate
  } : undefined
})
```

### Email Campaigns
```typescript
// Schedule email campaign
const campaignEmails = users.map((user, index) =>
  sendEmail({
    to: user.email,
    subject: 'Campaign Message',
    templateId: 'campaign-template',
    variables: { userName: user.name },
    schedule: {
      cron: `0 ${9 + Math.floor(index / 100)} * * *` // Stagger sending
    },
    webhook: {
      delivery: true,
      bounce: true
    },
    metadata: {
      campaignId: 'summer-2024',
      userId: user.id
    }
  })
)
```

## 🔍 Troubleshooting

### Common Issues

1. **DKIM Signing Fails**
   - Verify private key format
   - Check DNS TXT record
   - Ensure domain matches email domain

2. **S/MIME Encryption Fails**
   - Verify certificate validity
   - Check certificate chain
   - Ensure recipient certificate is correct

3. **Scheduled Emails Not Sending**
   - Check cron expression syntax
   - Verify server timezone
   - Check email queue status

4. **Webhook Not Receiving Events**
   - Verify webhook URL accessibility
   - Check webhook secret
   - Review server logs for delivery attempts

### Debug Commands
```bash
# Test SMTP connection
const result = await testSmtpConnection()
console.log('SMTP Test:', result)

# Check email queue
console.log('Email Queue:', getEmailQueue())

# Verify certificate loading
try {
  const cert = loadCertificate('/path/to/cert.pem')
  console.log('Certificate loaded successfully')
} catch (error) {
  console.error('Certificate error:', error)
}
```

## 📚 API Reference

### Functions
- `sendEmail(options)` - Send email with advanced features
- `testSmtpConnection()` - Test SMTP configuration
- `getEmailQueue()` - Get scheduled emails
- `cancelScheduledEmail(id)` - Cancel scheduled email
- `loadCertificate(path)` - Load certificate from file
- `loadPrivateKey(path)` - Load private key from file

### Types
- `SmtpConfig` - SMTP configuration interface
- `ExtendedEmailOptions` - Extended email options
- `Attachment` - Attachment interface
- `EmbeddedImage` - Embedded image interface

---

*This documentation covers the comprehensive email system with security, scheduling, and advanced features.*
