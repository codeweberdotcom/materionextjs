# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Materio MUI Next.js Admin Template** — enterprise admin dashboard (v5.0.0).
Tech stack: Next.js 15.1.2, React 18.3.1, TypeScript 5.5.4 (strict), MUI v6, Prisma 5.22, Lucia Auth v3, Socket.IO 4.8, PostgreSQL/SQLite.

## Commands

```bash
# Development
pnpm dev                  # Next.js only (no Docker, no WebSocket)
pnpm dev:socket           # Standalone Socket.IO server (port 3001)
pnpm dev:full             # RECOMMENDED: Docker (PostgreSQL, Redis, MinIO, monitoring) + Socket.IO + Next.js

# Build & start (stop running node processes first: taskkill /f /im node.exe)
pnpm build                # Production build (next build)
pnpm start                # Start production server (next start)

# Code quality
pnpm lint                 # ESLint check
pnpm lint:fix             # ESLint auto-fix
pnpm format               # Prettier format

# Database (Prisma)
pnpm migrate              # Run dev migrations (dotenv -e .env -- npx prisma migrate dev)
pnpm pg:up                # Start PostgreSQL via Docker
pnpm pg:down              # Stop PostgreSQL
pnpm pg:setup             # Full setup: start PG + push schema + generate + seed
pnpm pg:psql              # Open psql console in container
pnpm pg:studio            # Open Prisma Studio

# Docker services
pnpm docker:up            # Start all services (Redis, Bull Board, Prometheus, Grafana, Loki, MinIO)
pnpm docker:down          # Stop all services
pnpm docker:logs          # View logs of all services

# Testing
pnpm test                 # All unit + integration tests (Vitest)
pnpm test:unit            # Unit tests only
pnpm test:integration     # Integration tests only
pnpm test:watch           # Watch mode
pnpm test:coverage        # With coverage report
pnpm test:e2e             # Playwright E2E tests (requires running server)
pnpm test:e2e:ui          # Playwright with UI
```

Single test file: `pnpm vitest run tests/unit/path/to/test.ts`

**Important**: Docker must be running before `pnpm dev:full`. This is the primary development command.

## Project Structure

```text
src/
├── @core/              # Theme primitives, MUI overrides, core hooks, Tailwind plugin (vendored — rarely modify)
├── @layouts/           # Horizontal and vertical layout shells (vendored)
├── @menu/              # Standalone menu system (vendored)
├── app/                # Next.js 15 app directory
│   ├── [lang]/         # Localized routes (en, fr, ar, ru)
│   │   ├── (dashboard)/(private)/  # Protected dashboard pages
│   │   └── front-pages/            # Public pages
│   ├── api/            # API routes (32 groups, ~130 route files)
│   └── server/         # Server-side utilities
├── assets/             # Static assets (icons, images, fonts)
├── components/         # Reusable React components (auth, media, dialogs, export, import)
├── configs/            # Configuration files (i18n.ts, env)
├── contexts/           # React context providers (AuthProvider, AccountContext)
├── data/               # Static data (languages.json, navigation, dictionaries)
├── fake-db/            # Mock data for development
├── hocs/               # Higher-order components
├── hooks/              # Custom React hooks (useTranslate, usePermissions, useMediaUrl, useChatNew, etc.)
├── lib/                # Server-side libraries
│   ├── api/            # withApiHandler, withPublicHandler, apiResponse helpers
│   ├── config/         # Configuration
│   ├── db/             # Database utilities
│   ├── logger/         # Winston logging (daily rotate, Loki, Sentry)
│   ├── metrics/        # Prometheus metrics (http, database, auth, translations)
│   ├── rate-limit/     # Rate limiting engine (Redis + Prisma fallback)
│   ├── sockets/        # Socket.IO init, middleware, namespaces (chat, notifications)
│   └── validations/    # Zod validation schemas
├── libs/               # Third-party library wrappers (lucia.ts, prisma.ts, ApexCharts)
├── modules/            # Feature modules (settings)
├── redux-store/        # Redux Toolkit + Redux Persist (chat, calendar, kanban, email, notifications)
├── schemas/            # Zod validation schemas
├── scripts/            # Build and utility scripts
├── server/             # websocket-standalone.ts (standalone Socket.IO on port 3001)
├── services/           # Business logic (15+ directories — see Modules section)
├── shared/             # Shared utilities (env.ts, protected-roles.ts, http)
├── types/              # TypeScript type definitions
├── utils/              # General utilities (auth, formatting, permissions, translations, verification)
└── views/              # Page view components (admin, apps, dashboards, forms)

prisma/
├── schema.prisma              # SQLite schema (default for local dev)
├── schema.postgresql.prisma   # PostgreSQL schema (production)
└── seed.ts                    # Database seeder

tests/
├── unit/              # Vitest unit tests (no DOM, node environment)
├── integration/       # Vitest integration tests (may hit real DB/services)
├── e2e/               # Playwright E2E tests (Chrome only, base URL http://localhost:3000)
├── performance/       # Performance benchmarks
└── helpers/           # Common test utilities

docs/                  # 233 documentation files (see Documentation section)
```

## Architecture

### API routes (`src/app/api/`)

32 route groups with ~130 route files. All authenticated routes use `withApiHandler()` wrapper from `src/lib/api/withApiHandler.ts` which handles auth, permissions, error formatting, and logging. Public routes use `withPublicHandler()`.

**Response helpers via `apiResponse`:**

- `apiResponse.ok(data)` → 200
- `apiResponse.created(data)` → 201
- `apiResponse.noContent()` → 204
- `apiResponse.error(message)` → 500
- `apiResponse.unauthorized()` → 401
- `apiResponse.forbidden(message)` → 403
- `apiResponse.notFound(message)` → 404
- `apiResponse.badRequest(message)` → 400

**Permission declaration pattern:**

```typescript
export const GET = withApiHandler(handler, {
  permission: { module: 'Users', action: 'Read' }
})
```

**Structured error responses via `createErrorResponse()`** in `src/utils/apiError.ts`:

```typescript
createErrorResponse({
  status: 400,
  code: 'REG_VALIDATION_ERROR',
  message: 'Validation failed',
  details: [...],
  logLevel: 'warn',
  route: 'register',
  context: { ... }
})
```

Business logic is delegated to services in `src/services/`. Rate limiting and Prometheus metrics are applied per-route, not globally (middleware skips `/api/*`).

