---
name: service
description: Create a new service with singleton pattern and optional repository. Use when implementing business logic, creating new feature modules, or adding service layers. Activates for "create service", "new service", "add business logic".
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Create Service

Generate a new service following project patterns (singleton + repository).

## Usage

`/service <service-name>` — e.g., `/service tariff`, `/service invoice`

## Argument: $ARGUMENTS

## Steps

1. **Ask the user** (if not clear from argument):
   - Service name (e.g., `tariff`)
   - Prisma model it operates on
   - Whether it needs a repository (data-heavy = yes)
   - External dependencies (other services, APIs)

2. **Create files** based on templates below.

3. **Verify** — run `pnpm lint` on new files.

## File Locations

- Service: `src/services/<name>/`
- Repository: `src/services/database/<name>Repository.ts`

## Service Template (Singleton Pattern)

**Path:** `src/services/<name>/<Name>Service.ts`

```typescript
import { prisma } from '@/libs/prisma'
import logger from '@/lib/logger'
import { eventService } from '@/services/events/EventService'
import type { Prisma } from '@prisma/client'

export class NameService {
  private static instance: NameService

  static getInstance(): NameService {
    if (!NameService.instance) {
      NameService.instance = new NameService()
    }

    return NameService.instance
  }

  /**
   * Get all items
   */
  async findAll(options?: {
    skip?: number
    take?: number
    where?: Prisma.ModelWhereInput
    orderBy?: Prisma.ModelOrderByWithRelationInput
  }) {
    return prisma.model.findMany({
      skip: options?.skip,
      take: options?.take,
      where: options?.where,
      orderBy: options?.orderBy ?? { createdAt: 'desc' }
    })
  }

  /**
   * Get by ID
   */
  async findById(id: string) {
    const item = await prisma.model.findUnique({
      where: { id }
    })

    if (!item) {
      throw new Error(`Model with id ${id} not found`)
    }

    return item
  }

  /**
   * Create
   */
  async create(data: Prisma.ModelCreateInput, actorId?: string) {
    const item = await prisma.model.create({ data })

    // Record event (non-blocking)
    if (actorId) {
      eventService.record({
        source: 'MODULE_NAME',
        module: 'MODULE_NAME',
        type: 'MODULE_NAME.created',
        severity: 'info',
        actor: { type: 'user', id: actorId },
        subject: { type: 'model', id: item.id },
        message: `Model created: ${item.id}`,
        payload: { itemId: item.id }
      }).catch(err => {
        logger.warn('[MODULE_NAME] Failed to record event', { error: err })
      })
    }

    return item
  }

  /**
   * Update
   */
  async update(id: string, data: Prisma.ModelUpdateInput, actorId?: string) {
    const item = await prisma.model.update({
      where: { id },
      data
    })

    if (actorId) {
      eventService.record({
        source: 'MODULE_NAME',
        module: 'MODULE_NAME',
        type: 'MODULE_NAME.updated',
        severity: 'info',
        actor: { type: 'user', id: actorId },
        subject: { type: 'model', id },
        message: `Model updated: ${id}`,
        payload: { itemId: id, changes: data }
      }).catch(err => {
        logger.warn('[MODULE_NAME] Failed to record event', { error: err })
      })
    }

    return item
  }

  /**
   * Delete
   */
  async delete(id: string, actorId?: string) {
    const item = await prisma.model.delete({
      where: { id }
    })

    if (actorId) {
      eventService.record({
        source: 'MODULE_NAME',
        module: 'MODULE_NAME',
        type: 'MODULE_NAME.deleted',
        severity: 'warning',
        actor: { type: 'user', id: actorId },
        subject: { type: 'model', id },
        message: `Model deleted: ${id}`,
        payload: { itemId: id }
      }).catch(err => {
        logger.warn('[MODULE_NAME] Failed to record event', { error: err })
      })
    }

    return item
  }
}

// Export singleton instance
export const nameService = NameService.getInstance()
```

## Index File

**Path:** `src/services/<name>/index.ts`

```typescript
export { NameService, nameService } from './NameService'
```

## Repository Template (Optional — for data-heavy modules)

**Path:** `src/services/database/<name>Repository.ts`

```typescript
import { prisma } from '@/libs/prisma'
import type { Prisma, Model } from '@prisma/client'

export class NameRepository {
  async findById(id: string): Promise<Model | null> {
    return prisma.model.findUnique({
      where: { id }
    })
  }

  async findByField(field: string): Promise<Model | null> {
    return prisma.model.findUnique({
      where: { field }
    })
  }

  async create(data: Prisma.ModelCreateInput): Promise<Model> {
    return prisma.model.create({ data })
  }

  async update(id: string, data: Prisma.ModelUpdateInput): Promise<Model> {
    return prisma.model.update({
      where: { id },
      data
    })
  }

  async delete(id: string): Promise<Model> {
    return prisma.model.delete({
      where: { id }
    })
  }

  async findMany(options?: {
    skip?: number
    take?: number
    where?: Prisma.ModelWhereInput
    orderBy?: Prisma.ModelOrderByWithRelationInput | Prisma.ModelOrderByWithRelationInput[]
    select?: Prisma.ModelSelect
    include?: Prisma.ModelInclude
  }): Promise<Model[]> {
    return prisma.model.findMany(options)
  }

  async count(where?: Prisma.ModelWhereInput): Promise<number> {
    return prisma.model.count({ where })
  }
}

export const nameRepository = new NameRepository()
```

## When Service Needs a Repository

| Scenario | Use Repository? |
|----------|----------------|
| Simple CRUD with 1 model | No — Prisma directly in service |
| Complex queries, joins, aggregations | Yes |
| Multiple services access same model | Yes — single source of truth |
| Need to mock DB in tests | Yes — easier to mock |

## Service Conventions

- **Singleton** via `static getInstance()` for stateful services
- **Repository** is a plain class (no singleton) — instantiated once and exported
- **Events** are non-blocking (`.catch()` on record)
- **Errors** throw with descriptive messages
- **Logger** for warnings/errors with module prefix `[MODULE_NAME]`
- **Types** from Prisma (`Prisma.ModelCreateInput`, etc.)
- **No HTTP concerns** — services don't know about Request/Response
- **Lazy init** for expensive resources (Redis, external APIs)

## Checklist

- [ ] Service created in `src/services/<name>/`
- [ ] Singleton pattern with `getInstance()`
- [ ] Index file re-exports service
- [ ] Repository created (if needed) in `src/services/database/`
- [ ] Events recorded for CUD operations
- [ ] Logger used for errors/warnings
- [ ] Types imported from Prisma
- [ ] No HTTP/Request/Response imports in service
- [ ] `pnpm lint` passes
