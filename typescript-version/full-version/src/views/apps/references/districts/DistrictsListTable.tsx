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

// Type Imports
import type { ThemeColor } from '@core/types'
import type { Locale } from '@configs/i18n'

// Component Imports
import AddDistrictDialog from './AddDistrictDialog'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

// Hook Imports
import { usePermissions } from '@/hooks/usePermissions'

// Util Imports
import { checkPermission } from '@/utils/permissions/permissions'

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

type District = {
  id: string
  name: string
  code: string
  isActive: boolean
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

const columnHelper = createColumnHelper<District>()

const DistrictsListTable = () => {
  const dictionary = useTranslation()
  const { checkPermission } = usePermissions()

  // Permission checks
  const canCreate = checkPermission('districtManagement', 'create')
  const canUpdate = checkPermission('districtManagement', 'update')
  const canDelete = checkPermission('districtManagement', 'delete')

  const [data, setData] = useState<District[]>([])
  const [filteredData, setFilteredData] = useState(data)
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [addDistrictOpen, setAddDistrictOpen] = useState(false)
  const [editDistrict, setEditDistrict] = useState<District | null>(null)

  const { lang: locale } = useParams()

  // Fetch districts data
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const response = await fetch('/api/districts')

        if (response.ok) {
          const districts = await response.json()

          setData(districts)
          setFilteredData(districts)
        }
      } catch (error) {
        console.error('Error fetching districts:', error)
        toast.error('Failed to load districts')
      } finally {
        setLoading(false)
      }
    }

    fetchDistricts()
  }, [])

  const columns = useMemo<ColumnDef<District, any>[]>(
    () => {
      const baseColumns: ColumnDef<District, any>[] = [
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
          header: dictionary.navigation.district,
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
        })
      ]

      // Add actions column only if user has any management permissions
      if (canCreate || canUpdate || canDelete) {
        baseColumns.push({
          id: 'actions',
          header: dictionary.navigation.actions,
          cell: ({ row }) => (
            <div className='flex items-center'>
              {canUpdate && (
                <IconButton onClick={() => handleEditDistrict(row.original)} title={dictionary.navigation.editDistrict}>
                  <i className='ri-edit-line text-textSecondary' />
                </IconButton>
              )}
              {canUpdate && (
                <Switch
                  checked={row.original.isActive}
                  onChange={() => handleToggleDistrictStatus(row.original.id)}
                  size='small'
                />
              )}
              {canDelete && (
                <IconButton onClick={() => handleDeleteDistrict(row.original.id, row.original.name)} title={dictionary.navigation.deleteDistrict}>
                  <i className='ri-delete-bin-7-line text-textSecondary' />
                </IconButton>
              )}
            </div>
          ),
          enableSorting: false
        })
      }

      return baseColumns
    },
    [data, canCreate, canUpdate, canDelete]
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

  const handleDeleteDistrict = async (id: string, name: string) => {
    if (!confirm(dictionary.navigation.deleteDistrictConfirm.replace('${name}', name))) {
      return
    }

    try {
      const response = await fetch(`/api/admin/references/districts/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const updatedData = data.filter(district => district.id !== id)

        setData(updatedData)
        setFilteredData(updatedData)
        toast.success('District deleted successfully!')
      } else {
        const error = await response.json()

        toast.error(error.message || 'Failed to delete district')
      }
    } catch (error) {
      console.error('Error deleting district:', error)
      toast.error('Failed to delete district')
    }
  }

  const handleEditDistrict = (district: District) => {
    setEditDistrict(district)
  }

  const handleToggleDistrictStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/references/districts/${id}`, {
        method: 'PATCH'
      })

      if (response.ok) {
        const updatedDistrict = await response.json()

        const updatedData = data.map(district =>
          district.id === updatedDistrict.id ? updatedDistrict : district
        )

        setData(updatedData)
        setFilteredData(updatedData)
        toast.success(`District ${updatedDistrict.isActive ? 'activated' : 'deactivated'} successfully!`)
      } else {
        const error = await response.json()

        toast.error(error.message || 'Failed to toggle district status')
      }
    } catch (error) {
      console.error('Error toggling district status:', error)
      toast.error('Failed to toggle district status')
    }
  }

  const handleAddDistrict = async (districtData: { name: string; code: string; isActive: boolean }) => {
    try {
      const response = await fetch('/api/admin/references/districts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(districtData)
      })

      if (response.ok) {
        const newDistrict = await response.json()
        const updatedData = [...data, newDistrict]

        setData(updatedData)
        setFilteredData(updatedData)
        setAddDistrictOpen(false)
        toast.success('District added successfully!')
      } else {
        const error = await response.json()

        toast.error(error.message || 'Failed to add district')
      }
    } catch (error) {
      console.error('Error adding district:', error)
      toast.error('Failed to add district')
    }
  }

  const handleUpdateDistrict = async (districtData: { id: string; name: string; code: string; isActive: boolean }) => {
    try {
      const response = await fetch(`/api/admin/references/districts/${districtData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(districtData)
      })

      if (response.ok) {
        const updatedDistrict = await response.json()

        const updatedData = data.map(district =>
          district.id === updatedDistrict.id ? updatedDistrict : district
        )

        setData(updatedData)
        setFilteredData(updatedData)
        setEditDistrict(null)
        toast.success('District updated successfully!')
      } else {
        const error = await response.json()

        toast.error(error.message || 'Failed to update district')
      }
    } catch (error) {
      console.error('Error updating district:', error)
      toast.error('Failed to update district')
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
        <CardHeader title={dictionary.navigation.districtsManagement} />
        <Divider />
        <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
          <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
            <DebouncedInput
              value={globalFilter ?? ''}
              onChange={value => setGlobalFilter(String(value))}
              placeholder={dictionary.navigation.searchDistrict}
              className='max-sm:is-full'
            />
          </div>
          {canCreate && (
            <Button variant='contained' onClick={() => setAddDistrictOpen(true)} className='max-sm:is-full'>
              {dictionary.navigation.addNewDistrict}
            </Button>
          )}
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
      <AddDistrictDialog
        open={addDistrictOpen || !!editDistrict}
        handleClose={() => {
          setAddDistrictOpen(false)
          setEditDistrict(null)
        }}
        onSubmit={handleAddDistrict}
        editDistrict={editDistrict}
        onUpdate={handleUpdateDistrict}
      />
    </>
  )
}

export default DistrictsListTable
