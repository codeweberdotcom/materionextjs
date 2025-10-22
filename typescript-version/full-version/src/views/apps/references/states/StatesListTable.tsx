'use client'

// React Imports
import { useEffect, useState, useMemo } from 'react'

// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import Switch from '@mui/material/Switch'
import { styled } from '@mui/material/styles'
import TablePagination from '@mui/material/TablePagination'
import type { TextFieldProps } from '@mui/material/TextField'

// Third-party Imports
import classnames from 'classnames'
import { rankItem } from '@tanstack/match-sorter-utils'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
  getPaginationRowModel,
  getSortedRowModel
} from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import type { RankingInfo } from '@tanstack/match-sorter-utils'
import { toast } from 'react-toastify'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { Locale } from '@configs/i18n'

// Style Imports
import tableStyles from '@core/styles/table.module.css'

declare module '@tanstack/table-core' {
  interface FilterFns {
    fuzzy: FilterFn<unknown>
  }
  interface FilterMeta {
    itemRank: RankingInfo
  }
}

type State = {
  id: string
  name: string
  code: string
  isActive: boolean
  country: {
    id: string
    name: string
    code: string
  }
  region?: {
    id: string
    name: string
    code: string
  }
}

const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)
  addMeta({ itemRank })
  return itemRank.passed
}

const DebouncedInput = ({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
} & Omit<TextFieldProps, 'onChange'>) => {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value)
    }, debounce)

    return () => clearTimeout(timeout)
  }, [value])

  return <TextField {...props} value={value} onChange={e => setValue(e.target.value)} size='small' />
}

const columnHelper = createColumnHelper<State>()

const StatesListTable = () => {
  const [data, setData] = useState<State[]>([])
  const [filteredData, setFilteredData] = useState(data)
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const { lang: locale } = useParams()

  // Fetch states data
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await fetch('/api/states')
        if (response.ok) {
          const states = await response.json()
          setData(states)
          setFilteredData(states)
        }
      } catch (error) {
        console.error('Error fetching states:', error)
        toast.error('Failed to load states')
      } finally {
        setLoading(false)
      }
    }

    fetchStates()
  }, [])

  const columns = useMemo<ColumnDef<State, any>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          {...{
            checked: table.getIsAllRowsSelected(),
            indeterminate: table.getIsSomeRowsSelected(),
            onChange: table.getToggleAllRowsSelectedHandler()
          }}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          {...{
            checked: row.getIsSelected(),
            disabled: !row.getCanSelect(),
            indeterminate: row.getIsSomeSelected(),
            onChange: row.getToggleSelectedHandler()
          }}
        />
      )
    },
    columnHelper.accessor('name', {
      header: 'State',
      cell: ({ row }) => <Typography>{row.original.name}</Typography>
    }),
    columnHelper.accessor('code', {
      header: 'Code',
      cell: ({ row }) => <Typography>{row.original.code}</Typography>
    }),
    columnHelper.accessor('country.name', {
      header: 'Country',
      cell: ({ row }) => <Typography>{row.original.country.name}</Typography>
    }),
    columnHelper.accessor('region.name', {
      header: 'Region',
      cell: ({ row }) => <Typography>{row.original.region?.name || 'N/A'}</Typography>
    }),
    columnHelper.accessor('isActive', {
      header: 'Status',
      cell: ({ row }) => (
        <Chip
          variant='tonal'
          label={row.original.isActive ? 'Active' : 'Inactive'}
          size='small'
          color={row.original.isActive ? 'success' : 'secondary'}
        />
      )
    }),
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className='flex items-center'>
          <IconButton onClick={() => handleEditState(row.original)} title='Edit State'>
            <i className='ri-edit-line text-textSecondary' />
          </IconButton>
          <Switch
            checked={row.original.isActive}
            onChange={() => handleToggleStateStatus(row.original.id)}
            size='small'
          />
          <IconButton onClick={() => handleDeleteState(row.original.id, row.original.name)} title='Delete State'>
            <i className='ri-delete-bin-7-line text-textSecondary' />
          </IconButton>
        </div>
      ),
      enableSorting: false
    }
  ], [data])

  const table = useReactTable({
    data: filteredData,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter
    },
    state: {
      globalFilter
    },
    initialState: {
      pagination: {
        pageSize: 10
      }
    },
    enableRowSelection: true,
    globalFilterFn: fuzzyFilter,
    getCoreRowModel: getCoreRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues()
  })

  const handleDeleteState = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete state "${name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/references/states/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const updatedData = data.filter(state => state.id !== id)
        setData(updatedData)
        setFilteredData(updatedData)
        toast.success('State deleted successfully!')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to delete state')
      }
    } catch (error) {
      console.error('Error deleting state:', error)
      toast.error('Failed to delete state')
    }
  }

  const handleEditState = (state: State) => {
    toast.info('Edit functionality will be implemented')
  }

  const handleToggleStateStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/references/states/${id}`, {
        method: 'PATCH'
      })

      if (response.ok) {
        const updatedState = await response.json()
        const updatedData = data.map(state =>
          state.id === updatedState.id ? updatedState : state
        )
        setData(updatedData)
        setFilteredData(updatedData)
        toast.success(`State ${updatedState.isActive ? 'activated' : 'deactivated'} successfully!`)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to toggle state status')
      }
    } catch (error) {
      console.error('Error toggling state status:', error)
      toast.error('Failed to toggle state status')
    }
  }

  if (loading) {
    return <Typography>Loading states...</Typography>
  }

  return (
    <Card>
      <CardHeader title='States Management' />
      <Divider />
      <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
        <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
          <DebouncedInput
            value={globalFilter ?? ''}
            onChange={value => setGlobalFilter(String(value))}
            placeholder='Search State'
            className='max-sm:is-full'
          />
        </div>
      </div>
      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div
                        className={classnames({
                          'flex items-center': header.column.getIsSorted(),
                          'cursor-pointer select-none': header.column.getCanSort()
                        })}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <i className='ri-arrow-up-s-line text-xl' />,
                          desc: <i className='ri-arrow-down-s-line text-xl' />
                        }[header.column.getIsSorted() as 'asc' | 'desc'] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          {table.getFilteredRowModel().rows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={table.getVisibleFlatColumns().length} className='text-center'>
                  No data available
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {table
                .getRowModel()
                .rows.slice(0, table.getState().pagination.pageSize)
                .map(row => (
                  <tr key={row.id} className={classnames({ selected: row.getIsSelected() })}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
            </tbody>
          )}
        </table>
      </div>
      <TablePagination
        rowsPerPageOptions={[10, 25, 50]}
        component='div'
        className='border-bs'
        count={table.getFilteredRowModel().rows.length}
        rowsPerPage={table.getState().pagination.pageSize}
        page={table.getState().pagination.pageIndex}
        onPageChange={(_, page) => table.setPageIndex(page)}
        onRowsPerPageChange={e => table.setPageSize(Number(e.target.value))}
      />
    </Card>
  )
}

export default StatesListTable