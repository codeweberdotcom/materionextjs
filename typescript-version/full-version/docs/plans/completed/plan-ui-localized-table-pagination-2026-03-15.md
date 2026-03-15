# Plan: LocalizedTablePagination Component

**Date:** 2026-03-15
**Module:** UI / Tables
**Status:** Completed
**Analysis:** [analysis-ui-table-pagination-duplication-2026-03-15.md](../../analysis/ui/analysis-ui-table-pagination-duplication-2026-03-15.md)

## Goal

Устранить дублирование `<TablePagination>` в 8 таблицах, создав переиспользуемый компонент.

## Steps

1. Создать `src/components/LocalizedTablePagination.tsx`
   - Props: `dictionary` (from `useTranslation`), `table` (TanStack `Table<any>`), `rowsPerPageOptions?` (default `[10, 25, 50]`)
   - Инкапсулировать все локализованные пропсы и привязку к table

2. Заменить `<TablePagination>` на `<LocalizedTablePagination>` в:
   - `src/views/apps/references/cities/CitiesListTable.tsx`
   - `src/views/apps/references/countries/CountriesListTable.tsx`
   - `src/views/apps/references/states/StatesListTable.tsx`
   - `src/views/apps/references/districts/DistrictsListTable.tsx`
   - `src/views/apps/references/currencies/CurrenciesListTable.tsx`
   - `src/views/apps/references/languages/LanguagesListTable.tsx`
   - `src/views/apps/references/translations/TranslationsListTable.tsx`
   - `src/views/apps/roles/RolesTable.tsx`

3. Удалить `import TablePagination from '@mui/material/TablePagination'` из всех 8 файлов

4. Проверить `pnpm lint`

## What NOT Changed

- Никаких изменений в API, сервисах, стилях или словарях
- `rowsPerPageOptions` остаётся настраиваемым per-table через проп

## Dependencies

- `dictionary.navigation.rowsPerPage` — ключ в словарях
- `dictionary.navigation.of` — ключ в словарях
- TanStack React Table (`@tanstack/react-table`)
