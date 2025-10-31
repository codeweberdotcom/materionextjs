# Setup & Installation Guide

This guide will help you set up the Materio MUI Next.js Admin Template for development and production deployment.

## 🖥️ System Requirements

### Minimum Requirements
- **Node.js**: 18.17.0 or higher (LTS version recommended)
- **Package Manager**: pnpm (recommended), yarn, or npm
- **Database**: SQLite (included) or PostgreSQL/MySQL
- **Memory**: 512MB RAM minimum, 1GB recommended
- **Storage**: 500MB free space

### Recommended Setup
- **Node.js**: 20.x LTS (tested with v20.19.0)
- **Package Manager**: pnpm (highly recommended for speed)
- **Database**: PostgreSQL 15+ (for production)
- **Memory**: 2GB RAM or more
- **Storage**: 1GB+ free space

### Tested Environment
- **Node.js**: v20.19.0
- **npm**: v11.2.0
- **pnpm**: Latest version
- **OS**: Windows 11, macOS, Linux

## 🚀 Quick Start

### 1. Download & Setup

Download the Materio zip file and extract it to your chosen directory. The archive contains:
- `typescript-version/` - TypeScript implementation
- `javascript-version/` - JavaScript implementation
- Each with `full-version/` and `starter-kit/` options

**Important**: Ensure hidden files (starting with `.`) are visible during extraction to avoid missing configuration files.

### 2. Environment Configuration

Navigate to your chosen version directory and copy the environment file:

```bash
cp .env.example .env
```

Configure the following variables in `.env`:

```env
# Database
DATABASE_URL="file:./src/prisma/dev.db"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-generated-secret-here"

# OAuth Providers (optional - for full-version)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email Configuration (optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

**Security Note**: Generate a secure `NEXTAUTH_SECRET` using:
```bash
openssl rand -base64 32
```

### 3. Install Dependencies

Use your preferred package manager:

```bash
# pnpm (Highly Recommended)
pnpm install

# yarn
yarn install

# npm
npm install
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run postinstall

# Run database migrations
npm run migrate

# Seed the database with initial data
npm run seed
```

### 5. Development Server

Launch the development servers:

```bash
# Terminal 1: Next.js application (port 3000)
pnpm dev --port 3000

# Terminal 2: Socket.IO server (port 3003)
pnpm run socket
```

Visit `http://localhost:3000` to see the application.

**Port Customization**: Change port with `--port` flag:
```bash
pnpm dev --port 3001
```
Update `NEXTAUTH_URL` in `.env` to match the new port.

## 📋 Detailed Setup Instructions

### Environment Variables

Environment variables are key-value pairs that configure your application outside of code. They provide security, flexibility, and convenience for managing different environments.

#### Core Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `BASEPATH` | Base path for the application | `` (empty for root) |
| `API_URL` | API base URL | `http://localhost:3000/api` |
| `NEXT_PUBLIC_APP_URL` | Public app URL (client-side) | `http://localhost:3000` |

#### Authentication Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXTAUTH_BASEPATH` | NextAuth base path | `/api/auth` |
| `NEXTAUTH_URL` | NextAuth callback URL | `http://localhost:3000/api/auth` |
| `NEXTAUTH_SECRET` | JWT encryption secret | `your-generated-secret` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `xxx` |

#### Database Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `file:./src/prisma/dev.db` |

#### Email Variables (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | `user@gmail.com` |
| `SMTP_PASS` | SMTP password/app password | `app-password` |

#### Configuration Steps

1. **Copy Environment File**:
   ```bash
   cp .env.example .env
   ```

2. **Generate Secure Secrets**:
   ```bash
   # Generate NEXTAUTH_SECRET
   openssl rand -base64 32
   ```

3. **Configure Variables**: Fill in your actual values in `.env`

4. **Git Configuration**: Remove `.env` from `.gitignore` if you want to commit it (not recommended for production secrets)

#### Important Notes

