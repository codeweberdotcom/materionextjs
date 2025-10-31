# Dependencies & Package Management

This document provides detailed information about the dependencies used in the Materio MUI Next.js Admin Template, including our custom modifications.

## 📦 Package Management

The project supports multiple package managers:

- **pnpm** (Highly Recommended) - Fast, efficient, and reliable
- **yarn** - Alternative package manager
- **npm** - Default Node.js package manager

## 🔧 Core Dependencies

### Framework & Runtime

| Package | Version | Description |
|---------|---------|-------------|
| `next` | `15.1.2` | React framework for production |
| `react` | `18.3.1` | React library |
| `react-dom` | `18.3.1` | React DOM rendering |

### UI & Styling

| Package | Version | Description |
|---------|---------|-------------|
| `@mui/material` | `6.2.1` | Material-UI components |
| `@mui/material-nextjs` | `6.2.1` | Material-UI Next.js integration |
| `@emotion/cache` | `11.14.0` | Emotion CSS-in-JS caching |
| `@emotion/react` | `11.14.0` | Emotion React integration |
| `@emotion/styled` | `11.14.0` | Emotion styled components |
| `@floating-ui/react` | `0.27.2` | Floating UI for tooltips/popovers |
| `tailwindcss` | `3.4.17` | Utility-first CSS framework |

### Authentication

| Package | Version | Description |
|---------|---------|-------------|
| `next-auth` | `4.24.11` | Authentication for Next.js |
| `@auth/prisma-adapter` | `2.7.4` | Prisma adapter for NextAuth |

### Database & ORM

| Package | Version | Description |
|---------|---------|-------------|
| `@prisma/client` | `5.22.0` | Prisma database client |
| `prisma` | `5.22.0` | Prisma CLI and toolkit |

### Rich Text Editor

| Package | Version | Description |
|---------|---------|-------------|
| `@tiptap/extension-color` | `^2.10.4` | Tiptap color extension |
| `@tiptap/extension-list-item` | `^2.10.4` | Tiptap list item extension |
| `@tiptap/extension-placeholder` | `^2.10.4` | Tiptap placeholder extension |
| `@tiptap/extension-text-align` | `^2.10.4` | Tiptap text alignment extension |
| `@tiptap/extension-text-style` | `^2.10.4` | Tiptap text style extension |
| `@tiptap/extension-underline` | `^2.10.4` | Tiptap underline extension |
| `@tiptap/pm` | `^2.10.4` | ProseMirror core |
| `@tiptap/react` | `^2.10.4` | Tiptap React integration |
| `@tiptap/starter-kit` | `^2.10.4` | Tiptap starter kit |

### Form Handling

| Package | Version | Description |
|---------|---------|-------------|
| `@hookform/resolvers` | `3.9.1` | React Hook Form resolvers |
| `react-hook-form` | `7.54.1` | Forms with easy validation |
| `valibot` | `0.42.1` | Modern form validation |

### Data Tables & Charts

| Package | Version | Description |
|---------|---------|-------------|
| `@tanstack/react-table` | `8.20.6` | Headless table library |
| `@tanstack/match-sorter-utils` | `8.19.4` | Sorting utilities |
| `apexcharts` | `3.49.0` | Chart library |
| `react-apexcharts` | `1.4.1` | React ApexCharts integration |
| `recharts` | `2.15.0` | Composable chart library |

### State Management

| Package | Version | Description |
|---------|---------|-------------|
| `@reduxjs/toolkit` | `2.5.0` | Redux toolkit for state management |
| `react-redux` | `9.2.0` | React Redux bindings |

### Utilities

| Package | Version | Description |
|---------|---------|-------------|
| `bcryptjs` | `^3.0.2` | **Modified**: Password hashing (replaces bcrypt) |
| `date-fns` | `4.1.0` | Date utility library |
| `input-otp` | `1.4.1` | OTP input component |
| `negotiator` | `1.0.0` | Content negotiation |
| `server-only` | `0.0.1` | Server-only utilities |
| `socket.io` | `^4.8.1` | Real-time communication |
| `socket.io-client` | `^4.8.1` | Socket.io client |

### Development Tools

| Package | Version | Description |
|---------|---------|-------------|
| `@types/bcrypt` | `^6.0.0` | TypeScript types for bcrypt |
| `@types/nodemailer` | `^7.0.3` | TypeScript types for nodemailer |
| `tsx` | `4.19.2` | TypeScript execution |
| `typescript` | `5.5.4` | TypeScript compiler |

## 🔄 Custom Modifications

### bcrypt → bcryptjs

**Reason for Change**: Improved compatibility and performance.

**Original**: `bcrypt`
**Modified**: `bcryptjs`

**Impact**:
- Better cross-platform compatibility
- No native compilation required
- Easier deployment in serverless environments

**Usage**:
```typescript
import bcrypt from 'bcryptjs'

// Hash password
const hashedPassword = await bcrypt.hash(password, 10)

// Verify password
const isValid = await bcrypt.compare(password, hashedPassword)
```

### Additional Installed Packages

Beyond the standard Materio template, our implementation includes:

| Package | Version | Purpose |
|---------|---------|-------------|
| `express` | `^5.1.0` | Server framework for custom server |
| `nodemailer` | `^6.10.1` | Email sending functionality |
| `fs-extra` | `11.2.0` | Enhanced file system operations |
| `bootstrap-icons` | `1.11.3` | Icon library |
| `classnames` | `2.5.1` | CSS class utilities |
| `cmdk` | `1.0.4` | Command palette component |
| `keen-slider` | `6.8.6` | Touch slider component |
| `mapbox-gl` | `3.9.0` | Map rendering |
| `react-map-gl` | `7.1.8` | React Mapbox integration |
| `react-perfect-scrollbar` | `1.5.8` | Custom scrollbar |
| `react-player` | `2.16.0` | Media player component |
| `react-toastify` | `10.0.6` | Toast notifications |
| `react-use` | `17.6.0` | React hooks library |
| `react-colorful` | `5.6.1` | Color picker component |
| `react-datepicker` | `7.3.0` | Date picker component |
| `react-dropzone` | `14.3.5` | File upload component |

## 🛠️ Development Dependencies

### Build Tools

| Package | Version | Description |
|---------|---------|-------------|
| `autoprefixer` | `10.4.20` | CSS autoprefixer |
| `postcss` | `8.4.49` | CSS processing |
| `tailwindcss-logical` | `3.0.1` | Tailwind logical properties |

### Linting & Formatting

| Package | Version | Description |
|---------|---------|-------------|
| `eslint` | `8.57.1` | JavaScript linting |
| `eslint-config-next` | `15.1.2` | Next.js ESLint config |
| `eslint-config-prettier` | `9.1.0` | Prettier ESLint integration |
| `eslint-import-resolver-typescript` | `3.7.0` | TypeScript import resolution |
| `eslint-plugin-import` | `2.31.0` | Import validation |
| `@typescript-eslint/eslint-plugin` | `7.18.0` | TypeScript ESLint rules |
| `@typescript-eslint/parser` | `7.18.0` | TypeScript ESLint parser |
| `prettier` | `3.4.2` | Code formatting |
| `stylelint` | `16.12.0` | CSS linting |
| `stylelint-use-logical-spec` | `5.0.1` | Logical CSS properties |

### Icon & Asset Tools

| Package | Version | Description |
|---------|---------|-------------|
| `@iconify/json` | `2.2.286` | Iconify icon data |
| `@iconify/tools` | `4.1.1` | Iconify build tools |
| `@iconify/types` | `2.0.0` | Iconify TypeScript types |
| `@iconify/utils` | `2.2.1` | Iconify utilities |

### TypeScript Types

| Package | Version | Description |
|---------|---------|-------------|
| `@types/fs-extra` | `^11.0.4` | TypeScript types for fs-extra |
| `@types/mapbox-gl` | `^3.4.1` | TypeScript types for Mapbox GL |
| `@types/negotiator` | `^0.6.3` | TypeScript types for negotiator |
| `@types/node` | `^22.10.2` | Node.js TypeScript types |
| `@types/react` | `^18.3.18` | React TypeScript types |
| `@types/react-dom` | `^18.3.5` | React DOM TypeScript types |

## 📋 Package Scripts

### Available Scripts

```json
{
  "scripts": {
    "predev": "tsx src/scripts/generate-languages.ts",
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "socket": "node src/server/websocket-server.js",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write \"src/**/*.{js,jsx,ts,tsx}\"",
    "build:icons": "tsx src/assets/iconify-icons/bundle-icons-css.ts",
    "migrate": "dotenv -e .env -- npx prisma migrate dev",
    "postinstall": "prisma generate && npm run build:icons",
    "removeI18n": "tsx src/remove-translation-scripts/index.ts"
  }
}
```

### Script Explanations

| Script | Description |
|--------|-------------|
| `predev` | Generate language files before development |
| `dev` | Start Next.js development server |
| `build` | Build production bundle |
| `start` | Start Next.js production server |
| `socket` | Start Socket.IO server for real-time chat |
| `lint` | Run ESLint |
| `lint:fix` | Fix ESLint issues automatically |
| `format` | Format code with Prettier |
| `build:icons` | Bundle custom icons |
| `migrate` | Run Prisma migrations |
| `postinstall` | Generate Prisma client and build icons |
| `removeI18n` | Remove internationalization (cleanup script) |

## 🔧 Dependency Management

### Adding New Dependencies

1. **Install Package**:
```bash
pnpm add package-name
# or for dev dependencies
pnpm add -D package-name
```

2. **Update Documentation**: Add to this file if it's a significant addition

3. **TypeScript Types**: Install types if available:
```bash
pnpm add -D @types/package-name
```

### Updating Dependencies

```bash
# Check for updates
pnpm outdated

# Update specific package
pnpm update package-name

# Update all packages
pnpm update
```

### Security Audits

```bash
# Audit dependencies
pnpm audit

# Fix security issues
pnpm audit fix
```

## 🚨 Breaking Changes & Compatibility

### Known Modifications

1. **bcrypt → bcryptjs**: API remains the same, but import path changes
2. **Additional Packages**: Extended functionality beyond base template
3. **Socket.IO Server**: Separate WebSocket server for real-time chat functionality

### Migration Notes

- Existing bcrypt code works without changes (just update import)
- New packages are optional and don't affect core functionality
- Socket.IO server runs separately on port 3003 for real-time chat

## 📊 Bundle Analysis

### Bundle Size Optimization

- **Tree Shaking**: Enabled for unused code elimination
- **Dynamic Imports**: Used for code splitting
- **Image Optimization**: Next.js automatic optimization

### Performance Monitoring

```bash
# Analyze bundle size
npx @next/bundle-analyzer
```

This dependencies documentation ensures proper package management and helps maintain compatibility across different environments.