**Three non-standard routes (NOT using withApiHandler):**

- `src/app/api/ads/route.ts` — uses `requireFullVerification`
- `src/app/api/export/[entity]/route.ts` — optional auth + rate limiting
- `src/app/api/import/[entity]/route.ts` — optional auth + rate limiting

### Services (`src/services/`)

The primary location for all business logic:

- `media/` — S3 file storage via AWS SDK + Sharp image processing, watermarks, soft delete, variants
- `export/` / `import/` — CSV/XLSX handling with PapaParse and xlsx (adapter factory pattern)
- `bulk/` — Batch operations with Promise.allSettled
- `notifications/` — Event-triggered notifications with scenarios
- `scheduler/` — Bull/BullMQ queues + node-cron (TariffExpirationScheduler, MediaCleanupScheduler)
- `events/` — Audit event system with PII masking, correlation IDs, configurable retention
- `data-sanitization.service.ts` — GDPR data removal (delete/anonymize/selective modes)
- `workflows/` — XState state machine workflows
- `database/` — Repository pattern (AccountRepository, MediaRepository, UserRepository)
- `accounts/` — Account management (singleton pattern)
- `slug/` — Username slug validation and history
- `verification/` — Email/phone verification workflows
- `sms/` — SMS.ru provider integration

**Service patterns:**

