# Email System API

## 📧 Email System

### GET `/api/settings/email-templates`
Get all email templates (admin only).

**Permissions Required:** `emailTemplates.read`

**Response:**
```json
[
  {
    "id": "template-id",
    "name": "welcome",
    "subject": "Welcome to our platform",
    "content": "Welcome {{name}}!",
    "isActive": true
  }
]
```

### POST `/api/settings/email-templates`
Create email template.

**Permissions Required:** `emailTemplates.create`

**Request Body:**
```json
{
  "name": "password-reset",
  "subject": "Reset your password",
  "content": "Click here to reset: {{resetLink}}"
}
```

### GET `/api/settings/email-templates/[id]`
Get email template by ID.

### PUT `/api/settings/email-templates/[id]`
Update email template.

**Permissions Required:** `emailTemplates.update`

### DELETE `/api/settings/email-templates/[id]`
Delete email template.

**Permissions Required:** `emailTemplates.delete`

### POST `/api/email/send`
Send email using template.

**Request Body:**
```json
{
  "templateName": "welcome",
  "to": "user@example.com",
  "variables": {
    "name": "John Doe",
    "company": "ACME Corp"
  }
}
```

## ⚙️ System Settings

### GET `/api/settings/smtp`
Get SMTP settings.

**Permissions Required:** `settings.read`

### PUT `/api/settings/smtp`
Update SMTP settings.

**Permissions Required:** `settings.update`

**Request Body:**
```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "your-email@gmail.com",
    "pass": "your-app-password"
  }
}
```

### POST `/api/settings/smtp/test`
Test SMTP connection.

### POST `/api/settings/smtp/send-test`
Send test email.
