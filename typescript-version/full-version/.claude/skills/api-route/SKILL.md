---
name: api
description: Generate a new API route following project conventions. Use when creating new API endpoints with authentication, permissions, validation, events, metrics, and logging. Activates for tasks like "create API for ...", "add endpoint for ...", "new route for ...".
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Create API Route

Generate a new API route following project conventions.

## Usage

`/api <module-name>` — e.g., `/api tariffs`, `/api invoices`

## Argument: $ARGUMENTS

## Steps

1. **Ask the user** (if not clear from argument):
   - Module name (e.g., `tariffs`)
   - CRUD operations needed (GET list, GET by id, POST, PUT, DELETE)
   - Permission module and actions (e.g., `tariffManagement.read`)
   - Whether it's admin or public route

2. **Create files** based on the patterns below.

3. **After creation**, verify with `pnpm lint` on new files.

## File Locations

- Admin routes: `src/app/api/admin/<module>/route.ts` and `src/app/api/admin/<module>/[id]/route.ts`
- Public routes: `src/app/api/<module>/route.ts`
- Validation schemas: `src/lib/validations/<module>-schemas.ts`

## Route Template (Static: GET list + POST)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { checkPermission, isSuperadmin } from '@/utils/permissions/permissions'
import logger from '@/lib/logger'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

const getRequestContext = (request: NextRequest, extra?: Record<string, unknown>) => ({
  requestId: request.headers.get('x-request-id') ?? undefined,
  path: request.nextUrl.pathname,
  method: request.method,
  ...extra
})

// GET — List all
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || (!isSuperadmin(currentUser) && !checkPermission(currentUser, 'MODULE', 'read'))) {
      return NextResponse.json({ message: 'Permission denied' }, { status: 403 })
    }

    const items = await prisma.MODEL.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(items)
  } catch (error) {
    logger.error('[MODULE] Error fetching', { ...getRequestContext(request), error })

    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// POST — Create
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: user.email },
      include: { role: true }
    })

    if (!currentUser || (!isSuperadmin(currentUser) && !checkPermission(currentUser, 'MODULE', 'create'))) {
      return NextResponse.json({ message: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()

    // TODO: Add Zod validation
    // const validation = createSchema.safeParse(body)
    // if (!validation.success) {
    //   return NextResponse.json({ message: formatZodError(validation.error) }, { status: 400 })
    // }

    const item = await prisma.MODEL.create({
      data: { ...body }
    })

    // Record event
    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'MODULE',
      module: 'MODULE',
      type: 'MODULE.created',
      severity: 'info',
      actor: { type: 'user', id: currentUser.id },
      subject: { type: 'MODEL', id: item.id },
      message: `MODEL created`,
      payload: { itemId: item.id }
    })).catch(err => {
      logger.warn('[MODULE] Failed to record event', { error: err })
    })

    return NextResponse.json(item)
  } catch (error) {
    logger.error('[MODULE] Error creating', { ...getRequestContext(request), error })

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ message: 'Already exists' }, { status: 400 })
    }

    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
```

## Route Template (Dynamic: GET by id + PUT + DELETE)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { requireAuth } from '@/utils/auth/auth'
import { prisma } from '@/libs/prisma'
import { checkPermission, isSuperadmin } from '@/utils/permissions/permissions'
import logger from '@/lib/logger'
import { eventService } from '@/services/events/EventService'
import { enrichEventInputFromRequest } from '@/services/events/event-helpers'

// GET by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { user } = await requireAuth(request)

    if (!user?.email) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const item = await prisma.MODEL.findUnique({ where: { id } })

    if (!item) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(item)
  } catch (error) {
    logger.error('[MODULE] Error fetching by id', { id, error })

    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// PUT — Update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { user } = await requireAuth(request)
    // ... auth + permission checks (same pattern as POST)

    const body = await request.json()

    const item = await prisma.MODEL.update({
      where: { id },
      data: { ...body }
    })

    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'MODULE',
      module: 'MODULE',
      type: 'MODULE.updated',
      severity: 'info',
      actor: { type: 'user', id: currentUser.id },
      subject: { type: 'MODEL', id },
      message: `MODEL updated`,
      payload: { itemId: id, changes: body }
    })).catch(err => logger.warn('[MODULE] Failed to record event', { error: err }))

    return NextResponse.json(item)
  } catch (error) {
    logger.error('[MODULE] Error updating', { id, error })

    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

// DELETE
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { user } = await requireAuth(request)
    // ... auth + permission checks

    await prisma.MODEL.delete({ where: { id } })

    await eventService.record(enrichEventInputFromRequest(request, {
      source: 'MODULE',
      module: 'MODULE',
      type: 'MODULE.deleted',
      severity: 'warning',
      actor: { type: 'user', id: currentUser.id },
      subject: { type: 'MODEL', id },
      message: `MODEL deleted`,
      payload: { itemId: id }
    })).catch(err => logger.warn('[MODULE] Failed to record event', { error: err }))

    return NextResponse.json({ message: 'Deleted successfully' })
  } catch (error) {
    logger.error('[MODULE] Error deleting', { id, error })

    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
```

## Zod Validation Template

```typescript
// src/lib/validations/<module>-schemas.ts
import { z } from 'zod'

export const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  isActive: z.boolean().default(true)
})

export const updateSchema = createSchema.partial()

export type CreateInput = z.infer<typeof createSchema>
export type UpdateInput = z.infer<typeof updateSchema>
```

## Checklist

After creating the route:

- [ ] Auth check with `requireAuth()`
- [ ] Permission check with `checkPermission()` or `isSuperadmin()`
- [ ] Zod validation for POST/PUT bodies
- [ ] Event recording with `eventService.record()`
- [ ] Error logging with `logger.error()`
- [ ] Prisma error handling (P2002 for unique conflicts)
- [ ] Dynamic params as `Promise<{ id: string }>`
- [ ] No `apiResponse` helpers — use `NextResponse.json()` directly
