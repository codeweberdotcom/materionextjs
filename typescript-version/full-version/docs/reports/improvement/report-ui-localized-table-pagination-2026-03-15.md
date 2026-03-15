# Report: LocalizedTablePagination Component

**Date:** 2026-03-15
**Type:** Improvement
**Module:** UI / Tables
**Status:** Completed

## Summary

Extracted duplicated `<TablePagination>` block (11 lines, repeated in 8 files) into a reusable `LocalizedTablePagination` component.

## Problem

Every list table (7 references + RolesTable) contained an identical `<TablePagination>` block with:
- `rowsPerPageOptions={[10, 25, 50]}`
- `labelRowsPerPage` from dictionary
- `labelDisplayedRows` with localized "of" text
- TanStack table bindings (count, pageSize, pageIndex, handlers)

This violated DRY and made localization changes require editing 8+ files.

## Solution

Created `src/components/LocalizedTablePagination.tsx` — a wrapper component that accepts:
- `dictionary` — from `useTranslation()` hook
- `table` — TanStack `Table<any>` instance
- `rowsPerPageOptions` — optional, defaults to `[10, 25, 50]`

### Usage

```tsx
<LocalizedTablePagination dictionary={dictionary} table={table} />
```

## Files Changed

| File | Action |
|------|--------|
| `src/components/LocalizedTablePagination.tsx` | Created |
| `src/views/apps/references/cities/CitiesListTable.tsx` | Replaced TablePagination block |
| `src/views/apps/references/countries/CountriesListTable.tsx` | Replaced TablePagination block |
| `src/views/apps/references/states/StatesListTable.tsx` | Replaced TablePagination block |
| `src/views/apps/references/districts/DistrictsListTable.tsx` | Replaced TablePagination block |
| `src/views/apps/references/currencies/CurrenciesListTable.tsx` | Replaced TablePagination block |
| `src/views/apps/references/languages/LanguagesListTable.tsx` | Replaced TablePagination block |
| `src/views/apps/references/translations/TranslationsListTable.tsx` | Replaced TablePagination block |
| `src/views/apps/roles/RolesTable.tsx` | Replaced TablePagination block |

## Verification

- `pnpm lint` — no new errors (import order auto-fixed)
- All 8 tables use the same component with consistent localization

## Notes

- Future tables should use `LocalizedTablePagination` instead of raw `TablePagination`
- The component uses `dictionary.navigation.rowsPerPage` and `dictionary.navigation.of` keys
- `rowsPerPageOptions` can be overridden per-table if needed
