# Analysis: TablePagination Duplication in List Tables

**Date:** 2026-03-15
**Module:** UI / Tables
**Status:** Completed

## Current State

The `<TablePagination>` component from MUI is used in 8 list tables across the project. Each table contains an identical block of 11 lines:

```tsx
<TablePagination
  rowsPerPageOptions={[10, 25, 50]}
  component='div'
  className='border-bs'
  labelRowsPerPage={dictionary.navigation.rowsPerPage}
  labelDisplayedRows={({ from, to, count }) =>
    `${from}–${to} ${dictionary.navigation.of} ${count !== -1 ? count : `> ${to}`}`
  }
  count={table.getFilteredRowModel().rows.length}
  rowsPerPage={table.getState().pagination.pageSize}
  page={table.getState().pagination.pageIndex}
  onPageChange={(_, page) => table.setPageIndex(page)}
  onRowsPerPageChange={e => table.setPageSize(Number(e.target.value))}
/>
```

### Affected Files

1. `src/views/apps/references/cities/CitiesListTable.tsx`
2. `src/views/apps/references/countries/CountriesListTable.tsx`
3. `src/views/apps/references/states/StatesListTable.tsx`
4. `src/views/apps/references/districts/DistrictsListTable.tsx`
5. `src/views/apps/references/currencies/CurrenciesListTable.tsx`
6. `src/views/apps/references/languages/LanguagesListTable.tsx`
7. `src/views/apps/references/translations/TranslationsListTable.tsx`
8. `src/views/apps/roles/RolesTable.tsx`

## Problems

1. **DRY violation** — 88 строк дублированного кода (11 x 8 файлов)
2. **Локализация** — изменение формата отображения (например, "of" → "из") требует правки в 8 файлах
3. **Риск рассинхронизации** — в RolesTable уже был другой формат (`${from}-${to}` вместо `${from}–${to}`, без обработки `count === -1`)

## Alternatives Considered

1. **MUI theme defaultProps** — задать `labelDisplayedRows` глобально. Минус: тема не имеет доступа к dictionary/контексту локализации.
2. **Wrapper component** — компонент-обёртка, принимающий `dictionary` и `table`. Плюс: чистый, расширяемый, не зависит от глобального состояния.
3. **Custom hook** — хук, возвращающий пропсы. Минус: всё равно нужен `<TablePagination>` в каждом файле.

## Conclusion

Вариант 2 (wrapper component) — оптимальный. Минимальные изменения, максимальное устранение дублирования, легко расширяется для будущих таблиц.
