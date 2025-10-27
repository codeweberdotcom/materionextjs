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

// Component Imports
import AddCountryDialog from './AddCountryDialog'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

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

type Country = {
  id: string
  name: string
  code: string
  isActive: boolean
  states?: Array<{
    id: string
    name: string
    code: string
    isActive: boolean
  }>
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

const columnHelper = createColumnHelper<Country>()

const CountriesListTable = () => {
  // Hooks
  const dictionary = useTranslation()

  const [data, setData] = useState<Country[]>([])
  const [filteredData, setFilteredData] = useState(data)
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [addCountryOpen, setAddCountryOpen] = useState(false)
  const [editCountry, setEditCountry] = useState<Country | null>(null)

  const { lang: locale } = useParams()

  // Fetch countries data
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch('/api/countries')
        if (response.ok) {
          const countries = await response.json()
          setData(countries)
          setFilteredData(countries)
        }
      } catch (error) {
        console.error('Error fetching countries:', error)
        toast.error('Failed to load countries')
      } finally {
        setLoading(false)
      }
    }

    fetchCountries()
  }, [])

  const columns = useMemo<ColumnDef<Country, any>[]>(
    () => [
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
        header: dictionary.navigation.country,
        cell: ({ row }) => <Typography>{row.original.name}</Typography>
      }),
      columnHelper.accessor('code', {
        header: dictionary.navigation.code,
        cell: ({ row }) => <Typography>{row.original.code}</Typography>
      }),
      columnHelper.accessor('isActive', {
        header: dictionary.navigation.status,
        cell: ({ row }) => (
          <Chip
            variant='tonal'
            label={row.original.isActive ? dictionary.navigation.active : dictionary.navigation.inactive}
            size='small'
            color={row.original.isActive ? 'success' : 'secondary'}
          />
        )
      }),
      {
        id: 'states',
        header: dictionary.navigation.states,
        cell: ({ row }) => {
          const statesCount = row.original.states ? row.original.states.length : 0
          return (
            <div className='flex items-center gap-2'>
              <Chip
                label={`${statesCount} ${dictionary.navigation.states.toLowerCase()}`}
                size='small'
                variant={statesCount > 0 ? 'filled' : 'outlined'}
                color={statesCount > 0 ? 'primary' : 'default'}
              />
            </div>
          )
        }
      },
      {
        id: 'actions',
        header: dictionary.navigation.actions,
        cell: ({ row }) => (
          <div className='flex items-center'>
            <IconButton onClick={() => handleEditCountry(row.original)} title={dictionary.navigation.editTranslation}>
              <i className='ri-edit-line text-textSecondary' />
            </IconButton>
            <Switch
              checked={row.original.isActive}
              onChange={() => handleToggleCountryStatus(row.original.id)}
              size='small'
            />
            <IconButton onClick={() => handleDeleteCountry(row.original.id, row.original.name)} title={dictionary.navigation.deleteTranslation}>
              <i className='ri-delete-bin-7-line text-textSecondary' />
            </IconButton>
          </div>
        ),
        enableSorting: false
      }
    ],
    [data]
  )

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
        pageSize: 50
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

  const handleDeleteCountry = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete country "${name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/references/countries/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const updatedData = data.filter(country => country.id !== id)
        setData(updatedData)
        setFilteredData(updatedData)
        toast.success('Country deleted ' + dictionary.navigation.successfully)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to delete country')
      }
    } catch (error) {
      console.error('Error deleting country:', error)
      toast.error('Failed to delete country')
    }
  }

  const handleEditCountry = (country: Country) => {
    setEditCountry(country)
  }

  const handleUpdateCountry = async (countryData: { id: string; name: string; code: string; states: string[]; isActive: boolean }) => {
    try {
      console.log('Updating country with data:', countryData)
      const response = await fetch(`/api/admin/references/countries/${countryData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(countryData)
      })

      if (response.ok) {
        const updatedCountry = await response.json()
        const updatedData = data.map(country =>
          country.id === updatedCountry.id ? updatedCountry : country
        )
        setData(updatedData)
        setFilteredData(updatedData)
        setEditCountry(null)
        toast.success('Country updated ' + dictionary.navigation.successfully)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to update country')
      }
    } catch (error) {
      console.error('Error updating country:', error)
      toast.error('Failed to update country')
    }
  }

  const handleToggleCountryStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/references/countries/${id}`, {
        method: 'PATCH'
      })

      if (response.ok) {
        const updatedCountry = await response.json()
        const updatedData = data.map(country =>
          country.id === updatedCountry.id ? updatedCountry : country
        )
        setData(updatedData)
        setFilteredData(updatedData)
        toast.success(`Country ${updatedCountry.isActive ? 'activated' : 'deactivated'} ${dictionary.navigation.successfully}`)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to toggle country status')
      }
    } catch (error) {
      console.error('Error toggling country status:', error)
      toast.error('Failed to toggle country status')
    }
  }

  const handleAddCountry = async (countryData: { name: string; code: string; states: string[]; isActive: boolean }) => {
    try {
      const response = await fetch('/api/admin/references/countries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(countryData)
      })

      if (response.ok) {
        const newCountry = await response.json()
        const updatedData = [...data, newCountry]
        setData(updatedData)
        setFilteredData(updatedData)
        setAddCountryOpen(false)
        toast.success('Country added ' + dictionary.navigation.successfully)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to add country')
      }
    } catch (error) {
      console.error('Error adding country:', error)
      toast.error('Failed to add country')
    }
  }

  if (loading) {
    return <Typography>{dictionary.navigation.loadingCountries}</Typography>
  }

  return (
    <>
      <Card>
        <CardHeader title={dictionary.navigation.countriesManagement} />
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
            <DebouncedInput
              value={globalFilter ?? ''}
              onChange={value => setGlobalFilter(String(value))}
              placeholder={dictionary.navigation.searchCountry}
              className='max-sm:is-full'
            />
          </div>
          <Button variant='contained' onClick={() => setAddCountryOpen(true)} className='max-sm:is-full'>
            {dictionary.navigation.addNewCountry}
          </Button>
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
                    {dictionary.navigation.noDataAvailable}
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
      <AddCountryDialog
        open={addCountryOpen || !!editCountry}
        handleClose={() => {
          setAddCountryOpen(false)
          setEditCountry(null)
        }}
        onSubmit={handleAddCountry}
        editCountry={editCountry}
        onUpdate={handleUpdateCountry}
      />
    </>
  )
}

export default CountriesListTable