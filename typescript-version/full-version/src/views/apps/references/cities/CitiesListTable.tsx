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

type City = {
  id: string
  name: string
  code: string
  isActive: boolean
  state: {
    id: string
    name: string
    code: string
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

const columnHelper = createColumnHelper<City>()

const CitiesListTable = () => {
  const [data, setData] = useState<City[]>([])
  const [filteredData, setFilteredData] = useState(data)
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const { lang: locale } = useParams()

  // Fetch cities data
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const response = await fetch('/api/cities')
        if (response.ok) {
          const cities = await response.json()
          setData(cities)
          setFilteredData(cities)
        }
      } catch (error) {
        console.error('Error fetching cities:', error)
        toast.error('Failed to load cities')
      } finally {
        setLoading(false)
      }
    }

    fetchCities()
  }, [])

  const columns = useMemo<ColumnDef<City, any>[]>(() => [
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
      header: 'City',
      cell: ({ row }) => <Typography>{row.original.name}</Typography>
    }),
    columnHelper.accessor('code', {
      header: 'Code',
      cell: ({ row }) => <Typography>{row.original.code}</Typography>
    }),
    columnHelper.accessor('state.name', {
      header: 'State',
      cell: ({ row }) => <Typography>{row.original.state.name}</Typography>
    }),
    columnHelper.accessor('state.country.name', {
      header: 'Country',
      cell: ({ row }) => <Typography>{row.original.state.country.name}</Typography>
    }),
    columnHelper.accessor('state.region.name', {
      header: 'Region',
      cell: ({ row }) => <Typography>{row.original.state.region?.name || 'N/A'}</Typography>
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
          <IconButton onClick={() => handleEditCity(row.original)}>
            <i className='ri-edit-line text-textSecondary' />
          </IconButton>
          <IconButton onClick={() => handleDeleteCity(row.original.id, row.original.name)}>
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

  const handleDeleteCity = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete city "${name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/references/cities/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const updatedData = data.filter(city => city.id !== id)
        setData(updatedData)
        setFilteredData(updatedData)
        toast.success('City deleted successfully!')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to delete city')
      }
    } catch (error) {
      console.error('Error deleting city:', error)
      toast.error('Failed to delete city')
    }
  }

  const handleEditCity = (city: City) => {
    toast.info('Edit functionality will be implemented')
  }

  if (loading) {
    return <Typography>Loading cities...</Typography>
  }

  return (
    <Card>
      <CardHeader title='Cities Management' />
      <Divider />
      <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
        <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
          <DebouncedInput
            value={globalFilter ?? ''}
            onChange={value => setGlobalFilter(String(value))}
            placeholder='Search City'
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

export default CitiesListTable