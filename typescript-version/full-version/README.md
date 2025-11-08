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

## 📚 Documentation

For detailed setup instructions, see the [Setup Guide](docs/setup/setup.md).

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
