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
import CircularProgress from '@mui/material/CircularProgress'
import { styled } from '@mui/material/styles'

import type { TextFieldProps } from '@mui/material/TextField'
import type { RowSelectionState } from '@tanstack/react-table'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

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
import Skeleton from '@mui/material/Skeleton'

import LocalizedTablePagination from '@components/LocalizedTablePagination'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { Locale } from '@configs/i18n'

// Component Imports
import AddCityDialog from './AddCityDialog'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Util Imports
import { formatTranslation } from '@/utils/translations/pluralization'

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'

// Style Imports
import tableStyles from '@core/styles/table.module.css'

declare module '@tanstack/react-table' {
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
  type: string
  latitude: number | null
  longitude: number | null
  fiasId: string | null
  oktmo: string | null
  isActive: boolean
  districts?: Array<{
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

const columnHelper = createColumnHelper<City>()

const CitiesListTable = () => {
  const dictionary = useTranslation()
  const { checkPermission } = usePermissions()

  const canCreate = checkPermission('cityManagement', 'create')
  const canUpdate = checkPermission('cityManagement', 'update')
  const canDelete = checkPermission('cityManagement', 'delete')

  const [data, setData] = useState<City[]>([])
  const [filteredData, setFilteredData] = useState(data)
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [addCityOpen, setAddCityOpen] = useState(false)
  const [editCity, setEditCity] = useState<City | null>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [bulkActivateLoading, setBulkActivateLoading] = useState(false)
  const [bulkDeactivateLoading, setBulkDeactivateLoading] = useState(false)

  const { lang: locale } = useParams()

  // Fetch cities data
  useEffect(() => {
    const fetchCities = async () => {
      try {
        const response = await fetch(`/api/cities?locale=${locale}`)

        if (response.ok) {
          const cities = await response.json()

          setData(cities)
          setFilteredData(cities)
        }
      } catch (error) {
        console.error('Error fetching cities:', error)
        toast.error(dictionary.navigation.failedToLoadCities)
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
      header: dictionary.navigation.city,
      cell: ({ row }) => <Typography>{row.original.name}</Typography>
    }),
    columnHelper.accessor('code', {
      header: dictionary.navigation.code,
      cell: ({ row }) => <Typography>{row.original.code}</Typography>
    }),
    columnHelper.accessor('type', {
      header: dictionary.navigation.type,
      cell: ({ row }) => (
        <Chip
          variant='tonal'
          label={dictionary.navigation.cityTypes?.[row.original.type] || row.original.type}
          size='small'
          color={row.original.type === 'city' ? 'primary' : 'info'}
        />
      )
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
      id: 'districts',
      header: dictionary.navigation.districts,
      cell: ({ row }) => {
        const districtsCount = row.original.districts ? row.original.districts.length : 0

        
return (
          <div className='flex items-center gap-2'>
            <Chip
              label={formatTranslation(dictionary.navigation.districtsCount, { count: districtsCount }, locale as string)}
              size='small'
              variant={districtsCount > 0 ? 'filled' : 'outlined'}
              color={districtsCount > 0 ? 'primary' : 'default'}
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
          <IconButton onClick={() => handleEditCity(row.original)} title={dictionary.navigation.editCity}>
            <i className='ri-edit-line text-textSecondary' />
          </IconButton>
          <Switch
            checked={row.original.isActive}
            onChange={() => handleToggleCityStatus(row.original.id)}
            size='small'
          />
          <IconButton onClick={() => handleDeleteCity(row.original.id, row.original.name)} title={dictionary.navigation.deleteCity}>
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
      globalFilter,
      rowSelection
    },
    initialState: {
      pagination: {
        pageSize: 10
      }
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
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

  const getSelectedIds = (): string[] => {
    return table.getSelectedRowModel().rows.map(row => row.original.id)
  }

  const selectedCount = table.getSelectedRowModel().rows.length
  const bulkLoading = bulkDeleteLoading || bulkActivateLoading || bulkDeactivateLoading

  const refetchData = async () => {
    const response = await fetch(`/api/cities?locale=${locale}`)

    if (response.ok) {
      const cities = await response.json()

      setData(cities)
      setFilteredData(cities)
    }
  }

  const handleBulkDelete = async () => {
    const ids = getSelectedIds()

    if (ids.length === 0) return

    if (!confirm(dictionary.navigation.bulkDeleteConfirm?.replace('${count}', String(ids.length)) || `Delete ${ids.length} records?`)) return

    setBulkDeleteLoading(true)

    try {
      const response = await fetch('/api/admin/references/cities/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      })

      if (!response.ok) {
        const error = await response.json()

        throw new Error(error.message || 'Bulk delete failed')
      }

      const result = await response.json()

      toast.success(dictionary.navigation.bulkOperationSuccess?.replace('${successCount}', String(result.deleted)) || `Deleted ${result.deleted} records`)
      await refetchData()
      setRowSelection({})
    } catch (error) {
      console.error('Bulk delete error:', error)
      toast.error(error instanceof Error ? error.message : (dictionary.navigation.bulkOperationFailed || 'Operation failed'))
    } finally {
      setBulkDeleteLoading(false)
    }
  }

  const handleBulkStatusChange = async (activate: boolean) => {
    const ids = getSelectedIds()

    if (ids.length === 0) return

    if (activate) {
      setBulkActivateLoading(true)
    } else {
      setBulkDeactivateLoading(true)
    }

    const endpoint = activate
      ? '/api/admin/references/cities/bulk/activate'
      : '/api/admin/references/cities/bulk/deactivate'

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      })

      if (!response.ok) {
        const error = await response.json()

        throw new Error(error.message || 'Bulk status change failed')
      }

      const result = await response.json()

      toast.success(dictionary.navigation.bulkOperationSuccess?.replace('${successCount}', String(result.affected)) || `Updated ${result.affected} records`)
      await refetchData()
      setRowSelection({})
    } catch (error) {
      console.error('Bulk status change error:', error)
      toast.error(error instanceof Error ? error.message : (dictionary.navigation.bulkOperationFailed || 'Operation failed'))
    } finally {
      setBulkActivateLoading(false)
      setBulkDeactivateLoading(false)
    }
  }

  const handleDeleteCity = async (id: string, name: string) => {
    if (!confirm(dictionary.navigation.deleteCityConfirm.replace('${name}', name))) {
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
        toast.success(dictionary.navigation.cityDeletedSuccess)
      } else {
        const error = await response.json()

        toast.error(error.message || dictionary.navigation.failedToDeleteCity)
      }
    } catch (error) {
      console.error('Error deleting city:', error)
      toast.error(dictionary.navigation.failedToDeleteCity)
    }
  }

  const handleEditCity = (city: City) => {
    setEditCity(city)
  }

  const handleToggleCityStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/references/cities/${id}`, {
        method: 'PATCH'
      })

      if (response.ok) {
        const updatedCity = await response.json()

        const updatedData = data.map(city =>
          city.id === updatedCity.id ? updatedCity : city
        )

        setData(updatedData)
        setFilteredData(updatedData)
        toast.success(updatedCity.isActive ? dictionary.navigation.cityActivatedSuccess : dictionary.navigation.cityDeactivatedSuccess)
      } else {
        const error = await response.json()

        toast.error(error.message || dictionary.navigation.failedToToggleCityStatus)
      }
    } catch (error) {
      console.error('Error toggling city status:', error)
      toast.error(dictionary.navigation.failedToToggleCityStatus)
    }
  }

  const handleAddCity = async (cityData: { name: string; code: string; districts: string[]; isActive: boolean }) => {
    try {
      const response = await fetch('/api/admin/references/cities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cityData)
      })

      if (response.ok) {
        const newCity = await response.json()
        const updatedData = [...data, newCity]

        setData(updatedData)
        setFilteredData(updatedData)
        setAddCityOpen(false)
        toast.success(dictionary.navigation.cityAddedSuccess)
      } else {
        const error = await response.json()

        toast.error(error.message || dictionary.navigation.failedToAddCity)
      }
    } catch (error) {
      console.error('Error adding city:', error)
      toast.error(dictionary.navigation.failedToAddCity)
    }
  }

  const handleUpdateCity = async (cityData: { id: string; name: string; code: string; districts: string[]; isActive: boolean }) => {
    try {
      const response = await fetch(`/api/admin/references/cities/${cityData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cityData)
      })

      if (response.ok) {
        const updatedCity = await response.json()

        const updatedData = data.map(city =>
          city.id === updatedCity.id ? updatedCity : city
        )

        setData(updatedData)
        setFilteredData(updatedData)
        setEditCity(null)
        toast.success(dictionary.navigation.cityUpdatedSuccess)
      } else {
        const error = await response.json()

        toast.error(error.message || dictionary.navigation.failedToUpdateCity)
      }
    } catch (error) {
      console.error('Error updating city:', error)
      toast.error(dictionary.navigation.failedToUpdateCity)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton width={200} height={28} />
        </CardHeader>
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
            <Skeleton width={300} height={40} />
          </div>
          <Skeleton width={150} height={36} />
        </div>
        <TableContainer className='overflow-x-auto'>
          <Table className={tableStyles.table}>
            <TableHead>
              <TableRow>
                <TableCell><Skeleton width={20} height={20} /></TableCell>
                <TableCell><Skeleton width={120} height={20} /></TableCell>
                <TableCell><Skeleton width={80} height={20} /></TableCell>
                <TableCell><Skeleton width={70} height={20} /></TableCell>
                <TableCell><Skeleton width={120} height={20} /></TableCell>
                <TableCell><Skeleton width={60} height={20} /></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from({ length: 10 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton width={20} height={20} /></TableCell>
                  <TableCell><Skeleton width={120} height={16} /></TableCell>
                  <TableCell><Skeleton width={80} height={16} /></TableCell>
                  <TableCell><Skeleton width={70} height={24} /></TableCell>
                  <TableCell><Skeleton width={120} height={16} /></TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <Skeleton width={24} height={24} />
                      <Skeleton width={24} height={24} />
                      <Skeleton width={40} height={20} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <div className='border-bs p-4'>
          <Skeleton width={200} height={24} />
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader title={dictionary.navigation.citiesManagement} />
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
            <DebouncedInput
              value={globalFilter ?? ''}
              onChange={value => setGlobalFilter(String(value))}
              placeholder={dictionary.navigation.searchCity}
              className='max-sm:is-full'
            />
          </div>
          <div className='flex items-center gap-2 flex-wrap'>
            {canDelete && (
              <Button
                color='error'
                variant='outlined'
                size='small'
                onClick={handleBulkDelete}
                disabled={bulkLoading || selectedCount === 0}
                startIcon={bulkDeleteLoading ? <CircularProgress size={16} /> : <i className='ri-delete-bin-line text-xl' />}
              >
                {dictionary.navigation.bulkDelete || 'Delete'}
              </Button>
            )}
            {canUpdate && (
              <>
                <Button
                  color='success'
                  variant='outlined'
                  size='small'
                  onClick={() => handleBulkStatusChange(true)}
                  disabled={bulkLoading || selectedCount === 0}
                  startIcon={bulkActivateLoading ? <CircularProgress size={16} /> : <i className='ri-check-line text-xl' />}
                >
                  {dictionary.navigation.bulkActivate || 'Activate'}
                </Button>
                <Button
                  color='warning'
                  variant='outlined'
                  size='small'
                  onClick={() => handleBulkStatusChange(false)}
                  disabled={bulkLoading || selectedCount === 0}
                  startIcon={bulkDeactivateLoading ? <CircularProgress size={16} /> : <i className='ri-pause-line text-xl' />}
                >
                  {dictionary.navigation.bulkDeactivate || 'Deactivate'}
                </Button>
              </>
            )}
            {canCreate && (
              <Button variant='contained' size='small' onClick={() => setAddCityOpen(true)} className='max-sm:is-full'>
                {dictionary.navigation.addNewCity}
              </Button>
            )}
          </div>
        </div>
      <TableContainer className='overflow-x-auto'>
        <Table className={tableStyles.table}>
          <TableHead>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableCell key={header.id}>
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
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          {table.getFilteredRowModel().rows.length === 0 ? (
            <TableBody>
              <TableRow>
                <TableCell colSpan={table.getVisibleFlatColumns().length} className='text-center'>
                  {dictionary.navigation.noDataAvailable}
                </TableCell>
              </TableRow>
            </TableBody>
          ) : (
            <TableBody>
              {table
                .getRowModel()
                .rows.slice(0, table.getState().pagination.pageSize)
                .map(row => (
                  <TableRow key={row.id} className={classnames({ selected: row.getIsSelected() })}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
            </TableBody>
          )}
        </Table>
      </TableContainer>
      <LocalizedTablePagination dictionary={dictionary} table={table} />
      </Card>
      <AddCityDialog
        open={addCityOpen || !!editCity}
        handleClose={() => {
          setAddCityOpen(false)
          setEditCity(null)
        }}
        onSubmit={handleAddCity}
        editCity={editCity}
        onUpdate={handleUpdateCity}
      />
    </>
  )
}

export default CitiesListTable
