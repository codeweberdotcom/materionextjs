'use client'

// MUI Imports
import TablePagination from '@mui/material/TablePagination'

// Third-party Imports
import type { Table } from '@tanstack/react-table'

type LocalizedTablePaginationProps = {
  dictionary: { navigation: Record<string, string> }
  table: Table<any>
  rowsPerPageOptions?: number[]
}

const LocalizedTablePagination = ({
  dictionary,
  table,
  rowsPerPageOptions = [10, 25, 50]
}: LocalizedTablePaginationProps) => {
  return (
    <TablePagination
      rowsPerPageOptions={rowsPerPageOptions}
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
  )
}

export default LocalizedTablePagination
