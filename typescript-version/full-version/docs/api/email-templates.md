# Email Templates API Documentation

## 📋 Overview

The email templates system provides comprehensive template management with Handlebars templating engine, variable substitution, and conditional logic. It supports creating, updating, and managing reusable email templates with advanced features like loops, conditionals, and custom helpers.

## 🏗️ Architecture

### Components
- **Template Storage**: In-memory storage with demo templates (should be database in production)
- **Handlebars Engine**: Advanced templating with custom helpers
- **Variable Substitution**: Dynamic content replacement
- **Permission System**: Role-based access control
- **CRUD Operations**: Full create, read, update, delete functionality

### Key Files
- `src/app/api/settings/email-templates/route.ts` - Template collection operations
- `src/app/api/settings/email-templates/[id]/route.ts` - Individual template operations
- `src/utils/email.ts` - Template rendering integration

## 📡 API Endpoints

### GET `/api/settings/email-templates`
Get all email templates (admin only).

**Permissions Required:** `Email Templates.Read`

**Response:**
```json
[
  {
    "id": "1",
    "name": "Welcome Email",
    "subject": "Welcome to our platform, {{name}}!",
    "content": "<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\"><h1 style=\"color: #333;\">Welcome {{name}}!</h1>...</div>",
    "createdAt": "2024-01-01T10:00:00Z",
    "updatedAt": "2024-01-01T10:00:00Z"
  }
]
```

**AI Agent Usage:**
- Load all available templates for admin interface
- Display template list with preview functionality
- Use templates for email composition

### POST `/api/settings/email-templates`
Create new email template (admin only).

**Permissions Required:** `Email Templates.Write`

**Request Body:**
```json
{
  "name": "Newsletter Template",
  "subject": "Monthly Newsletter - {{month}} {{year}}",
  "content": "<div><h1>{{title}}</h1><p>{{content}}</p></div>"
}
```

**Response:**
```json
{
  "id": "4",
  "name": "Newsletter Template",
  "subject": "Monthly Newsletter - {{month}} {{year}}",
  "content": "<div><h1>{{title}}</h1><p>{{content}}</p></div>",
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T10:00:00Z"
}
```

**AI Agent Usage:**
- Create custom email templates with Handlebars syntax
- Store reusable templates for different email types
- Include variable placeholders for dynamic content

### GET `/api/settings/email-templates/{id}`
Get specific email template by ID (admin only).

**Permissions Required:** `Email Templates.Read`

**Response:** Same as individual template object from GET collection

**AI Agent Usage:**
- Fetch template details for editing
- Load template content for preview
- Validate template exists before operations

### PUT `/api/settings/email-templates/{id}`
Update existing email template (admin only).

**Permissions Required:** `Email Templates.Write`

**Request Body:**
```json
{
  "name": "Updated Welcome Email",
  "subject": "Welcome {{name}} - Updated!",
  "content": "<div><h1>Welcome {{name}}!</h1><p>Updated content...</p></div>"
}
```

**Response:**
```json
{
  "id": "1",
  "name": "Updated Welcome Email",
  "subject": "Welcome {{name}} - Updated!",
  "content": "<div><h1>Welcome {{name}}!</h1><p>Updated content...</p></div>",
  "createdAt": "2024-01-01T10:00:00Z",
  "updatedAt": "2024-01-01T10:05:00Z"
}
```

**AI Agent Usage:**
- Modify template content and metadata
- Update subject lines and HTML content
- Maintain template versioning through updatedAt field

### DELETE `/api/settings/email-templates/{id}`
Delete email template (admin only).

**Permissions Required:** `Email Templates.Write`

**Response:**
```json
{
  "message": "Template deleted successfully"
}
```

**AI Agent Usage:**
- Remove unused templates
- Clean up template library
- Ensure template is not in use before deletion

## 📝 Handlebars Template System

### Basic Variable Substitution
```handlebars
<h1>Welcome {{name}}!</h1>
<p>Email: {{email}}</p>
<p>Company: {{company.name}}</p>
```

### Conditional Logic
```handlebars
{{#if user.premium}}
  <div class="premium-banner">
    <h3>🎉 Premium Account!</h3>
  </div>
{{else}}
  <div class="upgrade-banner">
    <p>Upgrade to premium</p>
  </div>
{{/if}}
```

### Loops and Iterations
```handlebars
<h3>Your Orders:</h3>
<ul>
  {{#each orders}}
    <li>Order #{{id}} - ${{total}}</li>
  {{/each}}
</ul>
```

### Built-in Helpers

#### Comparison Helpers
```handlebars
{{#ifCond loginAttempts ">" 3}}
  <p>⚠️ Multiple login attempts detected!</p>
{{/ifCond}}

{{#ifCond status "===" "active"}}
  <p>Account is active</p>
{{/ifCond}}
```

#### String Helpers
```handlebars
<p>Hello {{uppercase firstName}}!</p>
<p>{{lowercase email}}</p>
```

