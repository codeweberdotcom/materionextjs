# Bulk Reference Operations Documentation

## Overview

The bulk reference operations feature allows administrators to perform mass actions on multiple reference records (Countries, States, Cities, Districts) simultaneously. Built on top of the universal `BulkOperationsService`, it uses a factory pattern for configs and a shared hook for UI logic.

**Last Updated:** 2026-03-15
**Status:** Fully implemented with shared hook, factory configs, metrics, and events

## Features

### 1. Supported Entities

| Entity | Permission Module | API Base Path |
|--------|------------------|---------------|
| Countries | `countryManagement` | `/api/admin/references/countries/bulk/` |
| States | `stateManagement` | `/api/admin/references/states/bulk/` |
| Cities | `cityManagement` | `/api/admin/references/cities/bulk/` |
| Districts | `districtManagement` | `/api/admin/references/districts/bulk/` |

### 2. Supported Operations

#### Bulk Activate
- Sets `isActive: true` on all selected records
- Permission: `{module}.update`

#### Bulk Deactivate
- Sets `isActive: false` on all selected records
- Permission: `{module}.update`

#### Bulk Delete
- Permanently removes all selected records
- Permission: `{module}.delete`
- Requires confirmation dialog

### 3. Safety Features

#### Permission-Based Access
- **Delete**: Requires `canDelete` permission for the entity
- **Activate/Deactivate**: Requires `canUpdate` permission for the entity
- **Double protection**: UI hides buttons + API checks permissions server-side

#### Validation
- Zod schema `bulkReferenceOperationSchema` validates `{ ids: string[] }`
- Min 1, max 1000 IDs per request
- Empty selection disables all bulk buttons

## Technical Implementation

### Architecture

```
UI Table → useReferenceBulkOperations hook → fetch API
                                                ↓
Route (4 lines) → _bulk-handler.ts → BulkOperationsService
                                                ↓
                                    Prisma transaction + Events + Metrics
```

### Shared Hook: `useReferenceBulkOperations`

**Location:** `src/hooks/useReferenceBulkOperations.ts`

Eliminates ~80 lines of duplicated bulk logic per table. All 4 reference tables use this hook.

```typescript
const bulk = useReferenceBulkOperations({
  entity: 'countries',           // API path segment
  refetchUrl: `/api/countries?locale=${locale}`,
  filteredData,                  // Current table data
  setData,                       // State setter
  setFilteredData,               // Filtered state setter
  dictionary                     // i18n dictionary
})

// Returns:
// bulk.rowSelection, bulk.setRowSelection — for useReactTable state
// bulk.selectedCount — number of selected rows
// bulk.bulkLoading — any bulk operation in progress
// bulk.bulkDeleteLoading, bulk.bulkActivateLoading, bulk.bulkDeactivateLoading
// bulk.handleBulkDelete() — delete with confirmation
// bulk.handleBulkStatusChange(activate: boolean) — activate/deactivate
```

### Config Factory: `createReferenceBulkConfigs`

**Location:** `src/services/bulk/configs/referenceBulkConfig.ts`

Generates 3 configs (activate/deactivate/delete) from minimal parameters:

```typescript
const countryConfigs = createReferenceBulkConfigs(
  'country',              // Prisma model name
  'countryManagement',    // Permission module
  'countries',            // Event module (plural)
  (tx) => tx.country      // Prisma delegate
)
```

A config registry is also exported for future dynamic route support:

```typescript
export const referenceBulkConfigRegistry: Record<string, ReferenceBulkConfigs> = {
  countries: countryConfigs,
  states: stateConfigs,
  cities: cityConfigs,
  districts: districtConfigs
}
```

### Shared Handler: `_bulk-handler.ts`

**Location:** `src/app/api/admin/references/_bulk-handler.ts`

Single function `handleBulkOperation` handles auth, validation, context creation, and delegates to `BulkOperationsService`:

```typescript
export async function handleBulkOperation(
  request: NextRequest,
  config: BulkOperationConfig,
  operationType: 'update' | 'delete',
  operationLabel: string
)
```

### Route Files

Each route is minimal (4 lines):

```typescript
// src/app/api/admin/references/countries/bulk/activate/route.ts
import type { NextRequest } from 'next/server'
import { handleBulkOperation } from '../../../_bulk-handler'
import { countryBulkActivateConfig } from '@/services/bulk/configs/referenceBulkConfig'

export async function POST(request: NextRequest) {
  return handleBulkOperation(request, countryBulkActivateConfig, 'update', 'activated countries')
}
```

## API Endpoints

### Activate

```
POST /api/admin/references/{entity}/bulk/activate
Body: { "ids": ["id1", "id2", ...] }
Response: { "success": true, "affected": 5, "skipped": 0, "message": "..." }
```

### Deactivate

```
POST /api/admin/references/{entity}/bulk/deactivate
Body: { "ids": ["id1", "id2", ...] }
Response: { "success": true, "affected": 5, "skipped": 0, "message": "..." }
```

### Delete

```
POST /api/admin/references/{entity}/bulk/delete
Body: { "ids": ["id1", "id2", ...] }
Response: { "success": true, "deleted": 5, "skipped": 0, "message": "..." }
```

### Error Responses

- `400` — Validation error or operation failed
- `401` — Unauthorized
- `403` — Permission denied
- `500` — Internal server error

## Internationalization

### Translation Keys Used

```json
{
  "bulkDelete": "Delete",
  "bulkActivate": "Activate",
  "bulkDeactivate": "Deactivate",
  "bulkDeleteConfirm": "Are you sure you want to delete ${count} selected records?",
  "bulkOperationSuccess": "Operation completed successfully for ${successCount} records",
  "bulkOperationFailed": "Operation failed"
}
```

All keys available in EN, RU, AR, FR.

## Adding a New Reference Entity

To add bulk operations for a new reference (e.g. Currency):

1. **Config** — Add to `referenceBulkConfig.ts`:
```typescript
const currencyConfigs = createReferenceBulkConfigs('currency', 'currencyManagement', 'currencies', (tx) => tx.currency)
export const currencyBulkActivateConfig = currencyConfigs.activate
export const currencyBulkDeactivateConfig = currencyConfigs.deactivate
export const currencyBulkDeleteConfig = currencyConfigs.delete
```

2. **Routes** — Create 3 files in `src/app/api/admin/references/currencies/bulk/{activate,deactivate,delete}/route.ts`

3. **UI** — Add hook to the table:
```typescript
const bulk = useReferenceBulkOperations({
  entity: 'currencies',
  refetchUrl: `/api/currencies?locale=${locale}`,
  filteredData, setData, setFilteredData, dictionary
})
```

## Monitoring

### Audit Events

| Event Type | When |
|-----------|------|
| `references.bulk_activate` | Operation started |
| `references.bulk_activate_success` | Operation completed |
| `references.bulk_activate_error` | Operation failed |

Same pattern for `deactivate` and `delete`.

### Prometheus Metrics

Tracked via `BulkOperationsService`:
- `bulk_operation_duration_seconds` — operation duration
- `bulk_operation_success_total` — successful operations count
- `bulk_operation_failure_total` — failed operations count

## Related Documents

- [Bulk User Operations](bulk-user-operations.md) — similar feature for users
- [Analysis](../analysis/architecture/analysis-bulk-references-refactoring-2026-03-15.md)
- [Refactoring Report](../reports/weekly/report-bulk-references-refactoring-2026-03-15.md)
