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
import Switch from '@mui/material/Switch'
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
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

// Type Imports
import type { ThemeColor } from '@core/types'
import type { Locale } from '@configs/i18n'

// Component Imports
import AddCurrencyDialog from './AddCurrencyDialog'
import ConfirmationDialog from '@components/dialogs/confirmation-dialog'

// Context Imports
import { useTranslation } from '@/contexts/TranslationContext'

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

type Currency = {
  id: string
  name: string
  code: string
  symbol: string
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

const columnHelper = createColumnHelper<Currency>()

const CurrenciesListTable = () => {
  // Hooks
  const dictionary = useTranslation()

  const [data, setData] = useState<Currency[]>([])
  const [filteredData, setFilteredData] = useState(data)
  const [globalFilter, setGlobalFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [addCurrencyOpen, setAddCurrencyOpen] = useState(false)
  const [editCurrency, setEditCurrency] = useState<Currency | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [currencyToDelete, setCurrencyToDelete] = useState<{ id: string; name: string } | null>(null)

  const { lang: locale } = useParams()

  // Fetch currencies data
  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const response = await fetch('/api/currencies')

        if (response.ok) {
          const currencies = await response.json()

          setData(currencies)
          setFilteredData(currencies)
        }
      } catch (error) {
        console.error('Error fetching currencies:', error)
        toast.error('Failed to load currencies')
      } finally {
        setLoading(false)
      }
    }

    fetchCurrencies()
  }, [])

  const columns = useMemo<ColumnDef<Currency, any>[]>(
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
        header: dictionary.navigation.currency,
        cell: ({ row }) => <Typography>{row.original.name}</Typography>
      }),
      columnHelper.accessor('code', {
        header: dictionary.navigation.code,
        cell: ({ row }) => <Typography>{row.original.code}</Typography>
      }),
      columnHelper.accessor('symbol', {
        header: dictionary.navigation.currencySymbol,
        cell: ({ row }) => <Typography>{row.original.symbol}</Typography>
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
        id: 'actions',
        header: dictionary.navigation.actions,
        cell: ({ row }) => (
          <div className='flex items-center'>
            <IconButton onClick={() => handleEditCurrency(row.original)} title={dictionary.navigation.editTranslation}>
              <i className='ri-edit-line text-textSecondary' />
            </IconButton>
            <Switch
              checked={row.original.isActive}
              onChange={() => handleToggleCurrencyStatus(row.original.id)}
              size='small'
            />
            <IconButton onClick={() => handleDeleteCurrency(row.original.id, row.original.name)} title={dictionary.navigation.deleteTranslation}>
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

  const handleDeleteCurrency = (id: string, name: string) => {
    setCurrencyToDelete({ id, name })
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async (confirmed: boolean) => {
    if (!confirmed || !currencyToDelete) {
      setDeleteDialogOpen(false)
      setCurrencyToDelete(null)
      return
    }

    try {
      const response = await fetch(`/api/admin/references/currencies/${currencyToDelete.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const updatedData = data.filter(currency => currency.id !== currencyToDelete.id)

        setData(updatedData)
        setFilteredData(updatedData)
        toast.success('Currency deleted successfully!')
      } else {
        const error = await response.json()

        toast.error(error.message || 'Failed to delete currency')
      }
    } catch (error) {
      console.error('Error deleting currency:', error)
      toast.error('Failed to delete currency')
    } finally {
      setDeleteDialogOpen(false)
      setCurrencyToDelete(null)
    }
  }

  const handleEditCurrency = (currency: Currency) => {
    setEditCurrency(currency)
  }

  const handleToggleCurrencyStatus = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/references/currencies/${id}`, {
        method: 'PATCH'
      })

      if (response.ok) {
        const updatedCurrency = await response.json()

        const updatedData = data.map(currency =>
          currency.id === updatedCurrency.id ? updatedCurrency : currency
        )

        setData(updatedData)
        setFilteredData(updatedData)
        toast.success(`Currency ${updatedCurrency.isActive ? 'activated' : 'deactivated'} successfully!`)
      } else {
        const error = await response.json()

        toast.error(error.message || 'Failed to toggle currency status')
      }
    } catch (error) {
      console.error('Error toggling currency status:', error)
      toast.error('Failed to toggle currency status')
    }
  }

  const handleAddCurrency = async (currencyData: { name: string; code: string; symbol: string; isActive: boolean }) => {
    try {
      const response = await fetch('/api/admin/references/currencies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(currencyData)
      })

      if (response.ok) {
        const newCurrency = await response.json()
        const updatedData = [...data, newCurrency]

        setData(updatedData)
        setFilteredData(updatedData)
        setAddCurrencyOpen(false)
        toast.success('Currency added successfully!')
      } else {
        const error = await response.json()

        toast.error(error.message || 'Failed to add currency')
      }
    } catch (error) {
      console.error('Error adding currency:', error)
      toast.error('Failed to add currency')
    }
  }

  const handleUpdateCurrency = async (currencyData: { id: string; name: string; code: string; symbol: string; isActive: boolean }) => {
    try {
      const response = await fetch(`/api/admin/references/currencies/${currencyData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(currencyData)
      })

      if (response.ok) {
        const updatedCurrency = await response.json()

        const updatedData = data.map(currency =>
          currency.id === updatedCurrency.id ? updatedCurrency : currency
        )

        setData(updatedData)
        setFilteredData(updatedData)
        setEditCurrency(null)
        toast.success('Currency updated successfully!')
      } else {
        const error = await response.json()

        toast.error(error.message || 'Failed to update currency')
      }
    } catch (error) {
      console.error('Error updating currency:', error)
      toast.error('Failed to update currency')
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
        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              <tr>
                <th><Skeleton width={20} height={20} /></th>
                <th><Skeleton width={120} height={20} /></th>
                <th><Skeleton width={80} height={20} /></th>
                <th><Skeleton width={70} height={20} /></th>
                <th><Skeleton width={60} height={20} /></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, index) => (
                <tr key={index}>
                  <td><Skeleton width={20} height={20} /></td>
                  <td><Skeleton width={120} height={16} /></td>
                  <td><Skeleton width={80} height={16} /></td>
                  <td><Skeleton width={70} height={16} /></td>
                  <td>
                    <div className='flex items-center gap-2'>
                      <Skeleton width={24} height={24} />
                      <Skeleton width={24} height={24} />
                      <Skeleton width={40} height={20} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className='border-bs p-4'>
          <Skeleton width={200} height={24} />
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader title={dictionary.navigation.currenciesManagement} />
      <Divider />
      <div className='flex justify-between p-5 gap-4 flex-col items-start sm:flex-row sm:items-center'>
        <div className='flex items-center gap-x-4 gap-4 flex-col max-sm:is-full sm:flex-row'>
          <DebouncedInput
            value={globalFilter ?? ''}
            onChange={value => setGlobalFilter(String(value))}
            placeholder={dictionary.navigation.searchCurrency}
            className='max-sm:is-full'
          />
        </div>
        <Button variant='contained' onClick={() => setAddCurrencyOpen(true)} className='max-sm:is-full'>
          {dictionary.navigation.addNewCurrency}
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
      <AddCurrencyDialog
        open={addCurrencyOpen || !!editCurrency}
        handleClose={() => {
          setAddCurrencyOpen(false)
          setEditCurrency(null)
        }}
        onSubmit={handleAddCurrency}
        editCurrency={editCurrency}
        onUpdate={handleUpdateCurrency}
      />
      <ConfirmationDialog
        open={deleteDialogOpen}
        setOpen={setDeleteDialogOpen}
        type='delete-currency'
        onConfirm={handleConfirmDelete}
        name={currencyToDelete?.name}
      />
    </Card>
  )
}

export default CurrenciesListTable