- Singleton with `getInstance()` for stateful services
- Lazy initialization (defer setup until first use)
- Repository pattern for database access
- Event-driven architecture (core operations emit events)
- Non-blocking external calls (SMS/email failures don't block core operations)

### Middleware (`middleware.ts`)

Handles: Lucia session validation, email-verification gating for admin routes, Prometheus HTTP metrics. Skips `/api/*` entirely (API routes manage their own auth/metrics via `withApiHandler`). Admin/apps pages require `emailVerified` to be true.

### Framework layers (`src/@*`)

- `src/@core/` — Theme primitives, MUI overrides, core hooks, Tailwind plugin
- `src/@layouts/` — Horizontal and vertical layout shells
- `src/@menu/` — Standalone menu system with horizontal/vertical variants

These are treated as a vendored "framework" layer and generally should not be modified unless changing the theme or layout system.

### State management

Redux Toolkit + Redux Persist (`src/redux-store/`). Storage via localforage (IndexedDB).

- **Slices:** chat, calendar, kanban, email, notifications, chatQueue
- Server state (API data) is fetched directly without Redux

**Context providers:**

- `AuthProvider` (`src/contexts/AuthProvider.tsx`) — user, session, login/logout
- `AccountContext` (`src/contexts/AccountContext.tsx`) — current account, account switching

### Styling

MUI v6 as the primary component system with Emotion. Tailwind CSS for utility classes alongside MUI (Preflight is disabled to avoid conflicts). Custom MUI theme overrides in `src/@core/theme/overrides/`. Dark mode support via theme switcher. Customization in `src/components/theme/mergedTheme.ts`. Icons: Remix Icons via Iconify (prefix `ri-`).

### Validation

Zod is the standard validation library. Used in forms with `@hookform/resolvers/zod` and in API routes for request body validation. Valibot is used in a few specific places.

### Path aliases (tsconfig)

- `@/*` → `src/*`
- `@core/*` → `src/@core/*`
- `@layouts/*` → `src/@layouts/*`
- `@menu/*` → `src/@menu/*`
- `@components/*` → `src/components/*`
- `@configs/*` → `src/configs/*`
- `@views/*` → `src/views/*`
- `@assets/*` → `src/assets/*`

---

## Modules

### Roles & Permissions

**Location:** `src/utils/permissions/permissions.ts`, `src/hooks/usePermissions.ts`, `src/app/api/admin/roles/`
**Docs:** `docs/permissions/permissions.md`, `docs/api/roles.md`

**Role model:** `id`, `code` (immutable, UNIQUE), `name` (display, can rename), `description`, `permissions` (JSON string), `level` (int, lower = higher priority), `isSystem` (bool).

**Hierarchy (10 system roles):**

| Code | Level | Description |
|------|-------|-------------|
| SUPERADMIN | 0 | Unlimited access (`"all"`), bypasses all checks |
| ADMIN | 10 | User/role/settings management |
| MANAGER | 20 | Limited admin |
| EDITOR | 30 | Content CRUD |
| MODERATOR | 40 | Moderation |
| SEO | 50 | SEO management |
| MARKETOLOG | 60 | Marketing |
| SUPPORT | 70 | User support |
| SUBSCRIBER | 80 | Limited read-only |
| USER | 90 | Basic permissions |
| *(custom)* | 100+ | Custom roles, `isSystem: false` |

**Permission format (JSON in DB):**

```json
{
  "userManagement": ["read", "create", "update", "delete"],
  "content": "all",
  "media": ["read", "upload"]
}
```

**Standard modules:** `userManagement`, `roleManagement`, `emailTemplates`, `settings`, `references`, `content`, `media`, `audit`, `analytics`.

**Key functions:**

- `checkPermission(user, module, action)` — check specific permission
- `getUserPermissions(user)` — parse user's permission map
- `isSuperadmin(user)` — bypass all checks (checks `role.code === 'SUPERADMIN'`)
- `hasRoleCode(user, code)` — check by immutable code
- `isAdminOrHigher(user)` — admin or superadmin
- `canModifyUserByRole(actor, target)` — hierarchy enforcement: `actorLevel < targetLevel`

**React hook:** `usePermissions()` → `{ user, isLoading, isAuthenticated, hasRole(), isAdmin, isSuperadmin, checkPermission() }`

**API endpoints:**

- `GET /api/admin/roles` — list all (cached in Redis/memory, `clearCache=true` to refresh)
- `POST /api/admin/roles` — create custom role (auto: `code` from name, `level: 100`, `isSystem: false`)
- `GET/PUT/DELETE /api/admin/roles/[id]` — CRUD with hierarchy checks
- DELETE protected: cannot delete `isSystem` roles or roles with assigned users

**Caching:** Redis primary → in-memory fallback. Auto-cleared on create/update/delete. TTL configurable.

**Audit events:** `role.created`, `role.updated`, `role.deleted`, `role.permissions.changed`.

---

### User Management

**Location:** `src/app/api/admin/users/`, `src/app/api/user/`, `src/services/database/userRepository.ts`
**Docs:** `docs/api/users.md`, `docs/api/user-list.md`, `docs/api/accounts.md`

**User model:** `id` (CUID), `name`, `email`, `password` (bcrypt), `image`, `roleId`, `country`, `language`, `currency`, `isActive`, `emailVerified`, `phoneVerified`, `phone`.

**Admin endpoints:**

| Method | Endpoint | Purpose | Permission |
|--------|----------|---------|------------|
| GET | `/api/admin/users` | List all (30s cache) | `userManagement.read` |
| POST | `/api/admin/users` | Create with avatar | `Users.Create` |
| GET | `/api/admin/users/[id]` | Get user | `userManagement.read` |
| PUT | `/api/admin/users/[id]` | Update user & avatar | `Users.Update` |
| PATCH | `/api/admin/users/[id]` | Toggle isActive | Admin/Superadmin |
| DELETE | `/api/admin/users/[id]` | Delete permanently | `Users.Delete` |

**User profile endpoints:**

- `GET /api/user/profile` — current user
- `PUT /api/user/profile` — update own profile
- `PUT /api/user/change-password` — with current password validation
- `POST /api/user/avatar` — upload avatar

**Registration flow (`POST /api/register`):**
1. Zod validation (mode-dependent)
2. Rate limiting (4 modules: IP, email domain, email, phone)
3. Uniqueness checks (email + phone)
4. bcrypt password hashing
5. User + default role creation
6. Verification code generation (email + SMS)
7. Email/SMS sending (non-blocking)
8. Default FREE tariff account creation
9. Event recording at each step

**Account system (multi-account per user):**

- Types: `LISTING`, `COMPANY`, `NETWORK`
- Tariff plans: `FREE` (5 listings/1 account), `BASIC` (25/3), `PRO` (100/10), `ENTERPRISE` (unlimited)
- Account managers with granular permissions (`canEdit`, `canManage`, `canDelete`)
- Account transfer workflow (initiate → accept/reject/cancel)

**Account endpoints:**

- `GET/POST /api/accounts` — list/create
- `GET/PUT/DELETE /api/accounts/[id]` — CRUD
- `POST /api/accounts/[id]/switch` — switch active account
- `GET/POST/PUT/DELETE /api/accounts/[id]/managers` — manager CRUD
- `POST /api/accounts/[id]/transfer` + accept/reject/cancel

**Bulk operations:** Delete, activate, deactivate via `BulkOperationsService`. Uses `Promise.allSettled()`. Auto-excludes superadmin users. Metrics tracked.

---

### Rate Limiting

**Location:** `src/lib/rate-limit/`, `src/app/api/admin/rate-limits/`
**Docs:** `docs/rate-limits/*.md`, `docs/api/rate-limits.md`

**Architecture:**

- **Dual-store:** Redis (primary) + Prisma (automatic fallback if Redis down)
- **DI Container pattern** for composable services
- **Test-aware:** `test:` prefix separates test/prod limits

**Models:**

- `RateLimitConfig` — per-module config (maxRequests, windowMs, blockMs, warnThreshold, mode, isActive, PII flags)
- `RateLimitState` — current state per key+module (count, windowStart, blockedUntil)
- `RateLimitEvent` — audit history with HMAC hashes for IP/email
- `UserBlock` — manual admin blocks (user/email/IP/CIDR/ASN targets, `module='all'` for global)

**Dual-mode operation:**

- **Enforce:** Returns HTTP 429 with `Retry-After` header, blocks user
- **Monitor:** Records warning but allows request (safe rollout)

**Pre-configured modules:**

| Module | Limit | Block | Use |
|--------|-------|-------|-----|
| `auth-login` | 5/15min | 1 hour | Login brute force |
| `registration-ip` | 3/hour | 24 hours | Registration spam |
| `registration-domain` | 10/hour | — | Domain-based |
| `registration-email` | 1/24h | — | Per email |
| `chat-messages` | 5/30sec | 1-4 min (exponential) | Chat spam |

**PII protection (GDPR):**

- IP: HMAC-SHA256 hash + first octet prefix. Raw stored only if `storeIpInEvents=true`
- Email: HMAC-SHA256 hash. Raw stored only if `storeEmailInEvents=true`
- Secret rotation supported via `RATE_LIMIT_SECRET` with versioned hashes

**Admin endpoints:**

- `GET /api/admin/rate-limits` — list configs/states/events (query: `view=states|events|configs`)
- `PUT /api/admin/rate-limits` — update module config
- `DELETE /api/admin/rate-limits` — reset state by key/module
- `POST /api/admin/rate-limits/blocks` — create manual block
- `DELETE /api/admin/rate-limits/blocks/{blockId}` — deactivate manual block

**Service methods:**

- `checkLimit(key, module, options?)` → `{ allowed, remaining, resetTime, blockedUntil? }`
- `getStats(module)` — statistics
- `listBlocks(params)` — cursor-based filtering
- `bulkDeactivateBlocks(params)` — batch deactivation
- `manageLimits(params)` — flexible state management with dry-run
- `cleanupBlocks(params)` — delete old/expired blocks

**Retention:** Default 90 days for `RateLimitEvent` (via `RATE_LIMIT_EVENT_RETENTION_DAYS`).

**Prometheus metrics:** `rate_limit_checks_total`, `rate_limit_events_total`, `rate_limit_blocks_total`, `rate_limit_store_backend`, `rate_limit_consume_duration_seconds`, etc.

---

### Chat

**Location:** `src/app/api/chat/`, `src/lib/sockets/namespaces/`, `src/hooks/useChatNew.ts`, `src/redux-store/slices/chat.ts`
**Docs:** `docs/api/chat.md`, `docs/analysis/architecture/CHAT_MODULE_DETAILED_ANALYSIS.md`

**Architecture:** React components + Redux + Socket.IO client → Next.js API (port 3000) + standalone WebSocket server (port 3001) → Prisma DB.

**Data models:**

- `ChatRoom` — two-user rooms, unique constraint `(user1Id, user2Id)`
- `Message` — content, senderId, roomId, readAt timestamp

**REST endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat/last-messages` | GET | Last messages for user |
| `/api/chat/unread` | GET | Total unread count |
| `/api/chat/unread-by-contact` | GET | Unread per contact |
| `/api/chat/messages/read` | POST | Mark messages as read |
| `/api/chat/messages/check-rate-limit` | POST | Check rate limit status |
| `/api/chat/messages` | POST | Send message (rate-limited) |

**Socket.IO events (namespace `/chat`):**

- **Client → Server:** `getOrCreateRoom`, `sendMessage` (roomId, message, senderId, clientId), `markMessagesRead`
- **Server → Client:** `roomData` (room + messages + participants), `receiveMessage`, `messagesRead`, `rateLimitExceeded`, `rateLimitWarning`

**Presence system (namespace `/notifications`):**

- 30-second ping updates `lastSeen`
- `presence:sync` event returns `{userId: {isOnline, lastSeen}}`
- `PresenceProvider`/`usePresence` polls every 30 seconds

**Rate limiting:** `chat-messages` module — 5 messages/30sec, exponential backoff (1→2→4 min).

**Fallback mechanisms:**

- WebSocket auto-reconnect (5 attempts, exponential backoff)
- HTTP fallback if Socket.IO fails
- Offline queue via IndexedDB (Redux persist)
- Optimistic UI (messages show immediately, updated on confirmation)

**Key hook:** `useChatNew.ts` (914 lines) — monolithic, handles connection, messaging, rate limits, queue, retry logic.

**Known issues:** senderId from client (impersonation risk), token in query string, missing message sanitization, memory leaks in client, monolithic hook complexity.

---

### Translations & i18n

**Location:** `src/configs/i18n.ts`, `src/data/dictionaries/`, `src/contexts/TranslationContext.tsx`, `src/hooks/useTranslate.ts`
**Docs:** `docs/api/translations.md`, `docs/configuration/internationalization.md`

**Languages:** English (LTR), French (LTR), Arabic (RTL), Russian (LTR).

**Architecture:**

- Path-based routing: `/[lang]/...` (no `next-intl`)
- Server-side: `getDictionary(locale)` loads JSON
- Client-side: `TranslationContext` provider + hooks
- Database-backed: `Translation` model (key, language, value, namespace) for runtime management

**Dictionary format (nested JSON):**

```json
{
  "navigation": {
    "dashboard": "Dashboard",
    "totalUsersCount": {
      "one": "{{count}} user",
      "few": "{{count}} users",
      "many": "{{count}} users"
    }
  }
}
```

**Hooks:**

| Hook | Use Case | Behavior |
|------|----------|---------|
| `useTranslation()` | Private/dashboard routes | Throws if no provider |
| `useTranslationSafe()` | Shared components | Returns null if no provider |
| `useTranslate()` | Full-featured | `t(key, vars)` with pluralization |

**Pluralization:** Russian/Arabic complex rules (one/few/many forms). Utility: `src/utils/translations/pluralization.ts`.

**RTL support:**

- `src/configs/i18n.ts` defines `langDirection` per locale
- MUI auto-handles component layout/alignment
- stylis-plugin-rtl for Emotion
- Tailwind logical properties (`inline-start/end` instead of `left/right`)

**Translation admin API:**

- `GET/POST /api/admin/references/translations` — CRUD with namespace/locale filters
- `GET /api/admin/references/translations/export` — bulk export
- `POST /api/admin/references/translations/import` — bulk import

---

### Events & Audit System

**Location:** `src/services/events/EventService.ts`, `src/app/api/admin/events/`
**Docs:** `docs/api/events.md`, `docs/events/retention-policy.md`

**Event structure:** `id`, `source`, `module`, `type`, `severity` (info/warning/error/critical), `message`, `actor` (type+id), `subject` (type+id), `key`, `payload` (JSON, max 10KB), `metadata`, `correlationId`, `createdAt`.

**Recording pattern:**

```typescript
await eventService.record({
  source: 'registration',
  module: 'registration',
  type: 'signup_success',
  severity: 'info',
  message: 'User registered',
  actor: { type: 'user', id: user.id },
  subject: { type: 'system', id: 'registration' },
  key: email,
  payload: { ... },
  correlationId: uuid
})
```

**PII masking:** Sources `rate_limit`, `auth`, `registration` auto-mask email (first 2 chars) and IP (first 2 octets). Full data requires `events.view_sensitive` permission.

**Admin endpoints:**

- `GET /api/admin/events` — list with filters (source, module, type, severity, actor, date range), cursor-based pagination
- `GET /api/admin/events/export/{csv|json}` — bulk export (max 10K events, 5MB)
- `GET /api/admin/events/retention` — retention stats per source
- `POST /api/admin/events/retention` — trigger cleanup (supports `dryRun`, per-source)

**Retention:** Configurable per source via env vars. Defaults: `rate_limit` 30d, `auth`/`registration` 90d, `moderation`/`block` 365d. Test events: 30d. `EVENT_RETENTION_BATCH_SIZE=1000`.

---

### Notifications

**Location:** `src/app/api/notifications/`, `src/lib/sockets/namespaces/`, `src/redux-store/slices/notifications.ts`
**Docs:** `docs/api/notifications.md`

**Architecture:** Socket.IO (`/notifications` namespace) + REST API + Redux state + localStorage for cleared tracking.

**Types:** `system`, `user`, `security`, `marketing`, `info`, `chat` (virtual, auto-generated from unread count).
**Status:** `unread`, `read`, `archived`, `deleted`.

**REST endpoints:**

- `GET /api/notifications` — fetch all non-archived
- `POST /api/notifications` — create with avatar/metadata
- `PATCH /api/notifications/{id}` — update status
- `DELETE /api/notifications/{id}` — permanent delete
- `DELETE /api/notifications/clear-all` — archive all (not delete)
- `PATCH /api/notifications/mark-all` — bulk mark read

**WebSocket events:** `newNotification`, `notificationUpdate`, `notificationDeleted`, `notificationsRead`.

**Avatar customization:** image URL, icon class, text, color, skin variant.
**Metadata JSON:** supports CTAs (call-to-action links) and custom data.

---

### Media & S3 Storage

**Location:** `src/services/media/`, `src/app/api/admin/media/`
**Docs:** `docs/api/media.md`, `docs/api/storage.md`, `docs/configuration/s3-storage.md`

**Upload modes:**

- Synchronous: `POST /api/admin/media/upload` (blocking)
- Asynchronous: `POST /api/admin/media/upload-async` (Bull queue, returns jobId)
- Bulk: `useBulkUpload` hook (parallelization, pause/resume, retry)

**Entity types with sizing:**

- `user_avatar`: 64/128/256px (max 512×512)
- `company_logo`: 100/200/400px (max 800×800)
- `company_banner`: 800/1200/1920px (max 1920×600)
- `product_image`: 200/400/800px (max 1200×1200)

**Image processing (Sharp):** Resize to variants, WebP conversion (85% quality), EXIF strip, watermarks.

**Storage strategies:**

- `local_only` — filesystem only (`public/uploads/`)
- `local_first` — local + background S3 sync
- `s3_only` — S3 only
- `both` — mirror to both

**File status:** `local_only`, `s3_only`, `synced`, `pending_upload`, `pending_download`.

**Soft delete:** Files moved to `storage/.trash/{mediaId}/` (outside `public/`). Metadata saved for restore. Hard delete with `hard: true`.

**S3 sync modes:** `upload_to_s3_keep_local`, `upload_to_s3_with_delete`, `download_from_s3`, `delete_local_only`, `delete_s3_only`, `purge_s3`. Batch processing for 50+ files (parent/child jobs).

**S3 config priority:** 1. Database (`MediaGlobalSettings`) → 2. `.env` variables → 3. Defaults (MinIO localhost:9000).

**Queue jobs:**

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| MediaProcessingQueue | Resize, WebP, EXIF strip | 5 |
| MediaSyncQueue | S3 upload/download/delete | 5 |
| WatermarkQueue | Apply watermarks | 3 |
| NotificationQueue | Email/telegram/push/SMS | 10 |

**Admin endpoints:**

- Upload: `POST .../upload`, `.../upload-async`, `GET .../jobs/[jobId]`
- CRUD: `GET/PUT/PATCH/DELETE /api/admin/media/[id]`
- Trash: `GET .../[id]/trash?variant=thumb`
- Sync: `GET/POST /api/admin/media/sync`
- Queue: `GET /api/admin/media/queue`, `POST .../cleanup`
- Settings: `GET/PUT /api/admin/media/settings`, `POST .../test-s3`
- S3 buckets: `GET/POST /api/admin/media/s3/buckets`, `POST .../validate`

---

### Email System

**Location:** `src/app/api/settings/email-templates/`, `src/services/email/`
**Docs:** `docs/api/email.md`, `docs/api/email-templates.md`, `docs/api/smtp.md`

**Features:** Nodemailer SMTP, DKIM signing, S/MIME encryption, cron scheduling, webhook notifications, Handlebars templates.

**Template system (Handlebars):**

- Variables: `{{name}}`, `{{user.profile.avatar}}`
- Conditionals: `{{#if user.premium}}...{{else}}...{{/if}}`
- Loops: `{{#each items}}...{{/each}}`
- Helpers: `ifCond`, `uppercase`, `lowercase`, `formatDate`

**Template endpoints:**

- `GET/POST /api/settings/email-templates` — list/create
- `GET/PUT/DELETE /api/settings/email-templates/{id}` — CRUD
- `GET .../export`, `POST .../import` — bulk operations

**SMTP configuration:**

- `GET/POST /api/settings/smtp` — get/save config
- `POST /api/settings/smtp/test` — test connection
- `POST /api/settings/smtp/send-test` — send test email
- Config sources: `smtp-settings.json` (demo), DB (production), env fallback

**Email options:** `to`, `subject`, `html`/`text`, `from`, `templateId`, `variables`, `attachments`, `embeddedImages`, `dkim: true`, `smime: {sign, encrypt}`, `schedule: {cron, timezone}`, `webhook: {delivery, bounce, complaint}`.

---

### Service Configuration

**Location:** `src/app/api/admin/settings/services/`
**Docs:** `docs/api/service-configuration.md`

**Purpose:** Centralized management of external service connections with encryption and hybrid config.

**Config priority:** 1. Admin Panel (DB, encrypted) → 2. `.env` → 3. Defaults (Docker containers).

**Supported services:** Redis, PostgreSQL, Prometheus, Loki, Grafana, Sentry, S3, SMTP, Elasticsearch.

**Encryption:** AES-256-GCM for passwords/tokens. Requires `CREDENTIALS_ENCRYPTION_KEY` (64 hex chars).

**Endpoints:**

- `GET/POST /api/admin/settings/services` — list/create
- `GET/PUT/DELETE /api/admin/settings/services/[id]` — CRUD
- `POST .../[id]/test` — test connection
- `POST .../[id]/toggle` — enable/disable
- `GET .../status` — health check all services

---

### References (Geographic + Data)

**Location:** `src/app/api/admin/references/`
**Docs:** `docs/api/references.md`

**Geographic hierarchy:** Country → State → City → District (each with `name`, `code`, `isActive`).

**Other references:** Currency (`name`, `code`, `symbol`), Language (`name`, `code`).

**Endpoints per entity:** GET (list), POST (create), PUT (update), PATCH (toggle active), DELETE.

---

### Import/Export

**Location:** `src/services/export/`, `src/services/import/`, `src/app/api/export/`, `src/app/api/import/`
**Docs:** `docs/import-export/universal-import-export-tool.md`

**Architecture:** Adapter factory pattern — entity-specific adapters implement `IEntityAdapter`.

**Export:** `POST /api/export` with `{ entityType, format (xlsx|csv), filters, selectedIds }`. Returns `{ filename, recordCount, base64, mimeType }`.

**Import:** `POST /api/import` (FormData) with file, entityType, mode (`create`|`update`|`upsert`), skipValidation, rowUpdates. Returns `{ successCount, errorCount, errors, warnings, totalProcessed }`.

**Preview:** `POST /api/import/preview` — validate without saving.

**Features:** File size limit 50MB, formats `.xlsx`/`.xls`/`.csv`, field validation per adapter (Zod), inline editing in preview, batch processing (100 records default).

---

### Data Sanitization (GDPR)

**Location:** `src/services/data-sanitization.service.ts`
**Docs:** `docs/fixes/data-sanitization.md`

**Modes:**

- **DELETE:** Total removal (user, messages, rooms, Redis sessions/caches, files). Option: `preserveAnalytics=true`
- **ANONYMIZE:** Email → `anonymous-{hash}@deleted.example.com`, name → "Anonymous User", messages → "[deleted]", sessions invalidated
- **SELECTIVE:** Clean specific types: PROFILE, MESSAGES, ROOMS, RATE_LIMITS

**Safety:** Test-only in current implementation (filters: `@test.example.com`, `playwright.user*`, `@deleted.example.com`, localhost IPs).

**Cross-system cleanup:** DB + Redis + Logs + Filesystem. Audit logged in `DataSanitizationLog`.

---

## Authentication

Lucia Auth (`src/libs/lucia.ts`) with Prisma adapter. Session-based with secure HTTP-only cookies.

**Flow:** Credentials submit → bcrypt validation → `lucia.createSession()` → cookie set → middleware validates via `validateSession()`.

**Auth utilities:**

- `getLuciaSession(request)` — raw session validation
- `requireAuth(request)` — enforces auth, returns `AuthenticatedUser` with role
- `optionalRequireAuth(request)` — safe for optional auth routes

**Route protection:**

- **Public:** default, no auth
- **Private:** `src/app/[lang]/(dashboard)/(private)/` with `AuthGuard` HOC
- **Guest-only:** `src/app/[lang]/(blank-layout-pages)/(guest-only)/` with `GuestGuard` HOC

**Google OAuth:** Optional via `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.

## Database

Prisma ORM (`src/libs/prisma.ts`). Default SQLite (`file:./dev3.db`) for local dev. PostgreSQL for production.

**Switching DB:** Change `DATABASE_URL` + `shx cp prisma/schema.[db].prisma prisma/schema.prisma && npx prisma generate`.

**60+ models** — see Modules section for model details per domain.

**Quick commands:**

```bash
npx prisma db push          # Apply schema directly
npx prisma db seed          # Run seeder
npx prisma migrate dev      # Create dev migration
pnpm pg:studio              # Prisma Studio GUI
```

**PostgreSQL setup:** Docker image `postgres:16-alpine`, max connections 200, shared buffers 256MB. Config in `postgresql/docker-compose.yml`.

## Monitoring

**Stack:** Prometheus + Grafana + Loki + Sentry + Winston + Bull Board.

**Docker services:**

- **Prometheus** (http://localhost:9090) — scrapes `/api/metrics` every 5s
- **Grafana** (http://localhost:9091, `admin`/`admin`) — 7 pre-built dashboards
- **Loki** (http://localhost:3100) — centralized log storage
- **Promtail** — ships `logs/` to Loki
- **Bull Board** (http://localhost:3030) — queue monitoring

**Grafana dashboards:**

1. `materio-rl` — Rate Limit Overview
2. `materio-notifications` — Notifications & Queue
3. `materio-redis` — Redis Overview
4. `materio-socket` — Socket.IO Overview
5. `materio-operations` — Application Operations
6. `materio-system` — System Overview (HTTP, DB, response times)
7. `materio-security` — Security Overview (auth, sessions, storage)

**Metric types:** HTTP request duration (p50/p95/p99), DB query duration, WebSocket connections, user registrations, bulk operations, rate limit checks, memory/CPU.

**Error tracking (Sentry):** Automatic capture with source maps, PII filtering, React Error Boundaries, API error context tagging.

**Logging (Winston):** Daily rotated files in `logs/`, Loki transport, Sentry transport, structured JSON.

## Key Environment Variables

See `.env.example` (66 total). Minimum for local dev:

- `DATABASE_URL` — SQLite default (`file:./dev3.db`) works out of the box
- `AUTH_JWT_SECRET` — for session signing and Socket.IO/API-to-API JWT
- `RATE_LIMIT_SECRET` — for HMAC IP hashing (min 32 chars)
- `REDIS_URL` — optional, falls back to in-memory
- `ENCRYPTION_KEY` — required for admin-panel service credentials (AES-256-GCM, 64 hex)

**Full list by category:**

```text
# Database
DATABASE_URL, DATABASE_USER, DATABASE_PASSWORD, DATABASE_HOST, DATABASE_PORT

# Auth
AUTH_JWT_SECRET, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# Redis
REDIS_URL, REDIS_PASSWORD, REDIS_TLS

# S3/MinIO
S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_REGION, S3_FORCE_PATH_STYLE

# Socket.IO
NEXT_PUBLIC_ENABLE_SOCKET_IO, NEXT_PUBLIC_SOCKET_URL, NEXT_PUBLIC_SOCKET_PATH, WEBSOCKET_PORT, SOCKET_ENABLED

# Security
CREDENTIALS_ENCRYPTION_KEY, RATE_LIMIT_SECRET

# SMTP
SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_ENCRYPTION, SMTP_FROM_EMAIL, SMTP_FROM_NAME

# Monitoring
GRAFANA_URL, PROMETHEUS_URL, LOKI_URL, BULL_BOARD_URL, LOG_LEVEL, LOG_DIR

# Retention
EVENT_RETENTION_DEFAULT_DAYS, RATE_LIMIT_EVENT_RETENTION_DAYS, EVENT_RETENTION_TEST_EVENTS_DAYS

# API
NEXT_PUBLIC_API_URL, AUTH_BASE_URL
```

## Testing

### Structure

- `tests/unit/` — Vitest unit tests (no DOM, node environment)
- `tests/integration/` — Vitest integration tests (may hit real DB/services)
- `tests/e2e/` — Playwright tests (Chrome only), base URL `http://localhost:3000`
- `tests/performance/` — Performance benchmarks
- Do **not** mock the database in integration tests — use real connections
- E2E tests auto-create/delete test users, distinct from production data

### Configuration

- **Vitest:** `vitest.config.js` — Node environment, globals enabled, coverage with source inclusion
- **Playwright:** `playwright.config.ts` — Chrome only, JSON + HTML reporters, retries: 2 on CI / 0 locally, parallel on local / sequential on CI

### Test infrastructure

- Test-aware rate limiting: `test:` prefix on keys
- Test-aware events: `environment: 'test'` label
- E2E helpers: `createTestUserViaAPI()`, `deleteTestUserViaAPI()`, `clearRateLimitsForTestIP()`, `generateTestRunId()`
- Data sanitization: separate retention for test events (30d)

## Default Credentials

- **Email:** `superadmin@example.com`
- **Password:** `admin123`

## Key Dependencies

| Category | Library | Version | Purpose |
|----------|---------|---------|---------|
| Framework | Next.js | 15.1.2 | App framework |
| UI | MUI | 6.2.1 | Component library |
| Styling | Tailwind CSS | 3.4.17 | Utility classes |
| ORM | Prisma | 5.22.0 | Database access |
| Auth | Lucia | 3.2.2 | Session auth |
| Validation | Zod | 3.23.8 | Schema validation |
| Forms | React Hook Form | 7.54.1 | Form handling |
| State | Redux Toolkit | 2.5.0 | Client state |
| Realtime | Socket.IO | 4.8.1 | WebSocket |
| Queue | BullMQ | 5.65.0 | Job processing |
| Cron | node-cron | 4.2.1 | Scheduled tasks |
| Images | Sharp | 0.34.5 | Image processing |
| Storage | AWS SDK S3 | 3.940.0 | Cloud storage |
| Search | Elasticsearch | 9.2.0 | Full-text search |
| Email | Nodemailer | 6.10.1 | Email sending |
| SMS | SMS.ru | 0.3.0 | SMS sending |
| Charts | ApexCharts | 3.49.0 | Charts |
| Tables | TanStack React Table | 8.20.6 | Data tables |
| Editor | TipTap | 2.10.4 | Rich text |
| Calendar | FullCalendar | 6.1.15 | Calendar widget |
| Monitoring | prom-client | 15.1.3 | Prometheus metrics |
| Logging | Winston | 3.18.3 | Structured logging |
| Errors | Sentry | 8.40.0 | Error tracking |
| Rules | json-rules-engine | 7.3.1 | Business rules |
| Workflow | XState | 5.24.0 | State machines |
| Dates | date-fns | 4.1.0 | Date utilities |

## Documentation

Extensive project documentation lives in `docs/` (233 files). Key files:

- `docs/AI_WORKFLOW_GUIDE.md` — expected workflow (АНАЛИЗ → ПЛАН → РЕАЛИЗАЦИЯ → ТЕСТИРОВАНИЕ → ОТЧЕТ → ДОКУМЕНТАЦИЯ)
- `docs/AI_MODULE_STANDARDS.md` — code standards and checklist for all modules
- `docs/STATUS_INDEX.md` — current feature status
- `docs/DOCUMENTATION_STANDARDS.md` — naming conventions, templates, lifecycle
- `docs/QUICK_START.md` — quick reference for developers
- `docs/UI_UX_PATTERNS.md` — UI/UX elements and design patterns
- `docs/setup/setup.md` — detailed setup and deployment guide
- `docs/api/*.md` — API endpoint documentation (14 files)
- `docs/permissions/permissions.md` — RBAC implementation
- `docs/database/database.md` — schema documentation
- `docs/development/architecture.md` — architecture guide
- `docs/rate-limits/*.md` — rate limiting documentation (7 files)
- `docs/events/*.md` — event system documentation (5 files)
- `docs/monitoring/*.md` — monitoring stack documentation (8 files)
- `docs/configuration/*.md` — configuration documentation (11 files)

### Documentation Organization

```text
docs/
├── requirements/    # Technical specifications (active, completed, archived)
├── analysis/        # Research and analysis (architecture, monitoring, 40+ files)
├── plans/           # Implementation plans (active, completed, roadmap, 30+ files)
├── reports/         # Execution reports (testing, deployment, monitoring, 25+ files)
├── improvements/    # Bugs, technical debt, enhancements
├── api/             # API endpoint documentation (14 files)
├── configuration/   # Environment, auth, Redis, S3, socket, theming (11 files)
├── database/        # Schema and migration docs
├── development/     # Architecture, adding pages, scaling (5 files)
├── events/          # Event system docs (5 files)
├── monitoring/      # Metrics, dashboards, error tracking (8+ files)
├── rate-limits/     # Rate limiting docs (7 files)
├── permissions/     # RBAC documentation
├── import-export/   # Bulk operations docs
├── fixes/           # Data sanitization, bug fixes
├── setup/           # Installation and deployment
├── testing/         # Test strategy and coverage
├── navigation/      # Menu maintenance
└── user-operations/ # Bulk user operations
```

### AI Workflow (docs/AI_WORKFLOW_GUIDE.md)

Six-step process for any task:

1. **ANALYSIS** → `docs/analysis/[category]/`
2. **PLAN** → `docs/plans/active/`
3. **IMPLEMENTATION** → Follow plan, update progress
4. **TESTING** → Unit/Integration/E2E, create test report
5. **REPORT** → `docs/reports/[type]/`
6. **DOCUMENTATION** → Update/create API, user, and technical docs

File naming: `[type]-[module]-[description]-[date].md`

### Adding New Pages

1. Create page: `src/app/[lang]/(dashboard)/(private)/my-module/page.tsx`
2. Add translations to all 4 dictionaries (`src/data/dictionaries/{en,ru,ar,fr}.json`)
3. Add to vertical menu: `src/components/layout/vertical/VerticalMenu.tsx`
4. Add to horizontal menu: `src/components/layout/horizontal/HorizontalMenu.tsx`
5. Restart dev server

## Key Files Reference

### Core Infrastructure

| Purpose | Path |
|---------|------|
| Lucia Auth config | `src/libs/lucia.ts` |
| Prisma client | `src/libs/prisma.ts` |
| Auth utilities (requireAuth) | `src/utils/auth/auth.ts` |
| Middleware | `middleware.ts` |
| withApiHandler + apiResponse | `src/lib/api/withApiHandler.ts` |
| Error response builder | `src/utils/apiError.ts` |
| Permissions utility | `src/utils/permissions/permissions.ts` |
| Protected roles config | `src/shared/config/protected-roles.ts` |
| Environment config | `src/shared/config/env.ts` |
| i18n config | `src/configs/i18n.ts` |

### Hooks

| Hook | Path |
|------|------|
| usePermissions | `src/hooks/usePermissions.ts` |
| useChatNew (914 lines) | `src/hooks/useChatNew.ts` |
| useTranslate | `src/hooks/useTranslate.ts` |
| useMediaUrl | `src/hooks/useMediaUrl.ts` |
| useNotifications | `src/hooks/useNotifications.ts` |
| useBulkUpload | `src/hooks/useBulkUpload.ts` |
| useUnreadMessages | `src/hooks/useUnreadMessages.ts` |

### Contexts

| Context | Path |
|---------|------|
| AuthProvider | `src/contexts/AuthProvider.tsx` |
| AccountContext | `src/contexts/AccountContext.tsx` |
| TranslationContext | `src/contexts/TranslationContext.tsx` |

### Services

| Service | Path |
|---------|------|
| EventService | `src/services/events/EventService.ts` |
| MediaService | `src/services/media/MediaService.ts` |
| StorageService | `src/services/media/storage/StorageService.ts` |
| AccountService | `src/services/accounts/AccountService.ts` |
| ExportService | `src/services/export/ExportService.ts` |
| ImportService | `src/services/import/ImportService.ts` |
| EmailService | `src/services/external/emailService.ts` |
| Data sanitization | `src/services/data-sanitization.service.ts` |
| UserRepository | `src/services/database/userRepository.ts` |
| AccountRepository | `src/services/database/accountRepository.ts` |
| MediaRepository | `src/services/database/mediaRepository.ts` |

### Rate Limiting

| Component | Path |
|-----------|------|
| RateLimitEngine | `src/lib/rate-limit/services/RateLimitEngine.ts` |
| DI Container | `src/lib/rate-limit/di/container.ts` |
| ConfigService | `src/lib/rate-limit/services/ConfigService.ts` |
| EventRecorder | `src/lib/rate-limit/services/RateLimitEventRecorder.ts` |
| StoreManager | `src/lib/rate-limit/services/StoreManager.ts` |
| Redis store | `src/lib/rate-limit/stores/redis-store.ts` |
| Prisma store | `src/lib/rate-limit/stores/prisma-store.ts` |
| Main export | `src/lib/rate-limit.ts` |

### Socket.IO

| Component | Path |
|-----------|------|
| Standalone server | `src/server/websocket-standalone.ts` |
| Socket init | `src/lib/sockets/index.ts` |
| Chat namespace | `src/lib/sockets/namespaces/chat/index.ts` |
| Notifications namespace | `src/lib/sockets/namespaces/notifications/index.ts` |

### Redux Store

| Slice | Path |
|-------|------|
| Store index | `src/redux-store/index.ts` |
| ReduxProvider | `src/redux-store/ReduxProvider.tsx` |
| chat | `src/redux-store/slices/chat.ts` |
| chatQueue | `src/redux-store/slices/chatQueue.ts` |
| notifications | `src/redux-store/slices/notifications.ts` |
| calendar | `src/redux-store/slices/calendar.ts` |
| kanban | `src/redux-store/slices/kanban.ts` |
| email | `src/redux-store/slices/email.ts` |

### Translations

| Component | Path |
|-----------|------|
| getDictionary | `src/utils/formatting/getDictionary.ts` |
| Pluralization | `src/utils/translations/pluralization.ts` |
| EN dictionary | `src/data/dictionaries/en.json` |
| RU dictionary | `src/data/dictionaries/ru.json` |
| FR dictionary | `src/data/dictionaries/fr.json` |
| AR dictionary | `src/data/dictionaries/ar.json` |
| Languages list | `src/data/languages.json` |

### Key API Routes

| Route | Path |
|-------|------|
| Register | `src/app/api/register/route.ts` |
| Auth login | `src/app/api/auth/login/route.ts` |
| Auth session | `src/app/api/auth/session/route.ts` |
| Admin users | `src/app/api/admin/users/route.ts` |
| Admin users [id] | `src/app/api/admin/users/[id]/route.ts` |
| Admin users bulk activate | `src/app/api/admin/users/bulk/activate/route.ts` |
| Admin users bulk deactivate | `src/app/api/admin/users/bulk/deactivate/route.ts` |
| Admin users bulk delete | `src/app/api/admin/users/bulk/delete/route.ts` |
| Admin roles | `src/app/api/admin/roles/route.ts` |
| Admin roles [id] | `src/app/api/admin/roles/[id]/route.ts` |
| Admin events | `src/app/api/admin/events/route.ts` |
| Admin rate-limits | `src/app/api/admin/rate-limits/route.ts` |
| Admin media | `src/app/api/admin/media/route.ts` |
| Admin media upload-async | `src/app/api/admin/media/upload-async/route.ts` |
| Admin media sync | `src/app/api/admin/media/sync/route.ts` |
| Admin media settings | `src/app/api/admin/media/settings/route.ts` |
| Admin media cleanup | `src/app/api/admin/media/cleanup/route.ts` |
| Admin services config | `src/app/api/admin/settings/services/route.ts` |
| Chat messages | `src/app/api/chat/messages/route.ts` |
| Chat rooms | `src/app/api/chat/rooms/route.ts` |
| Chat unread | `src/app/api/chat/unread/route.ts` |
| Chat rate-limit check | `src/app/api/chat/messages/check-rate-limit/route.ts` |
| Notifications | `src/app/api/notifications/route.ts` |
| Email templates | `src/app/api/settings/email-templates/route.ts` |
| SMTP config | `src/app/api/settings/smtp/route.ts` |
| SMTP test | `src/app/api/settings/smtp/test/route.ts` |
| Export | `src/app/api/export/route.ts` |
| Import | `src/app/api/import/route.ts` |
| Import preview | `src/app/api/import/preview/route.ts` |
| Accounts | `src/app/api/accounts/route.ts` |
| Health check | `src/app/api/health/route.ts` |
| Metrics | `src/app/api/metrics/route.ts` |
| Verify email | `src/app/api/verify/email/route.ts` |

### Config Files

| File | Path |
|------|------|
| Next.js config | `next.config.ts` |
| TypeScript config | `tsconfig.json` |
| Tailwind config | `tailwind.config.ts` |
| PostCSS config | `postcss.config.mjs` |
| Vitest config | `vitest.config.js` |
| Playwright config | `playwright.config.ts` |
| Prisma schema (SQLite) | `prisma/schema.prisma` |
| Prisma schema (PostgreSQL) | `prisma/schema.postgresql.prisma` |
| Prisma seed | `prisma/seed.ts` |
| Environment example | `.env.example` |
| SMTP settings | `smtp-settings.json` |
| Docker compose (main) | `docker-compose.dev.yml` |
| Docker compose (PostgreSQL) | `postgresql/docker-compose.yml` |

---

## Code Conventions

- Always use `withApiHandler()` or `withPublicHandler()` for API routes
- Check permissions server-side via `requireAuth()` and permission utilities
- Use Zod for validation everywhere (forms, API routes)
- Implement i18n for all user-facing strings (all 4 dictionaries)
- Add Prometheus metrics and audit events for important operations
- Write tests for services and API routes
- Keep business logic in `src/services/`, not in API route handlers
- Use cursor-based pagination for large result sets
- Use correlation IDs for request tracing across services
- Non-blocking external calls: SMS/email failures should not block core operations
- Test-aware rate limiting: use `test:` prefix for test environment
- Role identification by immutable `code`, never by `name`
- TypeScript strict mode: explicit types, no `any`
- React: functional components with hooks only
- Components: PascalCase, utilities: camelCase, hooks: `useXxx`, constants: SCREAMING_SNAKE_CASE
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
