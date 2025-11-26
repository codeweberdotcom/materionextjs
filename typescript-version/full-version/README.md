# Materio MUI Next.js Admin Template

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## 📚 Documentation for AI Agents

Comprehensive documentation for AI agents and developers is available in the `docs/` folder. Start with `docs/README.md` for an overview and navigation to specific sections.

## 🚀 Quick Start

### Prerequisites
- Node.js 18.17.0 or higher
- pnpm (recommended) or npm/yarn

### Installation

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Environment setup:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database setup:**
   ```bash
   pnpm run postinstall  # Generate Prisma client
   npx prisma db push    # Create database schema
   npx prisma db seed    # Seed with initial data
   ```

4. **Start development servers:**
    ```bash
    # RECOMMENDED: Start both servers together (Next.js + Socket.IO)
    pnpm run dev:with-socket

    # Alternative: Start separately
    pnpm dev --port 3000    # Next.js app only
    pnpm run socket         # Socket.IO server only
    ```

5. **Open your browser:**
   - Main app: http://localhost:3000
   - Socket.IO server: http://localhost:3003

### Default Admin Credentials
- **Email:** superadmin@example.com
- **Password:** admin123

## 📖 Features

- **Modern Stack:** Next.js 15, React 18, Material-UI v6, TypeScript
- **Authentication:** Lucia Auth v3 with session management
- **Database:** Prisma ORM with SQLite/PostgreSQL support
- **Real-time Chat:** Socket.IO integration
- **Email System:** Template-based email system with SMTP
- **Permissions:** Granular role-based access control
- **Theming:** Comprehensive theming system with CSS variables
- **Monitoring:** Prometheus + Grafana dashboards for rate-limit, sockets и API

## 🔭 Monitoring (Prometheus/Grafana)
- Конфигурация находится в `monitoring/` (docker-compose, промо конфиг, Grafana provisioning).
- Запуск локально:
  ```bash
  cd monitoring && docker compose up -d
  ```
- Приложение отдаёт метрики на `http://localhost:3000/api/metrics` (`prom-client`).
- В Grafana развернут источник Prometheus и дашборд для Rate Limit (см. `docs/monitoring/rate-limit-operations.md`).
- Основные метрики: `rate_limit_store_backend`, `rate_limit_fallback_switch_total`, `rate_limit_unknown_module_total`.
- При алертах см. инструкции в `docs/monitoring.md` и операционном гайде.

## 📚 Documentation

For detailed setup instructions, see the [Setup Guide](docs/setup/setup.md).

### Data Management
- [Universal Import/Export Tool](docs/import-export/universal-import-export-tool.md) - Comprehensive data import/export system with Excel/CSV support
- [Bulk User Operations](docs/user-operations/bulk-user-operations.md) - Mass user management operations
- [Data Sanitization](docs/fixes/data-sanitization.md) - GDPR-compliant data anonymization and deletion

**Полная документация:** См. [docs/README.md](docs/README.md) для полного списка всех документов.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