- **NEXT_PUBLIC** prefix: Variables with this prefix are exposed to the browser
- **Security**: Never commit sensitive data to version control
- **Environment-Specific**: Use different `.env` files for development, staging, and production
- **NextAuth.js**: Refer to [NextAuth.js documentation](https://next-auth.js.org/configuration/options) for advanced configuration

### Database Configuration

#### SQLite (Development)

Default configuration uses SQLite:

```env
DATABASE_URL="file:./src/prisma/dev.db"
```

#### PostgreSQL (Production)

For production, use PostgreSQL:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/dbname?schema=public"
```

Update `src/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### MySQL (Alternative)

```env
DATABASE_URL="mysql://username:password@localhost:3306/dbname"
```

Update schema.prisma:

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

### Authentication Setup

#### NextAuth.js Configuration

1. Generate a secure secret:

```bash
openssl rand -base64 32
```

2. Add to `.env`:

```env
NEXTAUTH_SECRET="your-generated-secret"
```

#### Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
6. Add credentials to `.env`

### Email Configuration (Optional)

#### Gmail Setup

1. Enable 2-factor authentication on Gmail
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Configure SMTP settings:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

#### Other SMTP Providers

```env
# SendGrid
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASS="your-sendgrid-api-key"

# Mailgun
SMTP_HOST="smtp.mailgun.org"
SMTP_PORT="587"
SMTP_USER="your-mailgun-smtp-username"
SMTP_PASS="your-mailgun-smtp-password"
```

## 🏗️ Build & Deployment

### Development Build

```bash
npm run build:dev
npm run start
```

### Production Build

```bash
# Build Next.js application
npm run build

# Start Next.js production server
npm run start

# In separate terminal: Start Socket.IO server
npm run socket
```

### Environment-Specific Builds

Create environment-specific files:

```bash
# .env.local (development)
# .env.production (production)
# .env.staging (staging)
```

### Docker Deployment

#### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/app
      - NEXTAUTH_URL=https://yourdomain.com
      - NEXTAUTH_SECRET=your-secret
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=app
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## 🚀 Deployment Platforms

### Vercel

1. Connect GitHub repository
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

**Required Environment Variables:**
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

### Netlify

1. Connect repository
2. Set build command: `npm run build`
3. Set publish directory: `.next`
4. Add environment variables

### Railway

1. Connect GitHub repo
2. Automatic database provisioning
3. Environment variables auto-detection

### DigitalOcean App Platform

1. Create app from GitHub
2. Configure environment variables
3. Set up database (managed or external)

### AWS

#### Elastic Beanstalk

1. Create Node.js application
2. Upload source bundle
3. Configure environment variables
4. Set up RDS database

#### ECS/Fargate

1. Create ECR repository
2. Build and push Docker image
3. Create ECS cluster and service
4. Configure load balancer and domain

### Heroku

1. Create Heroku app
2. Add PostgreSQL add-on
3. Set environment variables
4. Deploy via Git or Docker

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Issues

**Error:** `P1001: Can't reach database server`

**Solutions:**
1. Check DATABASE_URL format
2. Ensure database server is running
3. Verify credentials
4. Check firewall/network settings

#### Build Errors

**Error:** `Module not found`

**Solutions:**
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Clear Next.js cache: `rm -rf .next`
3. Check Node.js version compatibility

#### Authentication Issues

**Error:** `NEXTAUTH_SECRET is required`

**Solutions:**
1. Add NEXTAUTH_SECRET to environment variables
2. Generate a secure random string
3. Restart the application

#### Permission Errors

**Error:** `EACCES: permission denied`

**Solutions:**
1. Check file permissions
2. Run with appropriate user
3. Use `sudo` if necessary (not recommended for development)

### Debug Mode

Enable debug logging:

```env
DEBUG=*
NEXTAUTH_DEBUG=true
```

### Health Checks

Add health check endpoint for monitoring:

```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  })
}
```

## 📊 Performance Optimization

### Database Optimization

1. **Connection Pooling**: Configure Prisma connection limits
2. **Indexing**: Add database indexes for frequently queried fields
3. **Caching**: Implement Redis for session and data caching

### Application Optimization

1. **Build Optimization**: Use `next build --profile` for analysis
2. **Image Optimization**: Configure Next.js image optimization
3. **Bundle Analysis**: Use `@next/bundle-analyzer`

### Monitoring

1. **Application Monitoring**: Implement logging and error tracking
2. **Database Monitoring**: Monitor query performance
3. **Uptime Monitoring**: Set up health checks and alerts

## 🔒 Security Checklist

### Pre-deployment

- [ ] Change default admin password
- [ ] Use strong NEXTAUTH_SECRET
- [ ] Configure HTTPS in production
- [ ] Set secure cookie settings
- [ ] Validate all environment variables
- [ ] Review database permissions
- [ ] Enable rate limiting
- [ ] Set up proper CORS policies

### Production Security

- [ ] Use environment-specific configurations
- [ ] Implement proper logging
- [ ] Set up monitoring and alerts
- [ ] Regular security updates
- [ ] Backup strategies
- [ ] Incident response plan

## 📞 Support

If you encounter issues during setup:

1. Check the [troubleshooting section](#troubleshooting)
2. Review the [documentation](README.md)
3. Open an issue on GitHub
4. Contact the development team

## 🎯 Next Steps

After successful setup:

1. **Explore the Admin Panel**: Familiarize yourself with the interface
2. **Customize Branding**: Update logos, colors, and themes
3. **Add New Features**: Extend functionality based on requirements
4. **Set up CI/CD**: Automate deployment pipeline
5. **Configure Monitoring**: Set up logging and alerting

## 🔌 Socket.IO Configuration

The application uses a separate Socket.IO server for real-time chat functionality:

- **Socket.IO Server**: `src/server/websocket-server.js`
- **Default Port**: 3003
- **CORS Origins**: `http://localhost:3000`, `http://localhost:3002`

### Running Both Servers

For full functionality, run both servers simultaneously:

```bash
# Terminal 1: Next.js app
pnpm dev --port 3000

# Terminal 2: Socket.IO server
pnpm run socket
```

### Production Deployment

Ensure both servers are running in production:
- Next.js application (port 3000)
- Socket.IO server (port 3003)

This setup guide provides everything needed to get the application running. For advanced configurations, refer to the specific documentation sections.