#### Date Formatting
```handlebars
<p>Registered: {{formatDate createdAt "short"}}</p>
<p>Expires: {{formatDate expiryDate}}</p>
```

## 🎯 Core Features

### 1. Template Variables
- **Simple Variables**: `{{name}}`, `{{email}}`
- **Nested Objects**: `{{user.profile.avatar}}`
- **Arrays**: `{{#each items}}...{{/each}}`

### 2. Template Categories
- **Welcome Emails**: User registration confirmations
- **Password Reset**: Security-related communications
- **Order Confirmations**: E-commerce notifications
- **Newsletters**: Marketing communications
- **System Notifications**: Platform updates

### 3. Template Management
- **Version Control**: Updated timestamps
- **Naming Conventions**: Descriptive template names
- **Content Validation**: HTML structure verification
- **Backup**: Template history preservation

## 🗄️ Template Storage

### Current Implementation (Demo)
```typescript
const emailTemplates: any[] = [
  {
    id: '1',
    name: 'Welcome Email',
    subject: 'Welcome to our platform, {{name}}!',
    content: '<div>Welcome {{name}}!</div>',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z'
  }
]
```

### Production Database Schema
```prisma
model EmailTemplate {
  id          String   @id @default(cuid())
  name        String   @unique
  subject     String
  content     String   // HTML with Handlebars
  category    String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## 🛡️ Security Features

### Access Control
- **Permission Checks**: Role-based template access
- **User Validation**: Session verification
- **Input Sanitization**: Template content validation
- **Audit Trail**: Template modification logging

### Content Security
- **HTML Validation**: Template structure verification
- **Variable Sanitization**: Safe variable substitution
- **Script Prevention**: XSS protection in templates

## 🚀 Usage Examples

### Create Welcome Email Template
```typescript
const response = await fetch('/api/settings/email-templates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Welcome Email',
    subject: 'Welcome {{name}} to {{companyName}}!',
    content: `
      <div style="font-family: Arial, sans-serif;">
        <h1>Welcome {{name}}!</h1>
        <p>Thank you for joining {{companyName}}.</p>
        <p>Your account is now active.</p>
        <a href="{{loginUrl}}">Login to your account</a>
      </div>
    `
  })
})
```

### Update Template with Advanced Logic
```typescript
const response = await fetch(`/api/settings/email-templates/${templateId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: `
      <div>
        {{#if user.premium}}
          <h1>🎉 Welcome Premium Member {{user.name}}!</h1>
          <p>You have access to all premium features.</p>
        {{else}}
          <h1>Welcome {{user.name}}!</h1>
          <p>Upgrade to premium for additional features.</p>
        {{/if}}

        {{#ifCond loginCount ">" 5}}
          <p>⚠️ We noticed multiple login attempts.</p>
        {{/ifCond}}

        <p>Account created: {{formatDate createdAt "short"}}</p>
      </div>
    `
  })
})
```

### Render Template with Variables
```typescript
import { sendEmail } from '@/utils/email'

await sendEmail({
  to: 'user@example.com',
  templateId: 'welcome-email',
  variables: {
    name: 'John Doe',
    companyName: 'My Company',
    user: {
      name: 'John Doe',
      premium: true,
      profile: { avatar: '/avatar.jpg' }
    },
    loginCount: 2,
    createdAt: new Date(),
    loginUrl: 'https://app.com/login'
  }
})
```

## 🤖 AI Agent Integration Guide

### Core Workflow for AI Agents

1. **Template Management**
   ```typescript
   // Load all templates
   const templates = await fetch('/api/settings/email-templates')

   // Create new template
   await fetch('/api/settings/email-templates', {
     method: 'POST',
     body: JSON.stringify({
       name: 'Custom Template',
       subject: 'Subject with {{variables}}',
       content: '<div>{{content}}</div>'
     })
   })

   // Update template
   await fetch(`/api/settings/email-templates/${id}`, {
     method: 'PUT',
     body: JSON.stringify({ content: updatedContent })
   })

   // Delete template
   await fetch(`/api/settings/email-templates/${id}`, {
     method: 'DELETE'
   })
   ```

2. **Template Rendering**
   ```typescript
   // Use with email system
   await sendEmail({
     to: recipient,
     templateId: templateId,
     variables: {
       name: 'User Name',
       customData: customObject,
       items: itemArray
     }
   })
   ```

3. **Template Validation**
   ```typescript
   // Validate template syntax
   const isValid = validateHandlebarsTemplate(templateContent)

   // Check for required variables
   const variables = extractTemplateVariables(templateContent)
   ```

### Error Handling for AI Agents

- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Template doesn't exist
- **400 Bad Request**: Invalid template data
- **409 Conflict**: Template name already exists

### Best Practices

- **Variable Naming**: Use consistent variable names
- **Template Structure**: Maintain clean HTML structure
- **Conditional Logic**: Use helpers for complex conditions
- **Testing**: Always test templates with sample data
- **Versioning**: Keep track of template changes

---

*This documentation is designed for AI agents to understand and maintain the email template system functionality.*